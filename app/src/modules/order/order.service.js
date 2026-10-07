// ============================================================
//  订单服务
//  核心：创建订单 / 处理支付成功后的履约(开通/续费套餐、充值余额)
//  支付回调(notify)最终都会进入 markOrderPaid 从而激活订阅。
// ============================================================
const db = require("../../db");
const { ApiError } = require("../../middleware/error");
const { nanoid } = require("nanoid");
const couponService = require("../../services/coupon.service");
const settings = require("../../services/settings.service");

/** 订单号 */
function genOrderNo() {
  const ts = Date.now().toString(36).toUpperCase();
  return `${ts}${nanoid(8).toUpperCase()}`;
}

/**
 * 创建订单。
 * @param {object} p { userId, planId?, type:'plan'|'recharge', amount?, method?, cycle?, couponCode? }
 */
function createOrder(p) {
  if (!p.userId) throw new ApiError(1, "未登录");
  let amount = p.amount;
  let cycle = p.cycle || "month";

  if (p.type === "plan") {
    const plan = db.get("SELECT * FROM plans WHERE id=? AND active=1", [p.planId]);
    if (!plan) throw new ApiError(404, "套餐不存在或已下架", 404);
    if (cycle === "quarter") amount = plan.price_q != null ? plan.price_q : plan.price;
    else if (cycle === "year") amount = plan.price_y != null ? plan.price_y : plan.price;
    else cycle = "month", amount = plan.price;
  }
  if (amount == null || amount <= 0) throw new ApiError(1, "金额无效");

  let finalAmount = amount;
  let discount = 0;
  let couponMeta = null;

  // 优惠码核销(事务内: 取数+校验+占用)
  if (p.type === "plan" && p.couponCode) {
    const code = String(p.couponCode).trim().toUpperCase();
    const coupon = couponService.getByCode(code);
    const apply = couponService.couponApplies(coupon || null, {
      amount,
      type: "plan",
      plan_id: p.planId || null,
      userId: p.userId,
    });
    if (!apply.ok) throw new ApiError(1, apply.reason);
    const calc = couponService.applyDiscount(coupon, amount);
    discount = calc.discount;
    finalAmount = calc.final;
    couponMeta = coupon;
    p.couponCode = code;
  }

  if (finalAmount <= 0) finalAmount = 0; // 优惠全额抵扣, 余额支付时视为0元单

  const orderNo = genOrderNo();
  const extra = {
    planId: p.planId,
    cycle,
    couponCode: p.couponCode || "",
    couponValue: couponMeta ? (couponMeta.type === "fixed" ? couponMeta.value : couponMeta.value + "%") : "",
    originalAmount: amount,
    discount,
  };
  db.transaction(() => {
    if (couponMeta) couponService.markUsed(couponMeta.id);
    db.run(
      `INSERT INTO orders(order_no,user_id,plan_id,type,amount,currency,pay_method,extra)
       VALUES(?,?,?,?,?,?,?,?)`,
      [
        orderNo,
        p.userId,
        p.planId || null,
        p.type || "plan",
        finalAmount,
        "CNY",
        p.method || null,
        JSON.stringify(extra),
      ]
    );
  });
  return db.get("SELECT * FROM orders WHERE order_no=?", [orderNo]);
}

/**
 * 支付成功核心：把订单标记为 paid 并完成履约。
 * 幂等：同一订单只履约一次。由回调与余额支付共用，事务内执行。
 */
function markOrderPaid({ orderNo, tradeNo, provider, method, extras }) {
  return db.transaction(() => {
    const order = db.get("SELECT * FROM orders WHERE order_no=?", [orderNo]);
    if (!order) throw new ApiError(404, "订单不存在", 404);
    if (order.status === "paid") return order; // 幂等

    db.run(
      "UPDATE orders SET status='paid', pay_method=?, provider=?, pay_trade_no=?, paid_at=unixepoch() WHERE order_no=?",
      [method || order.pay_method, provider || order.provider, tradeNo || null, orderNo]
    );

    if (order.type === "plan") {
      // 开通/续费套餐：更新用户 plan 与到期时间(周期按订单所选)
      const plan = db.get("SELECT * FROM plans WHERE id=?", [order.plan_id]);
      if (plan) {
        const extra = safeParse(order.extra);
        activatePlan(order.user_id, plan, (extra && extra.cycle) || plan.cycle);
      }
      notifyPaid(order.user_id, order);
    } else if (order.type === "recharge") {
      // 充值：给用户余额加钱(含充值赠送), 记钱包流水
      const giftRate = settings.get("pay.recharge_gift_rate") || 0;
      const gift = giftRate > 0 ? Math.round(order.amount * giftRate * 100) / 100 : 0;
      const credit = order.amount + gift;
      db.run("UPDATE users SET balance=balance+? WHERE id=?", [credit, order.user_id]);
      db.run(
        "INSERT INTO wallet_transactions(user_id,amount,type,order_no,remark) VALUES(?,?,?,?,?)",
        [order.user_id, order.amount, "recharge", orderNo, "余额充值"]
      );
      if (gift > 0) {
        db.run(
          "INSERT INTO wallet_transactions(user_id,amount,type,order_no,remark) VALUES(?,?,?,?,?)",
          [order.user_id, gift, "reward", orderNo, `充值赠送(${giftRate}%)`]
        );
      }
      // 通知到账
      notifyPaid(order.user_id, order);
    } else {
      notifyPaid(order.user_id, order);
    }

    // 邀请返佣：被推荐人首笔成功支付的套餐订单 -> 推荐人得返佣
    if (order.type === "plan") {
      payReferralCommission(order, orderNo);
    }

    db.run(
      "INSERT INTO payments(order_no,provider,trade_no,status,provider_raw) VALUES(?,?,?,?,?)",
      [orderNo, provider || method || "unknown", tradeNo || null, "success", JSON.stringify(extras || {})]
    );
    return db.get("SELECT * FROM orders WHERE order_no=?", [orderNo]);
  });
}

/** 安全解析 JSON(extra 字段) */
function safeParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch (e) {
    return {};
  }
}

/** 续期/开通套餐 */
function activatePlan(userId, plan, cycle) {
  const user = db.get("SELECT * FROM users WHERE id=?", [userId]);
  let base = 0;
  if (user.plan_id === plan.id && user.plan_expire_at && user.plan_expire_at > Math.floor(Date.now() / 1000)) {
    base = user.plan_expire_at; // 续期叠加
  }
  const c = cycle || plan.cycle || "month";
  let add = 0;
  if (c === "month") add = 30 * 86400;
  else if (c === "quarter") add = 90 * 86400;
  else if (c === "year") add = 365 * 86400;
  else if (c === "once") add = 30 * 86400;
  const expireAt = base + add;
  // 开通即激活账号；重置提醒标记让下一周期可再次提醒
  db.run(
    "UPDATE users SET plan_id=?, plan_expire_at=?, status='active', expire_remind_sent=0, traffic_remind_sent=0 WHERE id=?",
    [plan.id, expireAt, userId]
  );
}

/** 用户用余额支付 */
function payWithBalance(orderNo, userId) {
  return db.transaction(() => {
    const order = db.get("SELECT * FROM orders WHERE order_no=? AND user_id=?", [orderNo, userId]);
    if (!order) throw new ApiError(404, "订单不存在", 404);
    if (order.status === "paid") return db.get("SELECT * FROM orders WHERE order_no=?", [orderNo]);
    const user = db.get("SELECT * FROM users WHERE id=?", [userId]);
    if (!user) throw new ApiError(404, "用户不存在", 404);
    if (user.balance < order.amount) throw new ApiError(1, "余额不足，请先充值");
    db.run("UPDATE users SET balance=balance-? WHERE id=?", [order.amount, userId]);
    db.run(
      "INSERT INTO wallet_transactions(user_id,amount,type,order_no,remark) VALUES(?,?,?,?,?)",
      [userId, -order.amount, "consume", orderNo, "订单支付"]
    );
    return markOrderPaid({ orderNo, method: "balance", provider: "balance" });
  });
}

/**
 * 邀请返佣(事务内调用): 被推荐人支付套餐订单后, 推荐人拿返佣。
 * 返佣规则: 优先 site.commission_rate(按订单实付比例); 为0时若 site.invite_bonus>0 按固定额。
 */
function payReferralCommission(order, orderNo) {
  const buyer = db.get("SELECT * FROM users WHERE id=?", [order.user_id]);
  if (!buyer || !buyer.referrer_id) return;
  const referrer = db.get("SELECT * FROM users WHERE id=?", [buyer.referrer_id]);
  if (!referrer) return;

  const rate = settings.get("site.commission_rate") || 0;
  const fixedBonus = settings.get("site.invite_bonus") || 0;
  let amount = 0;
  if (rate > 0) amount = Math.round(order.amount * rate * 100) / 100;
  else if (fixedBonus > 0) amount = fixedBonus;
  if (amount <= 0) return;

  const exist = db.get(
    "SELECT id FROM commission_records WHERE from_user_id=? AND order_id=?",
    [order.user_id, order.id]
  );
  if (exist) return; // 幂等

  // 仅被推荐人的首笔(当前这笔)套餐订单计佣, 续费不再计
  const paidPlanOrders = db.get(
    "SELECT COUNT(*) AS c FROM orders WHERE user_id=? AND type='plan' AND status='paid'",
    [order.user_id]
  );
  if (paidPlanOrders.c > 1) return;

  db.run("UPDATE users SET balance=balance+? WHERE id=?", [amount, referrer.id]);
  db.run("INSERT INTO wallet_transactions(user_id,amount,type,order_no,remark) VALUES(?,?,?,?,?)", [
    referrer.id,
    amount,
    "reward",
    orderNo,
    "推荐返佣",
  ]);
  db.run(
    "INSERT INTO commission_records(user_id,from_user_id,order_id,order_no,amount,source) VALUES(?,?,?,?,?,?)",
    [referrer.id, order.user_id, order.id, orderNo, amount, "plan"]
  );
}

/** 支付成功站内通知 */
function notifyPaid(userId, order) {
  try {
    const { notifyUser } = require("../../services/notify.service");
    const title =
      order.type === "recharge"
        ? "充值成功"
        : order.type === "plan"
        ? "套餐开通成功"
        : "订单支付成功";
    const content =
      order.type === "plan"
        ? "您的套餐订单已支付成功，订阅链接已生效。"
        : `余额充值已到账 ¥${order.amount}${order.type === "recharge" ? "" : ""}。`;
    notifyUser(userId, title, content, "order_ok");
  } catch (e) {
    /* 忽略 */
  }
}

module.exports = { genOrderNo, createOrder, markOrderPaid, payWithBalance, activatePlan };

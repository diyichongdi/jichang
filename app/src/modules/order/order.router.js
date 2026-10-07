// ============================================================
//  订单模块路由 + 支付回调入口
//  支付回调统一收敛到本模块：先创建支付，再由渠道异步
//  notify 回调，回调验签通过后调用 orderService.markOrderPaid 履约。
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth } = require("../../middleware/auth");
const orderService = require("./order.service");
const providers = require("../../payments/providers");
const config = require("../../config");

// ---- 用户：创建订单并获取支付信息 ----
// body: { planId } 或 { type:'recharge', amount }, 可带 { couponCode, method, cycle }
router.post(
  "/create",
  auth(),
  wrap(async (req, res) => {
    const { planId, method, type = "plan", amount, cycle, couponCode } = req.body || {};

    // 若开启「注册需邮箱验证」，未验证用户禁止下单/充值
    const settings = require("../../services/settings.service");
    if (settings.get("sec.require_email_verify")) {
      const me = db.get("SELECT email_verified FROM users WHERE id=?", [req.user.id]);
      if (!me || !me.email_verified)
        throw new ApiError(1, "请先完成邮箱验证后再下单", 403);
    }

    // 充值订单校验最低金额
    if (type === "recharge") {
      const minRecharge = require("../../services/settings.service").get("pay.min_recharge") || 0;
      const amt = parseFloat(amount);
      if (!(amt > 0)) throw new ApiError(1, "充值金额无效");
      if (minRecharge > 0 && amt < minRecharge)
        throw new ApiError(1, `最低充值金额 ¥${minRecharge}`);
    }

    const order = orderService.createOrder({
      userId: req.user.id,
      planId,
      type,
      amount,
      cycle,
      couponCode,
    });

    // 优惠码全额抵扣时直接履约(0元单)
    if (order.amount <= 0) {
      const paid = orderService.markOrderPaid({ orderNo: order.order_no, provider: "coupon", method: "coupon" });
      return ok(res, { order: paid, status: "paid", method: "coupon" }, "已使用优惠码，订单完成");
    }

    // 给支付驱动的标准订单视图(驱动统一用 orderNo 取单号)
    const payOrder = { orderNo: order.order_no, amount: order.amount, type: order.type };

    // 余额支付直接完成
    if (method === "balance") {
      const paid = orderService.payWithBalance(payOrder.orderNo, req.user.id);
      return ok(res, { order: paid, status: "paid", method }, "支付成功");
    }

    // 生态位：method 省略且只有余额时，也支持余额
    const driver = providers.getDriver(method);
    let subject = "套餐订阅";
    if (type === "recharge") subject = `余额充值 ¥${order.amount.toFixed(2)}`;
    else {
      const p = db.get("SELECT name FROM plans WHERE id=?", [order.plan_id]);
      if (p) subject = `${p.name} 套餐`;
    }
    const pay = await driver.createPayment({ order: payOrder, amount: order.amount, subject });
    ok(
      res,
      {
        order: { orderNo: payOrder.orderNo, amount: order.amount, status: order.status, type: order.type },
        pay,
      },
      "下单成功"
    );
  })
);

// ---- 用户：查询订单状态/是否已支付 ----
router.get(
  "/status/:orderNo",
  auth(),
  wrap(async (req, res) => {
    const order = db.get("SELECT * FROM orders WHERE order_no=? AND user_id=?", [
      req.params.orderNo,
      req.user.id,
    ]);
    if (!order) throw new ApiError(404, "订单不存在", 404);
    ok(res, { orderNo: order.order_no, status: order.status, type: order.type, amount: order.amount });
  })
);

// ---- 用户：我的订单列表 ----
router.get(
  "/list",
  auth(),
  wrap(async (req, res) => {
    const rows = db.all("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 50", [req.user.id]);
    ok(res, rows);
  })
);

// ---- 可用支付渠道 ----
router.get(
  "/channels",
  wrap(async (req, res) => {
    ok(res, providers.availableChannels());
  })
);

/**
 * ---- 支付异步回调统一入口 ----
 * 渠道 POST 到这里(如 /api/payments/notify/alipay)，验签通过即履约。
 */
router.post(
  "/notify/:provider",
  wrap(async (req, res) => {
    const provider = req.params.provider;
    let driver;
    try {
      driver = providers.getDriver(provider);
    } catch (e) {
      return res.status(400).send(e.message || "bad provider");
    }
    // 记录原始回调(审计)
    try {
      db.run("INSERT INTO payments(order_no,provider,status,ip,provider_raw) VALUES(?,?,?,?,?)", [
        req.body.out_trade_no || req.body.order_no || req.body.ref || "unknown",
        provider,
        "notify_raw",
        req.ip || "",
        JSON.stringify(req.query || {}) + "|" + JSON.stringify(req.body || {}),
      ]);
    } catch (e) { /* 忽略审计失败 */ }

    const v = driver.verify({ query: req.query, body: req.body });
    if (!v.verified) {
      return res.status(400).send(driver.buildNotifyResponse({ success: false }));
    }
    try {
      orderService.markOrderPaid({
        orderNo: v.orderNo,
        tradeNo: v.tradeNo,
        provider,
        method: provider,
        extras: v.raw,
        amount: v.amount,
      });
      return res.send(driver.buildNotifyResponse({ success: true }));
    } catch (e) {
      console.error("[notify] 履约失败", e);
      return res.status(422).send(driver.buildNotifyResponse({ success: false }));
    }
  })
);

module.exports = router;

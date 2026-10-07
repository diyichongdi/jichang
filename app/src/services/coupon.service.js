// ============================================================
//  优惠码服务
//  职责：查询 / 校验是否可用 / 计算折扣 / 核销(占用次数)
//  被 order.service(下单核销) 与 coupon.router(管理端/用户端) 复用。
// ============================================================
const db = require("../db");

/** 优惠码标准化(大写去空格) */
function normalize(code) {
  return String(code || "").trim().toUpperCase();
}

/** 按码查询(未找到返回 null) */
function getByCode(code) {
  const c = normalize(code);
  if (!c) return null;
  return db.get("SELECT * FROM coupons WHERE code=?", [c]);
}

/** 解析可用套餐id列表(空=全部套餐) */
function planIdList(coupon) {
  return String((coupon && coupon.plan_ids) || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

/** 该用户已用该码次数 */
function usedByUser(coupon, userId) {
  const rows = db.all("SELECT extra FROM orders WHERE user_id=? AND status='paid'", [userId]);
  let n = 0;
  for (const r of rows) {
    try {
      const ex = JSON.parse(r.extra || "{}");
      if (ex && ex.couponCode && normalize(ex.couponCode) === normalize(coupon.code)) n++;
    } catch (e) { /* extra 非 JSON 忽略 */ }
  }
  return n;
}

/**
 * 校验优惠码能否用于本次下单。
 * @returns {{ok:boolean, reason?:string}}
 */
function couponApplies(coupon, ctx = {}) {
  if (!coupon) return { ok: false, reason: "优惠码不存在" };
  if (!coupon.status) return { ok: false, reason: "优惠码已禁用" };
  if (coupon.expired_at && coupon.expired_at < Math.floor(Date.now() / 1000))
    return { ok: false, reason: "优惠码已过期" };

  const amount = Number(ctx.amount || 0);
  if (coupon.min_amount && amount < coupon.min_amount)
    return { ok: false, reason: "订单需满 ¥" + coupon.min_amount + " 可用" };

  if (coupon.limit_times && coupon.used_times >= coupon.limit_times)
    return { ok: false, reason: "优惠码已被领完" };

  const ids = planIdList(coupon);
  if (ids.length && ctx.plan_id && !ids.includes(Number(ctx.plan_id)))
    return { ok: false, reason: "该优惠码不适用于此套餐" };

  if (coupon.per_user && ctx.userId) {
    if (usedByUser(coupon, ctx.userId) >= coupon.per_user)
      return { ok: false, reason: "你已使用过该优惠码" };
  }
  return { ok: true };
}

/**
 * 计算折后价。
 *  - type=percent: value 为折扣百分比(0-100)，如 85 表示 8.5 折
 *  - type=fixed:   value 为直减金额(元)
 * @returns {{discount:number, final:number}}
 */
function applyDiscount(coupon, amount) {
  const total = Number(amount || 0);
  if (!coupon) return { discount: 0, final: total };
  let discount = 0;
  if (coupon.type === "fixed") {
    discount = Number(coupon.value || 0);
  } else {
    discount = (total * (100 - Number(coupon.value || 0))) / 100;
  }
  if (discount < 0) discount = 0;
  if (discount > total) discount = total;
  const final = Math.round((total - discount) * 100) / 100;
  return { discount: Math.round(discount * 100) / 100, final };
}

/** 核销：占用一次使用次数(事务内调用) */
function markUsed(id) {
  db.run("UPDATE coupons SET used_times = used_times + 1 WHERE id=?", [id]);
}

/** 面向前端的安全字段 */
function toPublic(c) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    minAmount: c.min_amount,
    planIds: planIdList(c),
    expiredAt: c.expired_at,
    status: c.status,
  };
}

/** 生成随机优惠码 */
function genCode(len = 8) {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

module.exports = {
  normalize,
  getByCode,
  planIdList,
  usedByUser,
  couponApplies,
  applyDiscount,
  markUsed,
  toPublic,
  genCode,
};
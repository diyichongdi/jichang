// ============================================================
//  优惠码模块
//  用户：可用优惠码列表 / 核销计算
//  管理：新增/编辑/启停/删除
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm } = require("../../services/permission.service");
const couponService = require("../../services/coupon.service");

const { genCode } = couponService;

function normalize(p) {
  return {
    code: p.code,
    type: p.type && p.type !== "fixed" ? "percent" : p.type === "fixed" ? "fixed" : "percent",
    value: p.value,
    min_amount: p.min_amount,
    limit_times: p.limit_times,
    plan_ids: p.plan_ids,
    per_user: p.per_user,
    expired_at: p.expired_at,
    status: p.status !== undefined ? p.status : 1,
  };
}

/** 订单是否可用该券(需在事务内, 防并发) */
function couponApplies(coupon, order) {
  return couponService.couponApplies(coupon, order);
}

/** 计算优惠后的金额(供下单与对账) */
function applyDiscount(coupon, amount) {
  return couponService.applyDiscount(coupon, amount);
}

// ---- 用户：校验/预览某个优惠码 ----
router.post("/validate", auth(), wrap(async (req, res) => {
  const { code, orderAmount, planId, type } = req.body || {};
  if (!code) throw new ApiError(1, "请输入优惠码");
  const coupon = db.get("SELECT * FROM coupons WHERE code=?", [String(code).trim().toUpperCase()]);
  if (!coupon) throw new ApiError(1, "优惠码不存在");
  const order = { amount: parseFloat(orderAmount) || 0, type: type || "plan", plan_id: planId || null, userId: req.user ? req.user.id : null };
  const apply = couponApplies(coupon, order);
  if (!apply.ok) throw new ApiError(1, apply.reason);
  const { discount, final } = applyDiscount(coupon, order.amount);
  ok(res, {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    final,
    planId: coupon.plan_ids || "",
    name: coupon.type === "fixed" ? `立减 ¥${coupon.value}` : `${coupon.value}% 折扣`,
  }, "优惠码可用");
}));

// ---- 用户：当前可用的优惠码(预告/展示) ----
router.get("/active", auth(), wrap(async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const rows = db.all(
    "SELECT code,type,value,min_amount,plan_ids,expired_at FROM coupons WHERE status=1 AND (expired_at IS NULL OR expired_at>?) AND (limit_times=0 OR used_times<limit_times) ORDER BY id DESC LIMIT 20",
    [now]
  );
  ok(res, rows);
}));

// ================= 管理侧 =================
const admin = require("express").Router();
admin.use(auth(), adminOnly, requirePerm("coupon.manage"));

admin.get("/", wrap(async (req, res) => {
  ok(res, db.all("SELECT * FROM coupons ORDER BY id DESC LIMIT 200"));
}));

admin.post("/", wrap(async (req, res) => {
  const body = req.body || {};
  let code = String(body.code || "").trim().toUpperCase() || genCode(8);
  if (db.get("SELECT id FROM coupons WHERE code=?", [code])) throw new ApiError(1, "该优惠码已存在");
  if (body.value == null || !(body.value > 0)) throw new ApiError(1, "优惠值无效");
  const p = normalize(body);
  const id = db.run(
    "INSERT INTO coupons(code,type,value,min_amount,limit_times,plan_ids,per_user,expired_at,status) VALUES(?,?,?,?,?,?,?,?,?)",
    [code, p.type, p.value, p.min_amount||0, p.limit_times||0, p.plan_ids||"", p.per_user!==undefined?p.per_user:1, p.expired_at||null, p.status]
  );
  ok(res, db.get("SELECT * FROM coupons WHERE id=?", [id]), "优惠码已创建");
}));

// 批量生成优惠码
admin.post("/batch", wrap(async (req, res) => {
  const { count = 10, type = "percent", value = 10, min_amount = 0, expired_at = null, prefix = "" } = req.body || {};
  if (!(value > 0)) throw new ApiError(1, "优惠值无效");
  const n = Math.min(1000, Math.max(1, parseInt(count, 10) || 10));
  const codes = [];
  db.transaction(() => {
    let tries = 0;
    while (codes.length < n && tries < n * 20) {
      tries++;
      const c = String(prefix || "").toUpperCase() + "-" + genCode(10);
      if (db.get("SELECT id FROM coupons WHERE code=?", [c])) continue;
      db.run(
        "INSERT INTO coupons(code,type,value,min_amount,expired_at,status) VALUES(?,?,?,?,?,1)",
        [c, type === "fixed" ? "fixed" : "percent", value, min_amount||0, expired_at||null]
      );
      codes.push(c);
    }
  });
  ok(res, { count: codes.length, codes, type, value }, `已生成 ${codes.length} 个优惠码`);
}));

admin.put("/:id", wrap(async (req, res) => {
  const c = db.get("SELECT * FROM coupons WHERE id=?", [req.params.id]);
  if (!c) throw new ApiError(404, "优惠码不存在", 404);
  const p = normalize(req.body || {});
  const f = (k, v) => (v !== undefined ? v : c[k]);
  db.run(
    "UPDATE coupons SET value=?, min_amount=?, limit_times=?, plan_ids=?, per_user=?, expired_at=?, status=?, type=? WHERE id=?",
    [f("value", p.value), f("min_amount", p.min_amount), f("limit_times", p.limit_times),
     f("plan_ids", p.plan_ids), f("per_user", p.per_user), f("expired_at", p.expired_at),
     f("status", p.status), f("type", p.type), c.id]
  );
  ok(res, db.get("SELECT * FROM coupons WHERE id=?", [c.id]), "已更新");
}));

admin.delete("/:id", wrap(async (req, res) => {
  const c = db.get("SELECT * FROM coupons WHERE id=?", [req.params.id]);
  if (!c) throw new ApiError(404, "优惠码不存在", 404);
  db.run("DELETE FROM coupons WHERE id=?", [c.id]);
  ok(res, null, "已删除");
}));

router.use("/admin", admin);

module.exports = router;
module.exports.applyDiscount = applyDiscount;
module.exports.couponApplies = couponApplies;
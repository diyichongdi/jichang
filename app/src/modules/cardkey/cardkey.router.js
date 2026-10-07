// ============================================================
//  卡密模块(充值卡)
//  用户：兑换卡密 -> 充值余额
//  管理：批量生成 / 导出 / 查询与作废
// ============================================================
const router = require("express").Router();
const crypto = require("crypto");
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm } = require("../../services/permission.service");
const settings = require("../../services/settings.service");

// 生成的字符集(避免混淆 0/O 1/I)
const GEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += GEN[cryptoRandomInt(GEN.length)];
  return s;
}

function cryptoRandomInt(max) {
  const buf = crypto.randomBytes(4).readUInt32BE(0);
  return buf % max;
}

// ---- 用户：兑换卡密 ----
router.post("/redeem", auth(), wrap(async (req, res) => {
  const code = String((req.body && req.body.code) || "").trim().toUpperCase();
  if (!code) throw new ApiError(1, "请输入卡密");
  const card = db.get("SELECT * FROM card_keys WHERE code=?", [code]);
  if (!card) throw new ApiError(1, "卡密不存在");
  if (card.status === "used") throw new ApiError(1, "该卡密已被使用");

  db.transaction(() => {
    const still = db.get("SELECT * FROM card_keys WHERE code=?", [code]);
    if (!still || still.status === "used") throw new ApiError(1, "该卡密已被使用");
    db.run("UPDATE card_keys SET status='used', used_by=?, used_at=unixepoch() WHERE id=?", [req.user.id, still.id]);
    db.run("UPDATE users SET balance=balance+? WHERE id=?", [card.amount, req.user.id]);
    db.run("INSERT INTO wallet_transactions(user_id,amount,type,remark) VALUES(?,?,?,?)", [
      req.user.id,
      card.amount,
      "recharge",
      `卡密兑换 (${card.code})`,
    ]);
  });
  ok(res, { amount: card.amount }, `充值成功，到账 ¥${card.amount}`);
}));

// 卡密说明(站点设置, 后台维护)
router.get("/info", wrap(async (req, res) => {
  ok(res, { note: settings.get("site.card_redeem_notice") || "", balanceEnable: settings.get("pay.enable_balance") });
}));

// ================= 管理侧 =================
const admin = require("express").Router();
admin.use(auth(), adminOnly, requirePerm("card.manage"));

admin.get("/", wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const status = req.query.status || "";
  const batch = req.query.batch || "";
  const where = [];
  const params = [];
  if (status) { where.push("status=?"); params.push(status); }
  if (batch) { where.push("batch=?"); params.push(batch); }
  const w = where.length ? " WHERE " + where.join(" AND ") : "";
  const rows = db.all(
    `SELECT c.*, u.email AS used_by_email FROM card_keys c LEFT JOIN users u ON c.used_by=u.id
     ${w} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = db.get(`SELECT COUNT(*) AS c FROM card_keys c ${w}`, params);
  const stat = db.get(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status='unused' THEN 1 ELSE 0 END) AS unused, SUM(CASE WHEN status='used' THEN 1 ELSE 0 END) AS used FROM card_keys"
  );
  ok(res, { list: rows, total: total.c, page, limit, stat: { total: stat.total||0, unused: stat.unused||0, used: stat.used||0 } });
}));

// 批量生成
admin.post("/batch", wrap(async (req, res) => {
  const { count = 50, amount = 10, prefix = "JC", batch = "" } = req.body || {};
  const n = Math.min(10000, Math.max(1, parseInt(count, 10) || 50));
  if (!(parseFloat(amount) > 0)) throw new ApiError(1, "面值无效");
  const batchName = String(batch || new Date().toISOString().slice(0, 10));
  const codes = [];
  db.transaction(() => {
    for (let i = 0; i < n; i++) {
      const code = `${prefix.toUpperCase()}-${genCode(16)}`;
      db.run("INSERT OR IGNORE INTO card_keys(code,amount,batch) VALUES(?,?,?)", [code, amount, batchName]);
      codes.push(code);
    }
  });
  ok(res, { count: codes.length, codes, batch: batchName, amount }, `生成 ${codes.length} 张面值 ¥${amount} 的卡密`);
}));

// 导出(纯文本, 每行一个)
admin.get("/export", wrap(async (req, res) => {
  const batch = req.query.batch || "";
  const rows = batch
    ? db.all("SELECT code,amount FROM card_keys WHERE batch=? AND status='unused' ORDER BY id ASC", [batch])
    : db.all("SELECT code,amount FROM card_keys WHERE status='unused' ORDER BY id ASC");
  const text = rows.map((r) => `${r.code}\t${r.amount}`).join("\n");
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="card_keys.txt"');
  return res.send(text || "(no unused cards)");
}));

// 作废
admin.delete("/:id", wrap(async (req, res) => {
  const c = db.get("SELECT * FROM card_keys WHERE id=?", [req.params.id]);
  if (!c) throw new ApiError(404, "卡密不存在", 404);
  db.run("DELETE FROM card_keys WHERE id=?", [c.id]);
  ok(res, null, "已作废");
}));

router.use("/admin", admin);

module.exports = router;
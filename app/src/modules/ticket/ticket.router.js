// ============================================================
//  工单模块
//  用户：提交/追加工单/查看对话
//  管理：工单队列/回复/关闭/按紧急度排序
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm } = require("../../services/permission.service");
const settings = require("../../services/settings.service");
const notify = require("../../services/notify.service");

function safeParse(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }

// ================= 用户侧 =================

// 我的工单列表
router.get("/list", auth(), wrap(async (req, res) => {
  const rows = db.all("SELECT * FROM tickets WHERE user_id=? ORDER BY id DESC LIMIT 100", [req.user.id]);
  ok(res, rows);
}));

// 工单详情(含消息)
router.get("/:id", auth(), wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  const messages = db.all("SELECT id,is_admin,content,created_at FROM ticket_messages WHERE ticket_id=? ORDER BY id ASC", [t.id]);
  ok(res, { ticket: t, messages });
}));

// 提交工单
router.post("/create", auth(), wrap(async (req, res) => {
  const { subject, content, level } = req.body || {};
  if (!subject || !content) throw new ApiError(1, "主题与内容必填");
  if (String(content).length < 5) throw new ApiError(1, "内容至少5个字");
  const id = db.transaction(() => {
    db.run(
      "INSERT INTO tickets(user_id,subject,content,level,last_reply_by,last_reply_at) VALUES(?,?,?,?,?,unixepoch())",
      [req.user.id, subject, content, level === "urgent" ? "urgent" : "normal", req.user.id]
    );
    const tid = db.lastInsertId();
    db.run("INSERT INTO ticket_messages(ticket_id,user_id,is_admin,content) VALUES(?,?,0,?)", [tid, req.user.id, content]);
    return tid;
  });
  const t = db.get("SELECT * FROM tickets WHERE id=?", [id]);
  // 推送运营者(TG/邮件, 配置了才发)
  notify.send({
    title: `新工单 #${id} ${subject}`,
    content: `用户 ${req.user.email} 提交：${content}`,
    tgText: `📮 新工单 #${id} [${level === "urgent" ? "紧急" : "普通"}]\n${subject}\n${content}`,
  }).catch(() => {});
  ok(res, t, "工单已提交");
}));

// 用户追加工单消息
router.post("/:id/reply", auth(), wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  if (t.status === "closed") throw new ApiError(1, "工单已关闭，如需帮助请重新提交");
  const { content } = req.body || {};
  if (!content || String(content).length < 2) throw new ApiError(1, "内容至少2个字");
  db.transaction(() => {
    db.run("INSERT INTO ticket_messages(ticket_id,user_id,is_admin,content) VALUES(?,?,0,?)", [t.id, req.user.id, content]);
    db.run("UPDATE tickets SET last_reply_by=?, last_reply_at=unixepoch() WHERE id=?", [req.user.id, t.id]);
  });
  notify.send({
    title: `工单 #${t.id} 有新回复`,
    content: `${req.user.email}：${content}`,
  }).catch(() => {});
  ok(res, null, "回复已提交");
}));

// 用户关闭工单
router.post("/:id/close", auth(), wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  db.run("UPDATE tickets SET status='closed', closed_at=unixepoch(), last_reply_by=?, last_reply_at=unixepoch() WHERE id=?", [req.user.id, t.id]);
  ok(res, null, "工单已关闭");
}));

// ================= 管理侧 =================
const admin = require("express").Router();
admin.use(auth(), adminOnly, requirePerm("ticket.manage"));

// 工单队列(可按状态筛选)
admin.get("/", wrap(async (req, res) => {
  const st = req.query.status || "";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const where = st ? " WHERE status=?" : "";
  const params = st ? [st] : [];
  const rows = db.all(
    `SELECT t.*, u.email, u.nickname FROM tickets t LEFT JOIN users u ON t.user_id=u.id
     ${where} ORDER BY (t.level='urgent') DESC, t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = db.get(`SELECT COUNT(*) AS c FROM tickets t ${where}`, params);
  ok(res, { list: rows, total: total.c, page, limit });
}));

// 工单详情
admin.get("/:id", wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=?", [req.params.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  const messages = db.all(
    "SELECT m.*, u.email FROM ticket_messages m LEFT JOIN users u ON m.user_id=u.id WHERE m.ticket_id=? ORDER BY m.id ASC",
    [t.id]
  );
  ok(res, { ticket: t, messages });
}));

// 管理员回复
admin.post("/:id/reply", wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=?", [req.params.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  const { content } = req.body || {};
  if (!content || String(content).length < 1) throw new ApiError(1, "回复内容必填");
  db.transaction(() => {
    db.run("INSERT INTO ticket_messages(ticket_id,user_id,is_admin,content) VALUES(?,?,1,?)", [t.id, req.user.id, content]);
    db.run("UPDATE tickets SET status='open', admin_replied=1, last_reply_by=?, last_reply_at=unixepoch() WHERE id=?", [req.user.id, t.id]);
  });
  // 通知用户
  const user = db.get("SELECT * FROM users WHERE id=?", [t.user_id]);
  notify.send({
    userId: t.user_id,
    email: user ? user.email : undefined,
    title: `工单 #${t.id} 管理员已回复`,
    content,
    type: "ticket_reply",
  }).catch(() => {});
  ok(res, null, "已回复");
}));

// 管理员关闭/重开
admin.post("/:id/status", wrap(async (req, res) => {
  const t = db.get("SELECT * FROM tickets WHERE id=?", [req.params.id]);
  if (!t) throw new ApiError(404, "工单不存在", 404);
  const status = req.body.status === "open" ? "open" : "closed";
  db.run("UPDATE tickets SET status=?, closed_at=? WHERE id=?", [status, status === "closed" ? Math.floor(Date.now()/1000) : null, t.id]);
  ok(res, null, "状态已更新");
}));

router.use("/admin", admin);

module.exports = router;
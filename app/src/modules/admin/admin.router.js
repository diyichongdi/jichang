// ============================================================
//  管理端模块
//  统计 / 用户管理 / 订单 / 公告 / 套餐 / 钱包 / 设置
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm } = require("../../services/permission.service");

router.use(auth(), adminOnly);

// ---- 控制台统计 ----
router.get(
  "/stats",
  wrap(async (req, res) => {
    const u = db.get("SELECT COUNT(*) AS c FROM users");
    const o = db.get("SELECT COUNT(*) AS c, IFNULL(SUM(amount),0) AS amt FROM orders WHERE status='paid'");
    const p = db.get("SELECT COUNT(*) AS c FROM orders WHERE status='paid' AND type='plan'");
    const bal = db.get("SELECT IFNULL(SUM(balance),0) AS total FROM users");
    const today = Math.floor(Date.now() / 86400000) * 86400;
    const todayOrders = db.get("SELECT COUNT(*) AS c, IFNULL(SUM(amount),0) AS amt FROM orders WHERE status='paid' AND paid_at>=?", [today]);
    const openTickets = db.get("SELECT COUNT(*) AS c FROM tickets WHERE status='open'");
    const unusedCards = db.get("SELECT COUNT(*) AS c FROM card_keys WHERE status='unused'");
    ok(res, {
      totalUsers: u.c,
      totalPaidOrders: o.c,
      totalRevenue: o.amt,
      activeSubscriptions: p.c,
      totalBalance: bal.total,
      todayOrders: todayOrders.c,
      todayRevenue: todayOrders.amt,
      openTickets: openTickets.c,
      unusedCards: unusedCards.c,
    });
  })
);

// ---- 统计：近 N 日收入/订单趋势(chart) ----
router.get(
  "/stats/trend",
  wrap(async (req, res) => {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const today = Math.floor(Date.now() / 86400000) * 86400;
    const since = today - (days - 1) * 86400;
    const rows = db.all(
      "SELECT (paid_at/86400)*86400 AS d, COUNT(*) AS n, IFNULL(SUM(amount),0) AS amt FROM orders WHERE status='paid' AND paid_at>=? GROUP BY d ORDER BY d ASC",
      [since]
    );
    const map = {};
    rows.forEach((r) => (map[r.d] = r));
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = since + i * 86400;
      const r = map[d] || { amt: 0, n: 0 };
      const dt = new Date(d * 1000);
      out.push({
        date: `${dt.getMonth() + 1}-${dt.getDate()}`,
        ts: d,
        amount: r.amt,
        orders: r.n,
      });
    }
    ok(res, out);
  })
);

// ---- 用户列表 ----
router.get(
  "/users",
  wrap(async (req, res) => {
    const kw = req.query.keyword ? `%${req.query.keyword}%` : "%";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const rows = db.all(
      "SELECT id,email,nickname,role,email_verified,status,balance,plan_id,plan_expire_at,created_at FROM users WHERE email LIKE ? OR nickname LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [kw, kw, limit, offset]
    );
    const total = db.get("SELECT COUNT(*) AS c FROM users WHERE email LIKE ? OR nickname LIKE ?", [kw, kw]);
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

// ---- 用户详情(含钱包流水) ----
router.get(
  "/users/:id",
  requirePerm("user.view"),
  wrap(async (req, res) => {
    const user = db.get("SELECT id,email,nickname,role,email_verified,status,balance,total_traffic,plan_id,plan_expire_at,referral_code,referrer_id,last_login_at,created_at FROM users WHERE id=?", [req.params.id]);
    if (!user) throw new ApiError(404, "用户不存在", 404);
    const plan = user.plan_id ? db.get("SELECT * FROM plans WHERE id=?", [user.plan_id]) : null;
    const orders = db.all("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 20", [user.id]);
    const wallet = db.all("SELECT * FROM wallet_transactions WHERE user_id=? ORDER BY id DESC LIMIT 20", [user.id]);
    const referrals = db.all("SELECT id,email,nickname,balance,created_at FROM users WHERE referrer_id=? ORDER BY id DESC LIMIT 10", [user.id]);
    ok(res, { user, plan, orders, wallet, referrals });
  })
);

// ---- 修改用户状态/余额/角色 ----
router.put(
  "/users/:id",
  requirePerm("user.manage"),
  wrap(async (req, res) => {
    const u = db.get("SELECT * FROM users WHERE id=?", [req.params.id]);
    if (!u) throw new ApiError(404, "用户不存在", 404);
    if (u.role === "superadmin" && req.user.role !== "superadmin")
      throw new ApiError(1, "无权修改超级管理员");
    const { status, balance, role } = req.body || {};
    // 角色仅允许 user/admin; 授予/取消 admin 权限仅超级管理员可操作, 防止自提权
    let nextRole = u.role;
    if (role !== undefined && String(role) !== u.role) {
      if (u.role === "superadmin") throw new ApiError(1, "超级管理员角色不可修改");
      const r = String(role);
      if (r !== "user" && r !== "admin") throw new ApiError(1, "非法角色");
      if (r === "admin" && req.user.role !== "superadmin")
        throw new ApiError(1, "仅有超级管理员可授权管理员");
      nextRole = r;
    }
    db.run("UPDATE users SET status=?, balance=?, role=? WHERE id=?", [
      status ?? u.status,
      balance !== undefined ? balance : u.balance,
      nextRole,
      u.id,
    ]);
    ok(res, null, "已更新");
  })
);

// ---- 调整余额(钱包流水记账) ----
router.post(
  "/users/:id/wallet",
  requirePerm("user.manage"),
  wrap(async (req, res) => {
    const { amount, type, remark } = req.body || {};
    if (amount == null || !type) throw new ApiError(1, "amount/type 必填");
    const u = db.get("SELECT * FROM users WHERE id=?", [req.params.id]);
    if (!u) throw new ApiError(404, "用户不存在", 404);
    const before = u.balance;
    const after = before + Number(amount);
    db.transaction(() => {
      db.run("UPDATE users SET balance=? WHERE id=?", [after, u.id]);
      db.run(
        "INSERT INTO wallet_transactions(user_id,amount,type,remark) VALUES(?,?,?,?)",
        [u.id, amount, type, remark || "管理员操作"]
      );
    });
    ok(res, { balance: after }, "余额已调整");
  })
);

// ---- 订单列表 ----
router.get(
  "/orders",
  requirePerm("order.view"),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    let where = "1=1";
    const params = [];
    if (status) {
      where += " AND status=?";
      params.push(status);
    }
    const rows = db.all(
      `SELECT * FROM orders WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const total = db.get(`SELECT COUNT(*) AS c FROM orders WHERE ${where}`, params);
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

// ---- 订单详情/改状态 ----
router.put(
  "/orders/:id",
  requirePerm("order.manage"),
  wrap(async (req, res) => {
    const o = db.get("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!o) throw new ApiError(404, "订单不存在", 404);
    const { status } = req.body || {};
    if (status === "paid" && o.status !== "paid") {
      // 触发履约逻辑(复用 order.service, 由它置 paid 并开通/充值, 避免先将状态置 paid 导致幂等跳过)
      const orderService = require("../../modules/order/order.service");
      await orderService.markOrderPaid({ orderNo: o.order_no, provider: "admin", method: "admin" });
    } else if (status) {
      db.run("UPDATE orders SET status=? WHERE id=?", [status, o.id]);
    }
    ok(res, null, "已更新");
  })
);

// ---- 公告列表 ----
router.get("/notices", requirePerm("notice.manage"), wrap(async (req, res) => ok(res, db.all("SELECT * FROM notices ORDER BY pinned DESC, id DESC"))));
router.post(
  "/notices",
  requirePerm("notice.manage"),
  wrap(async (req, res) => {
    const { title, content, pinned = 0, on_sale = 1 } = req.body || {};
    if (!title) throw new ApiError(1, "标题必填");
    db.run("INSERT INTO notices(title,content,pinned,on_sale) VALUES(?,?,?,?)", [title, content || "", pinned ? 1 : 0, on_sale !== undefined ? on_sale : 1]);
    ok(res, null, "公告已发布");
  })
);
router.put(
  "/notices/:id",
  requirePerm("notice.manage"),
  wrap(async (req, res) => {
    const n = db.get("SELECT * FROM notices WHERE id=?", [req.params.id]);
    if (!n) throw new ApiError(404, "公告不存在", 404);
    const { title, content, pinned, on_sale } = req.body || {};
    db.run("UPDATE notices SET title=?, content=?, pinned=?, on_sale=? WHERE id=?", [
      title ?? n.title,
      content !== undefined ? content : n.content,
      pinned !== undefined ? (pinned ? 1 : 0) : n.pinned,
      on_sale !== undefined ? (on_sale ? 1 : 0) : n.on_sale,
      n.id,
    ]);
    ok(res, null, "已更新");
  })
);
router.delete(
  "/notices/:id",
  requirePerm("notice.manage"),
  wrap(async (req, res) => {
    db.run("DELETE FROM notices WHERE id=?", [req.params.id]);
    ok(res, null, "已删除");
  })
);

// ---- 套餐管理 ----
router.get("/plans", requirePerm("plan.manage"), wrap(async (req, res) => ok(res, db.all("SELECT * FROM plans ORDER BY sort"))));

// ---- 钱包流水(全站) ----
router.get(
  "/wallet",
  requirePerm("payment.view"),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const type = req.query.type;
    let where = "1=1";
    const params = [];
    if (type) {
      where += " AND type=?";
      params.push(type);
    }
    const rows = db.all(
      `SELECT wt.*, u.email, u.nickname FROM wallet_transactions wt LEFT JOIN users u ON wt.user_id=u.id WHERE ${where} ORDER BY wt.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const total = db.get(`SELECT COUNT(*) AS c FROM wallet_transactions wt LEFT JOIN users u ON wt.user_id=u.id WHERE ${where}`, params);
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

// ---- 支付流水(原始回调审计 / 对账) ----
router.get(
  "/payments",
  requirePerm("payment.view"),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const provider = req.query.provider || "";
    const status = req.query.status || "";
    const params = [];
    const where = [];
    if (provider) { where.push("p.provider=?"); params.push(provider); }
    if (status) { where.push("p.status=?"); params.push(status); }
    const w = where.length ? " WHERE " + where.join(" AND ") : "";
    const rows = db.all(
      `SELECT p.*, o.status AS order_status, o.amount, o.type AS order_type, u.email
       FROM payments p
       LEFT JOIN orders o ON p.order_no=o.order_no
       LEFT JOIN users u ON o.user_id=u.id
       ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const total = db.get(`SELECT COUNT(*) AS c FROM payments p ${w}`, params);
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

// ---- 邀请返佣明细(全站) ----
router.get(
  "/commissions",
  requirePerm("payment.view"),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const rows = db.all(
      `SELECT c.*, u.email AS user_email, f.email AS from_email
       FROM commission_records c
       LEFT JOIN users u ON c.user_id=u.id
       LEFT JOIN users f ON c.from_user_id=f.id
       ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const total = db.get("SELECT COUNT(*) AS c FROM commission_records");
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

module.exports = router;

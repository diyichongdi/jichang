// ============================================================
//  用户中心模块
//  资料 / 订阅信息 / 流量 / 充值入口 / 钱包 / 邀请
// ============================================================
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth } = require("../../middleware/auth");

function publicPlan(p) {
  if (!p) return null;
  return { id: p.id, name: p.name, traffic: p.traffic, devices: p.devices, cycle: p.cycle };
}

// ---- 我的订阅/账户总览 ----
router.get(
  "/overview",
  auth(),
  wrap(async (req, res) => {
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    const plan = user.plan_id ? db.get("SELECT * FROM plans WHERE id=?", [user.plan_id]) : null;
    ok(res, {
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      balance: user.balance,
      plan: publicPlan(plan),
      planExpireAt: user.plan_expire_at,
      emailVerified: !!user.email_verified,
      referralCode: user.referral_code,
      subscribeUrl: user.plan_id ? require("../../services/xboard.service").getSubscription(user).subscription : null,
    });
  })
);

// ---- 流量/订阅详情 (用于 Dashboard) ----
router.get(
  "/traffic",
  auth(),
  wrap(async (req, res) => {
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    const plan = user.plan_id ? db.get("SELECT * FROM plans WHERE id=?", [user.plan_id]) : null;
    const xboard = require("../../services/xboard.service");
    const traffic = await xboard.syncTraffic(user);
    const total = plan ? plan.traffic * 1024 * 1024 * 1024 : 0; // GB -> bytes
    const used = traffic.used || 0;
    ok(res, {
      total,
      used,
      remaining: total > 0 ? Math.max(0, total - used) : 0,
      expired: total > 0 && used >= total,
      resetDay: plan ? 1 : null, // 月初重置
      provider: traffic.note,
    });
  })
);

// ---- 钱包/余额变动记录 ----
router.get(
  "/wallet",
  auth(),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const rows = db.all(
      "SELECT id, type, amount, order_no, remark, created_at FROM wallet_transactions WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
      [req.user.id, limit, offset]
    );
    const total = db.get("SELECT COUNT(*) AS c FROM wallet_transactions WHERE user_id=?", [req.user.id]);
    ok(res, { list: rows, total: total.c, page, limit });
  })
);

// ---- 邀请/返佣 ----
router.get(
  "/invite",
  auth(),
  wrap(async (req, res) => {
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    const referrals = db.all(
      "SELECT id, email, nickname, balance, created_at FROM users WHERE referrer_id=? ORDER BY id DESC LIMIT 50",
      [user.id]
    );
    const totalInvited = db.get("SELECT COUNT(*) AS c FROM users WHERE referrer_id=?", [user.id]);
    ok(res, {
      code: user.referral_code,
      url: `${(require("../../config").webUrl || require("../../config").baseUrl).replace(/\/+$/, "")}/dashboard.html?ref=${user.referral_code}#/dashboard`,
      bonus: require("../../services/settings.service").get("site.invite_bonus"),
      referrals,
      totalInvited: totalInvited.c,
    });
  })
);

// ---- 站内通知(系统/到期/订单等) ----
router.get(
  "/notifications",
  auth(),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const rows = db.all(
      "SELECT id,type,title,content,read,created_at FROM user_notifications WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
      [req.user.id, limit, offset]
    );
    const unread = db.get("SELECT COUNT(*) AS c FROM user_notifications WHERE user_id=? AND read=0", [req.user.id]);
    const total = db.get("SELECT COUNT(*) AS c FROM user_notifications WHERE user_id=?", [req.user.id]);
    ok(res, { list: rows, total: total.c, unread: unread.c, page, limit });
  })
);

// ---- 标记通知已读(全部或单条) ----
router.post(
  "/notifications/read",
  auth(),
  wrap(async (req, res) => {
    const { id, all } = req.body || {};
    if (all) {
      db.run("UPDATE user_notifications SET read=1 WHERE user_id=?", [req.user.id]);
    } else if (id) {
      db.run("UPDATE user_notifications SET read=1 WHERE user_id=? AND id=?", [req.user.id, id]);
    } else {
      throw new ApiError(1, "参数缺失(id 或 all)");
    }
    ok(res, null, "已读");
  })
);

// ---- 我的返佣明细 ----
router.get(
  "/commissions",
  auth(),
  wrap(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const rows = db.all(
      `SELECT c.*, f.email AS from_email FROM commission_records c
       LEFT JOIN users f ON c.from_user_id=f.id
       WHERE c.user_id=? ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    const total = db.get("SELECT COUNT(*) AS c FROM commission_records WHERE user_id=?", [req.user.id]);
    const sumRow = db.get("SELECT IFNULL(SUM(amount),0) AS sum FROM commission_records WHERE user_id=?", [req.user.id]);
    ok(res, { list: rows, total: total.c, totalAmount: sumRow.sum, page, limit });
  })
);

// ---- 修改资料 ----
router.put(
  "/profile",
  auth(),
  wrap(async (req, res) => {
    const { nickname } = req.body || {};
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    if (!user) throw new ApiError(404, "用户不存在", 404);
    db.run("UPDATE users SET nickname=?, updated_at=unixepoch() WHERE id=?", [
      nickname || user.nickname,
      user.id,
    ]);
    ok(res, { nickname: nickname || user.nickname }, "已更新");
  })
);

// ---- 修改密码 ----
router.put(
  "/password",
  auth(),
  wrap(async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) throw new ApiError(1, "旧密码和新密码必填");
    if (String(newPassword).length < 8) throw new ApiError(1, "新密码至少8位");
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    if (!bcrypt.compareSync(String(oldPassword), user.password_hash))
      throw new ApiError(1, "旧密码错误");
    const hash = bcrypt.hashSync(String(newPassword), 10);
    db.run("UPDATE users SET password_hash=? WHERE id=?", [hash, user.id]);
    ok(res, null, "密码已修改");
  })
);

// ---- 订阅链接(自管或面板模式) ----
router.get(
  "/subscription",
  auth(),
  wrap(async (req, res) => {
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    const xboard = require("../../services/xboard.service");
    ok(res, xboard.getSubscription(user));
  })
);

module.exports = router;

// ============================================================
//  用户认证模块
//  注册 / 登录 / 邮箱验证 / 找回密码
// ============================================================
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const db = require("../../db");
const { auth, sign } = require("../../middleware/auth");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { sendMail } = require("../../services/mail.service");
const settings = require("../../services/settings.service");
const config = require("../../config");

/** 邮件发送失败不影响主流程(注册/找回密码不被 SMTP 故障阻断) */
async function safeMail(to, subject, html) {
  try {
    await sendMail(to, subject, html);
  } catch (e) {
    console.error("[mail] 发送失败", e);
  }
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    role: u.role,
    emailVerified: !!u.email_verified,
    referralCode: u.referral_code,
    balance: u.balance,
    planId: u.plan_id,
    planExpireAt: u.plan_expire_at,
    createdAt: u.created_at,
  };
}

// ---- 注册 ----
router.post(
  "/register",
  wrap(async (req, res) => {
    const { email, password, nickname, inviteCode } = req.body || {};
    if (!email || !password) throw new ApiError(1, "邮箱和密码必填");
    if (String(password).length < 8) throw new ApiError(1, "密码至少8位");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(1, "邮箱格式不正确");

    // 注册开关(与 settings /public 的 openRegister 保持一致)
    const allowSignup =
      settings.get("sec.allow_signup") !== false && settings.get("site.enable_register") !== false;
    if (!allowSignup) throw new ApiError(1, "注册已关闭", 403);

    const exists = db.get("SELECT id FROM users WHERE email=?", [email]);
    if (exists) throw new ApiError(1, "该邮箱已注册");

    const hash = bcrypt.hashSync(String(password), 10);
    const code = nanoid(8).toUpperCase();
    let referrerId = null;
    if (inviteCode) {
      const r = db.get("SELECT id FROM users WHERE referral_code=?", [String(inviteCode).toUpperCase()]);
      if (r) referrerId = r.id;
    }

    const id = db.transaction(() => {
      db.run(
        "INSERT INTO users(email,password_hash,nickname,referral_code,referrer_id) VALUES(?,?,?,?,?)",
        [email, hash, nickname || email.split("@")[0], code, referrerId]
      );
      return db.lastInsertId();
    });

    // 发送邮箱验证
    const token = nanoid(32);
    db.run(
      "INSERT INTO email_tokens(user_id,token,type,expires_at) VALUES(?,?,?,(unixepoch()+3600))",
      [id, token, "verify_email"]
    );
    const link = `${(config.webUrl || config.baseUrl).replace(/\/+$/, "")}/dashboard.html#/verify-email?token=${token}`;
    await safeMail(email, "邮箱验证", `<p>点击验证邮箱：<a href="${link}">${link}</a> (1小时内有效)</p>`);

    const user = db.get("SELECT * FROM users WHERE id=?", [id]);
    const jwt = sign(user);
    res.status(201).json({
      code: 0,
      msg: "注册成功，请查收邮件完成验证",
      data: { token: jwt, user: publicUser(user) },
    });
  })
);

// ---- 登录 ----
router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw new ApiError(1, "邮箱和密码必填");
    const user = db.get("SELECT * FROM users WHERE email=?", [email]);
    if (!user || !bcrypt.compareSync(String(password), user.password_hash))
      throw new ApiError(1, "邮箱或密码错误");
    if (user.status === "disabled") throw new ApiError(1, "账号已被禁用", 403);
    db.run("UPDATE users SET last_login_at=unixepoch() WHERE id=?", [user.id]);
    const jwt = sign(user);
    ok(res, { token: jwt, user: publicUser(user) }, "登录成功");
  })
);

// ---- 邮箱验证 ----
router.get(
  "/verify-email",
  wrap(async (req, res) => {
    const { token } = req.query;
    if (!token) throw new ApiError(1, "缺少token");
    const t = db.get(
      "SELECT * FROM email_tokens WHERE token=? AND type='verify_email' AND used=0 AND expires_at>unixepoch()",
      [token]
    );
    if (!t) throw new ApiError(1, "链接无效或已过期", 400);
    db.transaction(() => {
      db.run("UPDATE users SET email_verified=1 WHERE id=?", [t.user_id]);
      db.run("UPDATE email_tokens SET used=1 WHERE id=?", [t.id]);
    });
    const user = db.get("SELECT * FROM users WHERE id=?", [t.user_id]);
    const jwt = sign(user);
    // 验证成功后重定向到前端或返回JSON(仅允许站内地址, 防开放重定向)
    if (req.query.redirect) {
      const r = String(req.query.redirect);
      const allowed = [config.webUrl || config.baseUrl, config.baseUrl];
      if (allowed.some((u) => u && r.startsWith(u))) return res.redirect(r);
    }
    ok(res, { token: jwt, user: publicUser(user) }, "邮箱验证成功");
  })
);

// ---- 请求找回密码 ----
router.post(
  "/forgot-password",
  wrap(async (req, res) => {
    const { email } = req.body || {};
    if (!email) throw new ApiError(1, "邮箱必填");
    const user = db.get("SELECT id FROM users WHERE email=?", [email]);
    if (!user) return ok(res, null, "若邮箱存在将发送重置邮件"); // 防枚举
    const token = nanoid(32);
    db.run(
      "INSERT INTO email_tokens(user_id,token,type,expires_at) VALUES(?,?,'reset_password',unixepoch()+1800)",
      [user.id, token]
    );
    const link = `${(config.webUrl || config.baseUrl).replace(/\/+$/, "")}/dashboard.html#/reset-password?token=${token}`;
    await safeMail(email, "重置密码", `<p>重置密码：<a href="${link}">${link}</a> (30分钟内有效)</p>`);
    ok(res, null, "已发送重置邮件");
  })
);

// ---- 确认重置密码 ----
router.post(
  "/reset-password",
  wrap(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) throw new ApiError(1, "token和密码必填");
    if (String(password).length < 8) throw new ApiError(1, "密码至少8位");
    const t = db.get(
      "SELECT * FROM email_tokens WHERE token=? AND type='reset_password' AND used=0 AND expires_at>unixepoch()",
      [token]
    );
    if (!t) throw new ApiError(1, "链接无效或已过期", 400);
    const hash = bcrypt.hashSync(String(password), 10);
    db.transaction(() => {
      db.run("UPDATE users SET password_hash=? WHERE id=?", [hash, t.user_id]);
      db.run("UPDATE email_tokens SET used=1 WHERE id=?", [t.id]);
    });
    ok(res, null, "密码已重置");
  })
);

// ---- 获取当前用户 ----
router.get(
  "/me",
  auth(),
  wrap(async (req, res) => {
    const user = db.get("SELECT * FROM users WHERE id=?", [req.user.id]);
    if (!user) throw new ApiError(404, "用户不存在", 404);
    ok(res, publicUser(user));
  })
);

module.exports = router;

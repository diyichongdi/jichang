// ============================================================
//  JWT 鉴权中间件
// ============================================================
const jwt = require("jsonwebtoken");
const config = require("../config");

/** 从请求取 Bearer token */
function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

/** 普通登录鉴权 (可选: 传 {optional:true} 可通过未登录请求) */
function auth({ optional = false } = {}) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      if (optional) return next();
      return res.status(401).json({ code: 401, msg: "未登录" });
    }
    try {
      req.user = jwt.verify(token, config.jwt.secret);
      next();
    } catch (e) {
      if (optional) return next();
      return res.status(401).json({ code: 401, msg: "登录已过期" });
    }
  };
}

/** 管理员鉴权 */
function adminOnly(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin"))
    return res.status(403).json({ code: 403, msg: "无权限" });
  next();
}

/** 签发 token */
function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { auth, adminOnly, sign, extractToken };

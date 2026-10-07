// ============================================================
//  模块化权限服务
//  管理员可被授予细粒度权限点(point)。超级管理员(owner)拥有全部。
//  权限点存于 admin_perms(user_id, perm)，配套 settings 的 KV 设置。
// ============================================================
const db = require("../db");

/** 权限点目录：key = 权限点, label = 中文说明, group = 分组 */
const PERMISSIONS = [
  { group: "用户", key: "user.view", label: "查看用户" },
  { group: "用户", key: "user.manage", label: "用户管理(改资料/禁用/调余额)" },
  { group: "订单", key: "order.view", label: "查看订单" },
  { group: "订单", key: "order.manage", label: "订单管理(退款/改状态)" },
  { group: "套餐", key: "plan.manage", label: "套餐管理(增删改)" },
  { group: "支付", key: "payment.view", label: "查看支付流水" },
  { group: "支付", key: "payment.manage", label: "支付补单/对账" },
  { group: "公告", key: "notice.manage", label: "公告/通知管理" },
  { group: "节点", key: "node.manage", label: "节点/线路管理(含流量明细)" },
  { group: "工单", key: "ticket.manage", label: "工单处理(回复/关闭)" },
  { group: "营销", key: "coupon.manage", label: "优惠码管理" },
  { group: "营销", key: "card.manage", label: "卡密管理(生成/核销记录)" },
  { group: "设置", key: "setting.manage", label: "系统设置" },
  { group: "权限", key: "perm.manage", label: "管理员授权(修改他人权限)" },
];

/** 全部权限 key 集合 */
function allPerms() {
  return PERMISSIONS.map((p) => p.key);
}

/** 按分组返回目录 */
function catalog() {
  return PERMISSIONS;
}

/**
 * 某项权限是否拥有。
 * user: DB 行(含 role) 或 {role,id}
 * - superadmin 拥有全部
 */
function hasPerm(user, perm) {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.perms && Array.isArray(user.perms)) return user.perms.includes(perm);
  return false;
}

/** 取某用户的权限集合 */
function permsOf(userId) {
  const rows = db.all("SELECT perm FROM admin_perms WHERE user_id=?", [userId]);
  return rows.map((r) => r.perm);
}

/** 覆盖式设置权限(先清再写) */
function setPerms(userId, perms) {
  db.transaction(() => {
    db.run("DELETE FROM admin_perms WHERE user_id=?", [userId]);
    const list = Array.isArray(perms) ? perms : [];
    for (const p of list) db.run("INSERT OR IGNORE INTO admin_perms(user_id,perm) VALUES(?,?)", [userId, p]);
  });
}

/**
 * Express 中间件：校验指定权限点。
 * 用法：requirePerm("user.manage")
 * superadmin 或 role=admin 且拥有该权限点才放行。
 */
function requirePerm(perm) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ code: 401, msg: "未登录" });
    if (user.role === "superadmin") return next();
    if (user.role === "admin") {
      // 实时从库取(避免 token 过期后权限变更失效)
      if (permsOf(user.id).includes(perm)) return next();
      return res.status(403).json({ code: 403, msg: "无权限: " + perm });
    }
    return res.status(403).json({ code: 403, msg: "无权限" });
  };
}

module.exports = { PERMISSIONS, allPerms, catalog, hasPerm, permsOf, setPerms, requirePerm };

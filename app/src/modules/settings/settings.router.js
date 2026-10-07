// ============================================================
//  设置模块 (公开配置 + 管理读写)
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm, allPerms, catalog, permsOf, setPerms, PERMISSIONS } = require("../../services/permission.service");
const settings = require("../../services/settings.service");

// ---- 公开：站点公开配置 ----
router.get(
  "/public",
  wrap(async (req, res) => {
    const siteName = settings.get("site.name");
    const siteSlogan = settings.get("site.slogan");
    const siteDesc = settings.get("site.desc");
    const announce = settings.get("site.announce");
    const openRegister = settings.get("sec.allow_signup") && settings.get("site.enable_register");
    const minRecharge = settings.get("pay.min_recharge");
    const currency = settings.get("pay.currency");
    const themes = settings
      .get("ui.themes_enabled", "dark,aqua,midnight,aurora,violet")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // 站点内容(后台可配, 覆盖落地页静态配置; 空值=用前端默认)
    const content = {
      heroTitle: settings.get("content.hero_title"),
      heroSub: settings.get("content.hero_sub"),
      slogan: settings.get("content.slogan"),
      showFeatures: settings.get("content.show_features"),
      showNodes: settings.get("content.show_nodes"),
      showPlans: settings.get("content.show_plans"),
      showDocs: settings.get("content.show_docs"),
      showFaq: settings.get("content.show_faq"),
      showTrust: settings.get("content.show_trust"),
      features: settings.get("content.features"),
      faqs: settings.get("content.faqs"),
      trust: settings.get("content.trust"),
      docs: settings.get("content.docs"),
      plans: settings.get("content.plans"),
      nodes: settings.get("content.nodes"),
    };
    ok(res, {
      siteName,
      siteSlogan,
      siteDesc,
      announce,
      openRegister,
      minRecharge,
      currency,
      themes,
      content,
      serverTime: Date.now(),
      version: 2,
    });
  })
);

// ---- 管理：全部设置 ----
router.get(
  "/admin",
  auth(),
  adminOnly,
  requirePerm("setting.manage"),
  wrap(async (req, res) => {
    ok(res, settings.all());
  })
);

// ---- 管理：批量保存设置 ----
router.put(
  "/admin",
  auth(),
  adminOnly,
  requirePerm("setting.manage"),
  wrap(async (req, res) => {
    const body = req.body || {};
    const { values, types } = body;
    if (!values || typeof values !== "object") throw new ApiError(1, "values 必填");
    settings.setMany(values, types || null);
    ok(res, settings.all(), "设置已保存");
  })
);

// ---- 管理：重置某设置为默认 ----
router.delete(
  "/admin/:key",
  auth(),
  adminOnly,
  requirePerm("setting.manage"),
  wrap(async (req, res) => {
    db.run("DELETE FROM settings WHERE key=?", [req.params.key]);
    ok(res, settings.get(req.params.key), "已重置");
  })
);

// ---- 管理：权限点目录 ----
router.get(
  "/admin/perms/catalog",
  auth(),
  adminOnly,
  requirePerm("perm.manage"),
  wrap(async (req, res) => {
    ok(res, { groups: catalog(), all: allPerms() });
  })
);

// ---- 管理：某管理员已授权权限 ----
router.get(
  "/admin/perms/:userId",
  auth(),
  adminOnly,
  requirePerm("perm.manage"),
  wrap(async (req, res) => {
    ok(res, permsOf(parseInt(req.params.userId, 10)));
  })
);

// ---- 管理：设置管理员权限 ----
router.put(
  "/admin/perms/:userId",
  auth(),
  adminOnly,
  requirePerm("perm.manage"),
  wrap(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const target = db.get("SELECT * FROM users WHERE id=?", [userId]);
    if (!target) throw new ApiError(404, "用户不存在", 404);
    if (target.role === "superadmin") throw new ApiError(1, "超级管理员权限不可修改");
    let perms = Array.isArray(req.body.perms) ? req.body.perms : [];
    const valid = new Set(allPerms());
    perms = perms.filter((p) => valid.has(p));
    if (target.role === "user") throw new ApiError(1, "该用户不是管理员");
    setPerms(userId, perms);
    ok(res, perms, "权限已更新");
  })
);

module.exports = router;

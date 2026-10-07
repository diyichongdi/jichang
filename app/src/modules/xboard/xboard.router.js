// ============================================================
//  Xboard 订阅/流量模块 (路由)
//   - GET /api/xboard/subscribe           生成订阅内容(自管模式, 多格式)
//   - POST /api/xboard/traffic/report     节点后端回写流量
//   - GET  /api/xboard/traffic?token=     流量查询(客户端/面板拉取)
// 用户中心侧也可通过 /api/user/overview 看到订阅地址。
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, wrap } = require("../../middleware/error");
const xboard = require("../../services/xboard.service");

// 订阅内容下发(自管模式; 可指定格式 v2ray/clash/singbox)
// 常见客户端 UA 可自动识别格式
function detectFormat(req) {
  const fmt = req.query.format || req.query.flag;
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  if (fmt !== undefined) return String(fmt).toLowerCase();
  if (ua.includes("clash")) return "clash";
  if (ua.includes("sing-box") || ua.includes("singbox")) return "singbox";
  return "v2ray";
}

router.get(
  "/subscribe",
  wrap(async (req, res) => {
    const token = req.query.token || req.query.sub_token || "";
    const parsed = xboard.parseSubToken(token);
    if (!parsed) return res.status(401).json({ code: 1, msg: "订阅token无效" });
    const user = db.get("SELECT * FROM users WHERE id=?", [parsed.userId]);
    if (!user) return res.status(404).json({ code: 1, msg: "用户不存在" });
    const selfToken = xboard.subToken(user.id, user.email);
    if (token !== selfToken) return res.status(401).json({ code: 1, msg: "订阅token不匹配" });

    const format = detectFormat(req);
    const body = xboard.renderSubscription(user, format);
    const headers = { "content-disposition": `attachment; filename="aurora-${format}.${format === "clash" ? "yaml" : format === "singbox" ? "json" : "txt"}"` };
    if (format === "v2ray") {
      res.set("Content-Type", "text/plain; charset=utf-8");
    } else if (format === "clash") {
      res.set("Content-Type", "text/yaml; charset=utf-8");
    } else {
      res.set("Content-Type", "application/json; charset=utf-8");
    }
    res.set(headers);
    res.set("Cache-Control", "no-store");
    return res.send(body);
  })
);

// 节点后端/运维回写流量(自管计量)
router.post(
  "/traffic/report",
  wrap(async (req, res) => {
    const token = req.query.token || req.body.token || "";
    const parsed = xboard.parseSubToken(token);
    if (!parsed) return res.status(401).json({ code: 1, msg: "token无效" });
    const user = db.get("SELECT * FROM users WHERE id=?", [parsed.userId]);
    if (!user) return res.status(404).json({ code: 1, msg: "用户不存在" });
    const selfToken = xboard.subToken(user.id, user.email);
    if (token !== selfToken) return res.status(401).json({ code: 1, msg: "token不匹配" });

    const out = xboard.recordFlow({
      userId: user.id,
      nodeId: req.body.node_id,
      up: req.body.up,
      down: req.body.down,
      rate: req.body.rate,
    });
    ok(res, out, "流量已记录");
  })
);

// 流量查询(用于节点/面板拉取)
router.get(
  "/traffic",
  wrap(async (req, res) => {
    const token = req.query.token || "";
    const parsed = xboard.parseSubToken(token);
    if (!parsed) return res.status(401).json({ code: 1, msg: "token无效" });
    const user = db.get("SELECT * FROM users WHERE id=?", [parsed.userId]);
    if (!user) return res.status(404).json({ code: 1, msg: "用户不存在" });
    const data = await xboard.syncTraffic(user);
    return res.json(data);
  })
);

module.exports = router;
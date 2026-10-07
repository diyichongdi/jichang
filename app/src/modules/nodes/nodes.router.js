// ============================================================
//  节点管理模块(自管模式)
//   - 公开状态接口见 modules/public (GET /api/public/nodes)
//   - 管理端：节点 CRUD / 流量手工录入 / 流量明细
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");
const { requirePerm } = require("../../services/permission.service");
const xboard = require("../../services/xboard.service");

router.use(auth(), adminOnly);

// ---- 管理：节点列表 ----
router.get("/", requirePerm("node.manage"), wrap(async (req, res) => {
  ok(res, db.all("SELECT * FROM nodes ORDER BY sort ASC, id ASC"));
}));

// ---- 管理：新建节点 ----
router.post("/", requirePerm("node.manage"), wrap(async (req, res) => {
  const p = pick(req.body);
  if (!p.name) throw new ApiError(1, "节点名称必填");
  const id = db.run(
    `INSERT INTO nodes(name,code,region,host,port,protocol,node_id,security,sni,alpn,flow,rate,latency,load,online,group_name,sort,active)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.name, p.code||"", p.region||"Asia", p.host||"", p.port||0, p.protocol||"vless",
     p.node_id||"", p.security||"none", p.sni||"", p.alpn||"", p.flow||"", p.rate||1,
     p.latency||0, p.load||0, p.online!==false?1:0, p.group_name||"default", p.sort||0,
     p.active!==undefined?p.active:1]
  );
  ok(res, db.get("SELECT * FROM nodes WHERE id=?", [id]), "节点已创建");
}));

// ---- 管理：更新节点 ----
router.put("/:id", requirePerm("node.manage"), wrap(async (req, res) => {
  const n = db.get("SELECT * FROM nodes WHERE id=?", [req.params.id]);
  if (!n) throw new ApiError(404, "节点不存在", 404);
  const p = pick(req.body);
  const f = (k, v) => (v !== undefined ? v : n[k]);
  db.run(
    `UPDATE nodes SET name=?,code=?,region=?,host=?,port=?,protocol=?,node_id=?,security=?,sni=?,alpn=?,flow=?,rate=?,latency=?,load=?,online=?,group_name=?,sort=?,active=? WHERE id=?`,
    [f("name",p.name), f("code",p.code), f("region",p.region), f("host",p.host), f("port",p.port),
     f("protocol",p.protocol), f("node_id",p.node_id), f("security",p.security), f("sni",p.sni),
     f("alpn",p.alpn), f("flow",p.flow), f("rate",p.rate), f("latency",p.latency), f("load",p.load),
     f("online",p.online), f("group_name",p.group_name), f("sort",p.sort), f("active",p.active), n.id]
  );
  ok(res, db.get("SELECT * FROM nodes WHERE id=?", [n.id]), "节点已更新");
}));

// ---- 管理：删除节点 ----
router.delete("/:id", requirePerm("node.manage"), wrap(async (req, res) => {
  const n = db.get("SELECT * FROM nodes WHERE id=?", [req.params.id]);
  if (!n) throw new ApiError(404, "节点不存在", 404);
  db.run("DELETE FROM nodes WHERE id=?", [n.id]);
  ok(res, null, "节点已删除");
}));

// ---- 管理：流量明细(按用户) ----
router.get("/traffic", requirePerm("node.manage"), wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const uid = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
  const where = uid ? " WHERE f.user_id=? " : "";
  const params = uid ? [uid] : [];
  const rows = db.all(
    `SELECT f.*, u.email, n.name AS node_name FROM flow_usages f
     LEFT JOIN users u ON f.user_id=u.id LEFT JOIN nodes n ON f.node_id=n.id
     ${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = db.get(`SELECT COUNT(*) AS c FROM flow_usages f ${where}`, params);
  ok(res, { list: rows, total: total.c, page, limit });
}));

// ---- 管理：手工录入流量(模拟计量) ----
router.post("/traffic", requirePerm("node.manage"), wrap(async (req, res) => {
  const { user_id: userId, up, down, rate, node_id: nodeId } = req.body || {};
  if (!userId || (up == null && down == null)) throw new ApiError(1, "user_id 与 up/down 必填");
  const u = db.get("SELECT id FROM users WHERE id=?", [userId]);
  if (!u) throw new ApiError(404, "用户不存在", 404);
  const out = xboard.recordFlow({ userId, up, down, rate, nodeId });
  ok(res, out, "流量已记录");
}));

/** 白名单字段抽取 */
function pick(body) {
  const b = body || {};
  return {
    name: b.name, code: b.code, region: b.region, host: b.host, port: b.port,
    protocol: b.protocol, node_id: b.node_id, security: b.security, sni: b.sni,
    alpn: b.alpn, flow: b.flow, rate: b.rate, latency: b.latency, load: b.load,
    online: b.online, group_name: b.group_name, sort: b.sort, active: b.active,
  };
}

module.exports = router;
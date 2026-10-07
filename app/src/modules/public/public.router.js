// ============================================================
//  站点公开数据接口 (供落地页消费)
//  /api/public/plans / notices / config
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, wrap } = require("../../middleware/error");
const config = require("../../config");

router.get("/plans", wrap(async (req, res) => {
  const rows = db.all("SELECT id,name,price,price_q,price_y,cycle,traffic,devices,node_group,rate,desc,featured,features FROM plans WHERE active=1 ORDER BY sort,price");
  ok(res, rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    priceQ: p.price_q,
    priceY: p.price_y,
    cycle: p.cycle,
    traffic: p.traffic,
    devices: p.devices,
    nodeGroup: p.node_group,
    rate: p.rate,
    desc: p.desc,
    featured: !!p.featured,
    features: parseFeatures(p.features),
  })));
}));

// 节点状态(自管; 落地页取前6, 用户中心取全部)
router.get("/nodes", wrap(async (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 100);
  const rows = db.all("SELECT * FROM nodes WHERE active=1 ORDER BY sort ASC, id ASC LIMIT ?", [limit]);
  ok(res, rows.map((n) => ({
    id: n.id,
    name: n.name,
    loc: n.name,
    code: n.code,
    region: n.region,
    online: !!n.online,
    latency: n.latency,
    load: n.load,
    protocol: n.protocol,
    nodeGroup: n.group_name,
    rate: n.rate,
  })));
}));

router.get("/notices", wrap(async (req, res) => {
  ok(res, db.all("SELECT id,title,content,pinned,created_at FROM notices WHERE published=1 AND on_sale=1 ORDER BY pinned DESC, id DESC LIMIT 10"));
}));

// 落地页需要的可配置站点信息(品牌等), 生产可从 settings 表读
router.get("/config", wrap(async (req, res) => {
  ok(res, {
    brand: "极光云",
    channels: [], // 由订单渠道接口补充
  });
}));

/** 安全解析卖点 JSON 数组字符串 */
function parseFeatures(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

module.exports = router;

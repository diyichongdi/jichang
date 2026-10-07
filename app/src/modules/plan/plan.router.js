// ============================================================
//  套餐模块 (公开查询 + 管理增删改)
// ============================================================
const router = require("express").Router();
const db = require("../../db");
const { ok, ApiError, wrap } = require("../../middleware/error");
const { auth, adminOnly } = require("../../middleware/auth");

function publicPlan(p) {
  let features = [];
  try { features = Array.isArray(JSON.parse(p.features || "[]")) ? JSON.parse(p.features || "[]") : []; } catch (e) { features = []; }
  return {
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
    features,
  };
}

// ---- 公开：在售套餐 ----
router.get(
  "/",
  wrap(async (req, res) => {
    const rows = db.all("SELECT * FROM plans WHERE active=1 ORDER BY sort ASC, price ASC");
    ok(res, rows.map(publicPlan));
  })
);

// ---- 公开：单个套餐 ----
router.get(
  "/:id",
  wrap(async (req, res) => {
    const p = db.get("SELECT * FROM plans WHERE id=?", [req.params.id]);
    if (!p || !p.active) throw new ApiError(404, "套餐不存在", 404);
    ok(res, publicPlan(p));
  })
);

// ---- 管理：新建 ----
router.post(
  "/",
  auth(),
  adminOnly,
  wrap(async (req, res) => {
    const {
      name,
      price,
      cycle = "month",
      traffic,
      devices = 0,
      nodeGroup,
      rate = 1,
      sort = 0,
      priceQ,
      priceY,
      desc,
      featured = 0,
      features,
    } = req.body;
    if (!name || price == null || traffic == null) throw new ApiError(1, "name/price/traffic 必填");
    db.run(
      "INSERT INTO plans(name,price,price_q,price_y,cycle,traffic,devices,node_group,rate,sort,desc,featured,features) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [name, price, priceQ || null, priceY || null, cycle, traffic, devices, nodeGroup || null, rate, sort, desc || null, featured ? 1 : 0, Array.isArray(features) ? JSON.stringify(features) : null]
    );
    const id = db.lastInsertId();
    const p = db.get("SELECT * FROM plans WHERE id=?", [id]);
    ok(res, publicPlan(p), "创建成功");
  })
);

// ---- 管理：更新 ----
router.put(
  "/:id",
  auth(),
  adminOnly,
  wrap(async (req, res) => {
    const p = db.get("SELECT * FROM plans WHERE id=?", [req.params.id]);
    if (!p) throw new ApiError(404, "套餐不存在", 404);
    const {
      name,
      price,
      cycle,
      traffic,
      devices,
      nodeGroup,
      rate,
      sort,
      active,
      priceQ,
      priceY,
      desc,
      featured,
      features,
    } = req.body;
    db.run(
      "UPDATE plans SET name=?,price=?,price_q=?,price_y=?,cycle=?,traffic=?,devices=?,node_group=?,rate=?,sort=?,active=?,desc=?,featured=?,features=? WHERE id=?",
      [
        name ?? p.name,
        price ?? p.price,
        priceQ !== undefined ? priceQ : p.price_q,
        priceY !== undefined ? priceY : p.price_y,
        cycle ?? p.cycle,
        traffic ?? p.traffic,
        devices ?? p.devices,
        nodeGroup !== undefined ? nodeGroup : p.node_group,
        rate ?? p.rate,
        sort ?? p.sort,
        active !== undefined ? active : p.active,
        desc !== undefined ? desc : p.desc,
        featured !== undefined ? (featured ? 1 : 0) : p.featured,
        features !== undefined ? (Array.isArray(features) ? JSON.stringify(features) : (typeof features === "string" ? features : p.features)) : p.features,
        p.id,
      ]
    );
    ok(res, publicPlan(db.get("SELECT * FROM plans WHERE id=?", [p.id])), "更新成功");
  })
);

// ---- 管理：删除 ----
router.delete(
  "/:id",
  auth(),
  adminOnly,
  wrap(async (req, res) => {
    const p = db.get("SELECT * FROM plans WHERE id=?", [req.params.id]);
    if (!p) throw new ApiError(404, "套餐不存在", 404);
    db.run("DELETE FROM plans WHERE id=?", [p.id]);
    ok(res, null, "删除成功");
  })
);

module.exports = router;

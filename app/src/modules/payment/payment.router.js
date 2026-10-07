// ============================================================
//  支付回调路由 (专用入口)
//  渠道异步通知统一 POST 到这里: /api/payments/notify/:provider
// ============================================================
const express = require("express");
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

const db = require("../../db");
const { wrap } = require("../../middleware/error");
const providers = require("../../payments/providers");
const orderService = require("../order/order.service");

router.post(
  "/notify/:provider",
  wrap(async (req, res) => {
    const provider = req.params.provider;
    let driver;
    try {
      driver = providers.getDriver(provider);
    } catch (e) {
      return res.status(400).send(e.message || "bad provider");
    }
    const body = req.body || {};
    const query = req.query || {};
    const orderKey = body.out_trade_no || body.order_no || body.ref || body.mch_order_no || "unknown";

    // 审计：记录原始回调
    try {
      db.run("INSERT INTO payments(order_no,provider,status,ip,provider_raw) VALUES(?,?,?,?,?)", [
        orderKey,
        provider,
        "notify_raw",
        (req.ip || "").slice(0, 45),
        JSON.stringify(query).slice(0, 2000),
      ]);
    } catch (e) { /* 忽略 */ }

    const v = driver.verify({ query, body });
    if (!v.verified) {
      console.warn(`[notify:${provider}] 验签失败`, v && v.reason);
      return res.status(400).send(driver.buildNotifyResponse({ success: false }));
    }
    try {
      orderService.markOrderPaid({
        orderNo: v.orderNo,
        tradeNo: v.tradeNo,
        provider,
        method: provider,
        extras: v.raw,
      });
      return res.send(driver.buildNotifyResponse({ success: true }));
    } catch (e) {
      console.error(`[notify:${provider}] 履约失败`, e);
      return res.status(422).send(driver.buildNotifyResponse({ success: false }));
    }
  })
);

module.exports = router;

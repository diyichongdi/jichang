// ============================================================
//  账户余额支付 驱动 (内部渠道)
//  用户用钱包余额扣款支付订单，无需外部回调。
// ============================================================
const db = require("../../db");

function enabled() {
  return true;
}

// 内部渠道：createPayment 直接完成扣款(见 order 模块的 balance 分支)
// 这里返回占位以保持接口一致，实际扣款逻辑在 order.service 的 payWithBalance 中。
async function createPayment({ order, amount }) {
  return { payUrl: null, internal: true, raw: { orderNo: order.orderNo } };
}

// 无外部回调：verify 恒为未达成(内部流程不走 notify)
function verify() {
  return { verified: false, reason: "balance is internal" };
}

function buildNotifyResponse({ success }) {
  return success ? "success" : "fail";
}

module.exports = { name: "balance", enabled, createPayment, verify, buildNotifyResponse };

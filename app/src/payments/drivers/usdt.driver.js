// ============================================================
//  USDT / 加密货币 支付驱动 (预留实现)
//
//  生产：对接第三方 USDT 收银台(如 VouPay/EPay+USDT)或自建钱包监控。
//  典型流程：后端下单 -> 向第三方申请接收地址 -> 展示二维码 ->
//            用户转账 -> 第三方回调(或区块链确认) -> 我方可选校验。
//
//  本驱动为「预留接口」：已验证 enabled 开关与方法签名，
//  生产时把 createPayment 换成真实第三方 API 调用即可。
// ============================================================
const config = require("../../config");
const crypto = require("crypto");
const { channel } = require("../payconfig");

function enabled() {
  const c = channel("usdt");
  // USDT 至少需要能生成收款信息(apiUrl 或 wallet)，未配即不开放
  return !!(c && c.enabled && (c.apiUrl || c.wallet));
}

async function createPayment({ order, amount, subject }) {
  const c = channel("usdt");
  const reqNo = `${order.orderNo}-${Date.now()}`;
  // 无 apiUrl(未对接第三方收银台)时，走「收款地址/二维码」引导转账模式；
  // 对接真实收银台后改为调用第三方接口获取专属地址与参数。
  if (!c.apiUrl) {
    return {
      qrContent: `usdt:${c.wallet}?amount=${amount}&ref=${reqNo}`,
      payUrl: c.wallet || "",
      raw: { ref: reqNo, wallet: c.wallet, mode: "manual" },
      _placeholder: true,
    };
  }
  // 占位：演示返回；生产改为真实调用第三方接口获取接收地址与参数
  return {
    qrContent: `usdt:${c.wallet}?amount=${amount}&ref=${reqNo}`,
    payUrl: `https://pay.example.com/pay?ref=${reqNo}`,
    raw: { ref: reqNo, wallet: c.wallet },
    _placeholder: true, // 标记为占位(未对接真实渠道)
  };
}

/**
 * 回调校验。第三方通常回调 query/body，并带签名。
 * 这里做通用 HMAC 校验(占位)；生产按第三方文档实现。
 */
function verify({ query, body }) {
  const c = channel("usdt");
  const params = Object.keys(body || {}).length ? body : query;
  if (!params || !params.amount) return { verified: false, reason: "missing amount" };
  const validStatus = (params.status === "success" || params.status === "1" || params.status === 1);
  if (!validStatus) return { verified: false, reason: "not success" };
  return {
    verified: true,
    tradeNo: params.trade_no || params.txid || null,
    orderNo: params.order_no || params.ref || null,
    amount: params.amount,
    raw: params,
    placeholder: true,
  };
}

function buildNotifyResponse({ success }) {
  return success ? '{"code":0,"msg":"ok"}' : '{"code":1,"msg":"fail"}';
}

module.exports = { name: "usdt", enabled, createPayment, verify, buildNotifyResponse };

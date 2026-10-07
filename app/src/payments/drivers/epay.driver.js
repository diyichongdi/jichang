// ============================================================
//  易支付(彩虹易支付/四方) 驱动 (预留实现)
//  经典 Epay 协议：下单 GET 拼接签名 + 异步通知验签
// ============================================================
const config = require("../../config");
const crypto = require("crypto");
const { channel } = require("../payconfig");

function enabled() {
  const c = channel("epay");
  return !!(c && c.enabled && c.apiUrl && c.pid && c.merchantKey);
}

function md5(str) {
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

/** Epay 签名：参数名排序后拼接 & 末尾加 key */
function sign(params, key) {
  const str = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "" && k !== "sign" && k !== "sign_type")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return md5(str + key);
}

async function createPayment({ order, amount, subject }) {
  const c = channel("epay");
  const params = {
    pid: c.pid,
    type: "alipay",
    out_trade_no: order.orderNo,
    notify_url: `${config.baseUrl}/api/payments/notify/epay`,
    return_url: `${config.webUrl}/dashboard.html#/orders`,
    name: subject,
    money: amount.toFixed(2),
    sign_type: "MD5",
  };
  params.sign = sign(params, c.merchantKey);
  const qs = new URLSearchParams(params).toString();
  return { payUrl: `${c.apiUrl}/submit.php?${qs}`, raw: params };
}

/**
 * 异步通知验签（POST 表单）。
 * Epay 通知：成功时 trade_status=TRADE_SUCCESS，签名为 md5(params+key)。
 */
function verify({ query, body }) {
  const c = channel("epay");
  const params = Object.keys(body || {}).length ? body : query;
  if (!params || !params.sign) return { verified: false, reason: "no sign" };
  const { sign: sig, ...rest } = params;
  if (sign(rest, c.merchantKey) !== sig) return { verified: false, reason: "bad signature" };
  if (params.trade_status !== "TRADE_SUCCESS") return { verified: false, reason: "not success" };
  return {
    verified: true,
    tradeNo: params.trade_no,
    orderNo: params.out_trade_no,
    amount: params.money,
    raw: params,
  };
}

function buildNotifyResponse({ success }) {
  return success ? "success" : "fail";
}

module.exports = { name: "epay", enabled, createPayment, verify, buildNotifyResponse };

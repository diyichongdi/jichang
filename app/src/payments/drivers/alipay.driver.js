// ============================================================
//  支付宝当面付/电脑网站支付 驱动
//
//  生产接入：到支付宝开放平台创建应用，申请「当面付」或
//  「电脑网站支付」，生成应用私钥，上传；填到 .env。
//
//  本文件是可运行的「预留实现」：使用 alipay-sdk 风格接口，
//  但我们为避免额外原生依赖，这里用纯 fetch 实现签名调用，
//  生产若想省事可替换为官方 npm 包 alipay-sdk。
// ============================================================
const config = require("../../config");
const crypto = require("crypto");
const { channel } = require("../payconfig");

const KEY_ORDER = [
  "app_id", "biz_content", "charset", "format", "method", "notify_url",
  "return_url", "sign_type", "timestamp", "version",
];

function enabled() {
  const c = channel("alipay");
  // 仅当完整配置可用时才开放渠道(避免暴露但下单报错)
  return !!(c && c.enabled && c.appId && c.privateKey && c.alipayPublicKey);
}

/** RSA2 签名 (SHA256withRSA) */
function sign(params, privateKey) {
  const str = KEY_ORDER.filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(str, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function rsaVerify(str, alipayPublicKey, signature) {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(str, "utf8");
    verifier.end();
    return verifier.verify(alipayPublicKey, signature, "base64");
  } catch (e) {
    return false;
  }
}

/**
 * 下单：返回跳转支付页 URL (电脑网站支付 alipay.trade.page.pay)。
 * 生产可用当面付 qr 码。此实现演示电脑网站支付。
 */
async function createPayment({ order, amount, subject }) {
  const c = channel("alipay");
  const baseParams = {
    app_id: c.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    notify_url: `${config.baseUrl}/api/payments/notify/alipay`,
    return_url: `${config.webUrl}/dashboard.html#/orders`,
    biz_content: JSON.stringify({
      out_trade_no: order.orderNo,
      total_amount: amount.toFixed(2),
      subject,
      product_code: "FAST_INSTANT_TRADE_PAY",
    }),
  };
  baseParams.sign = sign(baseParams, c.privateKey);

  const qs = new URLSearchParams(baseParams).toString();
  return {
    payUrl: `${c.gateway}?${qs}`,
    raw: { method: "page.pay" },
  };
}

/**
 * 回调校验（异步通知）。支付宝通知会 POST form 参数。
 */
function verify({ query, body }) {
  const c = channel("alipay");
  const params = Object.keys(body || {}).length ? body : query;
  if (!params || !params.sign) return { verified: false, reason: "no sign" };
  const { sign: sig, ...rest } = params;
  const str = Object.keys(rest)
    .filter((k) => k !== "sign" && k !== "sign_type" && rest[k] !== undefined && rest[k] !== "")
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const okSig = rsaVerify(str, c.alipayPublicKey, sig);
  if (!okSig) return { verified: false, reason: "bad signature" };
  // 业务校验：商家号、金额、状态
  if (params.app_id !== c.appId) return { verified: false, reason: "bad app_id" };
  if (params.trade_status !== "TRADE_SUCCESS" && params.trade_status !== "TRADE_FINISHED")
    return { verified: false, reason: "not success" };
  return {
    verified: true,
    tradeNo: params.trade_no,
    orderNo: params.out_trade_no,
    amount: params.total_amount,
    raw: params,
  };
}

/** 支付宝异步通知需回 "success" */
function buildNotifyResponse({ success }) {
  return success ? "success" : "failure";
}

module.exports = { name: "alipay", enabled, createPayment, verify, buildNotifyResponse };

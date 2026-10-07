// ============================================================
//  支付抽象层
//  目标：让订单模块与具体支付渠道解耦。
//  任何新渠道只需实现 Provider 接口并注册(见 index.js)。
//
//  Provider 接口:
//    name         {string}           渠道名 alipay/usdt/epay/balance
//    enabled()    {boolean}
//    createPayment({order, amount, subject}) -> {payUrl?|qrContent?|... , raw}
//        生成支付，返回给用户展示的信息
//    verify({order, query, body}) -> Promise<{verified, tradeNo, raw}>
//        校验异步回调签名/结果，verified=true 表示支付成功
//    buildNotifyResponse({success}) -> response body（渠道要求的回执格式）
// ============================================================
const { ApiError } = require("../../middleware/error");
const allDrivers = {
  alipay: require("../drivers/alipay.driver"),
  usdt: require("../drivers/usdt.driver"),
  epay: require("../drivers/epay.driver"),
  balance: require("../drivers/balance.driver"),
  // 在此扩展新渠道 driver
};

/** 按订单选择可用的支付渠道列表 */
function availableChannels() {
  return Object.keys(allDrivers)
    .filter((k) => allDrivers[k].enabled())
    .map((k) => allDrivers[k].name);
}

function getDriver(name) {
  const d = allDrivers[name];
  if (!d || !d.enabled()) {
    throw new ApiError(400, "支付渠道不可用: " + name);
  }
  return d;
}

module.exports = { allDrivers, availableChannels, getDriver };

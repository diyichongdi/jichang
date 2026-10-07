// ============================================================
//  支付渠道配置聚合
//  优先级：后台系统设置(settings 表) > 环境变量/.env(config.js)
//  目的：让管理员在后台填好渠道参数即可启用，无需改代码或重启。
//  用法：const { channel } = require("./payconfig");
//        const c = channel("epay"); // { enabled, apiUrl, pid, ... }
// ============================================================
const settings = require("../services/settings.service");
const config = require("../config");

// 渠道 -> settings key 映射(默认值见 settings.service.js DEFAULTS)
const CHANNELS = {
  epay: {
    enabledKey: "pay.epay_enabled",
    fields: {
      apiUrl: "pay.epay_api_url",
      pid: "pay.epay_pid",
      merchantKey: "pay.epay_key",
      name: "pay.epay_name",
    },
    // 必填项: 全齐才算真正可用
    required: ["apiUrl", "pid", "merchantKey"],
  },
  alipay: {
    enabledKey: "pay.alipay_enabled",
    fields: {
      appId: "pay.alipay_app_id",
      privateKey: "pay.alipay_private_key",
      alipayPublicKey: "pay.alipay_public_key",
      gateway: "pay.alipay_gateway",
      name: "pay.alipay_name",
    },
    required: ["appId", "privateKey", "alipayPublicKey"],
  },
  usdt: {
    enabledKey: "pay.usdt_enabled",
    fields: {
      apiUrl: "pay.usdt_api_url",
      apiKey: "pay.usdt_api_key",
      merchantId: "pay.usdt_merchant_id",
      wallet: "pay.usdt_wallet",
      name: "pay.usdt_name",
    },
    // USDT: apiUrl 或 wallet 任一即可(可走手动转账模式)
    requiredAny: ["apiUrl", "wallet"],
  },
};

/**
 * 取某渠道聚合配置
 * @param {string} name 渠道名 epay|alipay|usdt
 * @returns {{enabled:boolean, [k:string]:any, _ready:boolean, _missing:string[]}}
 */
function channel(name) {
  const def = CHANNELS[name];
  if (!def) return null;
  const envCfg = (config.payments && config.payments[name]) || {};
  const out = { enabled: !!envCfg.enabled };
  // 后台显式设置过才覆盖环境变量；未设置则回退 env/.env
  const sEnabled = settings.getStored(def.enabledKey);
  if (sEnabled !== undefined) out.enabled = !!sEnabled;

  for (const [field, skey] of Object.entries(def.fields)) {
    let v = settings.getStored(skey);
    if (v === undefined || v === "") v = envCfg[field];
    out[field] = v;
  }

  // 就绪判定
  const missing = [];
  if (Array.isArray(def.required)) {
    def.required.forEach((f) => { if (!out[f]) missing.push(f); });
  }
  if (Array.isArray(def.requiredAny)) {
    const anyOk = def.requiredAny.some((f) => !!out[f]);
    if (!anyOk) missing.push(def.requiredAny.join("|"));
  }
  out._ready = missing.length === 0;
  out._missing = missing;
  return out;
}

module.exports = { channel, CHANNELS };

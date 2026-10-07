// ============================================================
//  系统设置服务 (settings 表 KV)
//  支持按类型存取: str / int / float / bool / json
// ============================================================
const db = require("../db");

const DEFAULTS = {
  // 品牌
  "site.name": { type: "str", value: "极光云" },
  "site.slogan": { type: "str", value: "极光般的稳定，云端的畅通" },
  "site.desc": { type: "str", value: "全球多地区高质量节点" },
  "site.telegram": { type: "str", value: "https://t.me/your_channel" },
  // 营销
  "site.announce": { type: "str", value: "" }, // 顶部公告条
  "site.enable_register": { type: "bool", value: true },
  "site.invite_bonus": { type: "float", value: 0 }, // 邀请注册奖励(元)
  "site.commission_rate": { type: "float", value: 0 }, // 推荐返佣比例(% 按被推荐人首单金额)
  "site.card_redeem_notice": { type: "str", value: "" }, // 卡密说明(展示给用户)
  // 套餐
  "plan.free_trial_days": { type: "int", value: 0 }, // 新用户试用天数
  "plan.trial_traffic": { type: "int", value: 0 }, // 试用流量(GB)
  // 支付
  "pay.enable_balance": { type: "bool", value: true },
  "pay.currency": { type: "str", value: "CNY" },
  "pay.min_recharge": { type: "float", value: 10 },
  "pay.recharge_gift_rate": { type: "float", value: 0 }, // 充值赠送比例(%, 0=关闭)
  "pay.usdt_rate": { type: "float", value: 7.2 }, // USDT 汇率(1U ≈ 元)
  // ---- 第三方支付渠道(后台可配置, 配置后即启用, 无需改代码) ----
  // 易支付(第三方聚合)
  "pay.epay_enabled": { type: "bool", value: false },
  "pay.epay_api_url": { type: "str", value: "" },
  "pay.epay_pid": { type: "str", value: "" },
  "pay.epay_key": { type: "str", value: "" },
  "pay.epay_name": { type: "str", value: "易支付" },
  // 支付宝(当面付/电脑网站)
  "pay.alipay_enabled": { type: "bool", value: false },
  "pay.alipay_app_id": { type: "str", value: "" },
  "pay.alipay_private_key": { type: "str", value: "" },
  "pay.alipay_public_key": { type: "str", value: "" },
  "pay.alipay_gateway": { type: "str", value: "https://openapi.alipay.com/gateway.do" },
  "pay.alipay_name": { type: "str", value: "支付宝" },
  // USDT / 加密
  "pay.usdt_enabled": { type: "bool", value: false },
  "pay.usdt_api_url": { type: "str", value: "" },
  "pay.usdt_api_key": { type: "str", value: "" },
  "pay.usdt_merchant_id": { type: "str", value: "" },
  "pay.usdt_wallet": { type: "str", value: "" },
  "pay.usdt_name": { type: "str", value: "USDT" },
  // 邮件(SMTP)
  "mail.host": { type: "str", value: "" },
  "mail.port": { type: "int", value: 465 },
  "mail.secure": { type: "bool", value: true },
  "mail.user": { type: "str", value: "" },
  "mail.pass": { type: "str", value: "" },
  "mail.from": { type: "str", value: "" },
  // ---- 站点内容(后台可配, 覆盖落地页静态配置; 空/空数组 = 用前端默认) ----
  "content.hero_title": { type: "str", value: "" },
  "content.hero_sub": { type: "str", value: "" },
  "content.slogan": { type: "str", value: "" },
  "content.show_features": { type: "bool", value: true },
  "content.show_nodes": { type: "bool", value: true },
  "content.show_plans": { type: "bool", value: true },
  "content.show_docs": { type: "bool", value: true },
  "content.show_faq": { type: "bool", value: true },
  "content.show_trust": { type: "bool", value: true },
  "content.features": { type: "json", value: [] },
  "content.faqs": { type: "json", value: [] },
  "content.trust": { type: "json", value: [] },
  "content.docs": { type: "json", value: [] },
  "content.plans": { type: "json", value: [] },
  "content.nodes": { type: "json", value: [] },
  // 安全
  "sec.allow_signup": { type: "bool", value: true },
  "sec.require_email_verify": { type: "bool", value: false },
  // ---- 通知(到期/用量提醒; 邮件或 TG 频道推送) ----
  "notify.method": { type: "str", value: "mail" }, // 逗号分隔: mail,tg ; 空=关闭
  "tg.bot_token": { type: "str", value: "" },       // 发送者 Bot Token
  "tg.chat_id": { type: "str", value: "" },         // 目标 chat_id(可多个逗号)
  "remind.expire_days": { type: "json", value: [3, 1] }, // 到期前 N 天提醒
  "remind.traffic_threshold": { type: "int", value: 80 }, // 流量用量阈值(%)
  // 主题: 允许的站点主题(逗号分隔)；system 为前端"跟随系统"模式(不在此列)
  "ui.themes_enabled": { type: "str", value: "dark,light" },
  "ui.default_theme": { type: "str", value: "dark" },
};

function cast(type, raw) {
  switch (type) {
    case "int":
      return parseInt(raw, 10) || 0;
    case "float":
      return parseFloat(raw) || 0;
    case "bool":
      return raw === true || raw === "true" || raw === "1" || raw === 1;
    case "json":
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    default:
      return raw == null ? "" : String(raw);
  }
}

/** 已知设置(带默认值填充) */
function all() {
  const rows = db.all("SELECT key,value FROM settings");
  const map = {};
  rows.forEach((r) => (map[r.key] = r.value));
  const merged = {};
  for (const [k, def] of Object.entries(DEFAULTS)) {
    const has = Object.prototype.hasOwnProperty.call(map, k);
    merged[k] = {
      key: k,
      type: def.type,
      value: has ? cast(def.type, map[k]) : def.value,
      dirty: has,
    };
  }
  return merged;
}

/** 读单个 */ 
function get(key, fallback) {
  const def = DEFAULTS[key];
  const row = db.get("SELECT value FROM settings WHERE key=?", [key]);
  if (row) return cast(def ? def.type : "str", row.value);
  if (def) return def.value;
  return fallback === undefined ? null : fallback;
}

/** 读单个(仅显式存储, 未在库中设置过返回 undefined, 不回填默认值) */
function getStored(key) {
  const def = DEFAULTS[key];
  const row = db.get("SELECT value FROM settings WHERE key=?", [key]);
  if (!row) return undefined;
  return cast(def ? def.type : "str", row.value);
}

/** 写单个 */
function set(key, value, type = "str") {
  const strVal = type === "json" ? JSON.stringify(value) : String(value);
  db.run(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, strVal]
  );
  return get(key);
}

/** 批量写 {key:value}，自动推断类型(若在 DEFAULTS 里有则按其类型) */
function setMany(obj, typeOf = null) {
  db.transaction(() => {
    for (const [k, v] of Object.entries(obj || {})) {
      const t = (typeOf && typeOf[k]) || (DEFAULTS[k] && DEFAULTS[k].type) || "str";
      const strVal = t === "json" ? JSON.stringify(v) : String(v);
      db.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [
        k,
        strVal,
      ]);
    }
  });
}

module.exports = { DEFAULTS, all, get, getStored, set, setMany };

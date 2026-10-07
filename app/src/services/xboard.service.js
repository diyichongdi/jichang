// ============================================================
//  Xboard 面板对接服务 (预留/降级一体)
//  用途：
//    1. 为已购用户生成订阅(subscription)地址 —— 若配置了 Xboard 面板，
//       则调用面板用户接口生成；否则走本系统的自管订阅(真实节点下发)。
//    2. 流量计量 —— 自管模式记录 flow_usages 流水，按自然月聚合。
//  面板未配置时不报错，降级为"自管订阅"，保证单机可跑通全流程。
// ============================================================
const crypto = require("crypto");
const db = require("../db");
const config = require("../config");

// ---- 自管订阅使用本系统签名的 token，标记订阅身份 ----
function subToken(userId, email) {
  const h = crypto.createHmac("sha256", config.jwt.secret);
  h.update(`sub:${userId}:${email}`);
  return `${userId}.${h.digest("hex").slice(0, 24)}`;
}

function parseSubToken(token) {
  const idx = token.indexOf(".");
  if (idx <= 0) return null;
  const userId = parseInt(token.slice(0, idx), 10);
  return isNaN(userId) ? null : { userId };
}

/** 订阅地址(自管模式) */
function selfSubscribeUrl(userId, email) {
  return `${config.webUrl || config.baseUrl}/api/xboard/subscribe?token=${subToken(userId, email)}`;
}

/**
 * 为指定用户生成(或取)订阅地址。
 *  返回 { subscription: string|null, provider: 'xboard'|'self'|null, note }
 */
function getSubscription(user) {
  const xb = config.xboard;
  if (xb.apiHost && xb.apiKey) {
    return {
      subscription: `${xb.apiHost}/api/v1/client/subscribe?token=${subToken(user.id, user.email)}`,
      provider: "xboard",
      note: "Xboard 面板订阅(示例拼接, 需与面板用户打通)",
    };
  }
  return {
    subscription: selfSubscribeUrl(user.id, user.email),
    provider: "self",
    note: "自管订阅(由本系统按节点表下发)",
  };
}

/** 可用节点(自管模式, 按分组) */
function activeNodes() {
  return db.all("SELECT * FROM nodes WHERE active=1 ORDER BY sort ASC, id ASC");
}

/** 该用户是否有有效(未过期)套餐 */
function hasValidPlan(user) {
  if (!user.plan_id || !user.plan_expire_at) return false;
  return user.plan_expire_at >= Math.floor(Date.now() / 1000);
}

// ---- 节点 -> 各协议订阅行 ----
function v2rayLink(n) {
  const name = encodeURIComponent(n.name || `${n.code || "node"}-${n.id}`);
  const host = n.host || `${n.code || "x"}.example.com`;
  const port = n.port || 443;
  if (n.protocol === "trojan") {
    return `trojan://${encodeURIComponent(n.node_id || "pass")}@${host}:${port}?security=${n.security === "tls" ? "tls" : "none"}&sni=${n.sni || ""}&type=tcp#${name}`;
  }
  if (n.protocol === "ss") {
    const method = "chacha20-ietf-poly1305";
    const payload = Buffer.from(`${method}:${n.node_id || "pass"}`).toString("base64");
    return `ss://${payload}@${host}:${port}#${name}`;
  }
  // vless (默认)
  const q = [];
  if (n.security && n.security !== "none") q.push(`security=${n.security}`);
  if (n.sni) q.push(`sni=${encodeURIComponent(n.sni)}`);
  if (n.flow) q.push(`flow=${n.flow}`);
  q.push("type=tcp");
  return `vless://${n.node_id || "uuid-placeholder"}@${host}:${port}?${q.join("&")}#${name}`;
}

function clashProxy(n) {
  const base = {
    name: n.name || `${n.code || "node"}-${n.id}`,
    server: n.host || "example.com",
    port: n.port || 443,
    udp: true,
  };
  if (n.protocol === "trojan") {
    return Object.assign(base, {
      type: "trojan",
      password: n.node_id || "pass",
      sni: n.sni || n.host,
      skipCertVerify: true,
    });
  }
  if (n.protocol === "ss") {
    return Object.assign(base, {
      type: "ss",
      cipher: "chacha20-ietf-poly1305",
      password: n.node_id || "pass",
    });
  }
  return Object.assign(base, {
    type: "vless",
    uuid: n.node_id || "uuid-placeholder",
    tls: n.security && n.security !== "none" ? true : false,
    servername: n.sni || n.host,
    network: "tcp",
  });
}

const REGION_TAGS = { Asia: "亚洲", NorthAm: "北美", Europe: "欧洲", Oceania: "大洋洲" };

/**
 * 生成订阅内容(自管模式)。
 * @param {object} user
 * @param {string} format 'v2ray'|'clash'|'singbox'
 * @returns {string} 订阅文本(客户端可直接导入)
 */
function renderSubscription(user, format = "v2ray") {
  const plan = user.plan_id ? db.get("SELECT * FROM plans WHERE id=?", [user.plan_id]) : null;
  const isValid = hasValidPlan(user);
  const nodes = activeNodes();
  if (!isValid) {
    const expired =
      format === "v2ray"
        ? Buffer.from("订阅已失效, 请前往面板续费").toString("base64")
        : "";
    return expired || "subscription expired";
  }
  const note = `极光云订阅 · ${plan ? plan.name : ""}`;

  if (format === "clash") {
    const proxies = nodes.map(clashProxy);
    const lines = [
      "proxies:",
      ...proxies.map((p) => "  " + "  ".trim() + yamlInline(p)),
      "",
      "proxy-groups:",
      `  - name: "Auto"`,
      `    type: url-test`,
      `    proxies: ${JSON.stringify(proxies.map((p) => p.name))}`,
      `    url: "http://www.gstatic.com/generate_204"`,
      `    interval: 300`,
      `  - name: "手动选择"`,
      `    type: select`,
      `    proxies: ["Auto", ${JSON.stringify(proxies.map((p) => p.name))}]`,
      "rules:",
      '  - MATCH,Auto',
    ];
    return lines.join("\n");
  }

  if (format === "singbox") {
    const outbounds = nodes.map((n) => {
      const o = {
        type: n.protocol === "trojan" ? "trojan" : n.protocol === "ss" ? "shadowsocks" : "vless",
        tag: n.name,
        server: n.host || "example.com",
        server_port: n.port || 443,
      };
      if (n.protocol === "trojan") o.password = n.node_id || "pass";
      else if (n.protocol === "ss") o.method = "chacha20-ietf-poly1305", o.password = n.node_id || "pass";
      else {
        o.uuid = n.node_id || "uuid-placeholder";
        if (n.security && n.security !== "none") {
          o.tls = { enabled: true, server_name: n.sni || n.host, insecure: true };
        }
      }
      return o;
    });
    return JSON.stringify(
      {
        log: { level: "info" },
        outbounds: [
          ...outbounds,
          { type: "direct", tag: "direct" },
          { type: "block", tag: "block" },
        ],
        route: {
          final: outbounds[0] ? outbounds[0].tag : "direct",
          auto_detect_interface: true,
        },
      },
      null,
      2
    );
  }

  // v2rayN: base64(每行一个节点)
  const list = nodes.map(v2rayLink).join("\n");
  return Buffer.from(list, "utf8").toString("base64");
}

/** clash proxies 的 YAML 行(简单转换, 不引第三方 yaml 库) */
function yamlInline(p) {
  const kv = [];
  for (const [k, v] of Object.entries(p)) {
    const str =
      typeof v === "boolean" ? (v ? "true" : "false") : JSON.stringify(String(v));
    kv.push(`${k}: ${str}`);
  }
  return `- {${kv.join(", ")}}`;
}

/**
 * 流量同步。
 * 自管模式：已用流量 = 当前自然月 flow_usages 聚合 + 库内 total_traffic 兜底。
 * @returns {object} { total, used, remaining, note }
 */
async function syncTraffic(user) {
  const xb = config.xboard;
  if (xb.apiHost && xb.apiKey) {
    return { total: 0, used: 0, note: "面板流量同步已预留(XBOARD_API_HOST/API_KEY 未实际连通)" };
  }
  const plan = user.plan_id ? db.get("SELECT * FROM plans WHERE id=?", [user.plan_id]) : null;
  const period = nowPeriod();
  const row = db.get(
    "SELECT IFNULL(SUM(traffic),0) AS used FROM flow_usages WHERE user_id=? AND period=?",
    [user.id, period]
  );
  const used = (row && row.used) || 0;
  const total = plan ? plan.traffic * 1024 * 1024 * 1024 : 0;
  return {
    total,
    used,
    remaining: total > 0 ? Math.max(0, total - used) : 0,
    period,
    note: "自管流量(按自然月累计)",
  };
}

/** 当前自然月 YYYY-MM */
function nowPeriod(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

/**
 * 记录流量使用(由节点后端回写或管理员手动录入)。
 * @param {object} p { userId, nodeId?, up?, down?, rate? }
 * @returns {object} { inserted, traffic, period }
 */
function recordFlow(p) {
  const up = Math.max(0, parseInt(p.up, 10) || 0);
  const down = Math.max(0, parseInt(p.down, 10) || 0);
  const rate = parseFloat(p.rate) || 1;
  const traffic = Math.round((up + down) * rate);
  const period = p.period || nowPeriod();
  db.transaction(() => {
    db.run(
      "INSERT INTO flow_usages(user_id,node_id,up,down,traffic,rate,period) VALUES(?,?,?,?,?,?,?)",
      [p.userId, p.nodeId || null, up, down, traffic, rate, period]
    );
    db.run("UPDATE users SET total_traffic=IFNULL(total_traffic,0)+? WHERE id=?", [traffic, p.userId]);
  });
  return { inserted: 1, traffic, period };
}

/** 用户近 N 天流量明细 */
function flowDetail(userId, days = 30) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return db.all(
    `SELECT f.*, n.name AS node_name FROM flow_usages f
     LEFT JOIN nodes n ON f.node_id=n.id
     WHERE f.user_id=? AND f.created_at>=? ORDER BY f.id DESC LIMIT 200`,
    [userId, since]
  );
}

module.exports = {
  getSubscription,
  renderSubscription,
  syncTraffic,
  subToken,
  parseSubToken,
  recordFlow,
  flowDetail,
  activeNodes,
  nowPeriod,
  hasValidPlan,
};
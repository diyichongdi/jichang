// ============================================================
//  通知服务 (邮件 / Telegram)
//  用途：到期与用量提醒、工单新消息、订单成功等推送。
//  通道由设置 notify.method 控制 (mail / tg / 逗号组合, 空=关)。
//  未配置时静默降级(不抛错)。
// ============================================================
const db = require("../db");
const settings = require("./settings.service");
const { sendMail } = require("./mail.service");

/** 某通道是否启用 */
function enabled(channel) {
  const method = String(settings.get("notify.method", "mail") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return method.includes(channel);
}

/** Telegram 发送(无 token/chat 时跳过) */
async function sendTelegram(text) {
  const token = settings.get("tg.bot_token");
  const chatId = settings.get("tg.chat_id");
  if (!token || !chatId) return { skipped: true, reason: "tg 未配置" };
  const chats = String(chatId).split(",").map((s) => s.trim()).filter(Boolean);
  const results = [];
  for (const id of chats) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text, disable_web_page_preview: true }),
      });
      results.push({ chat_id: id, ok: resp.ok });
    } catch (e) {
      results.push({ chat_id: id, ok: false, error: e.message });
    }
  }
  return { ok: results.every((r) => r.ok), results };
}

/**
 * 通用提醒入口：按 notify.method 分发(mail + tg)，可选落库站内通知。
 * @param {object} p { userId?, email?, title, content?, html?, tgText?, notify(user_notifications)? }
 */
async function send(p) {
  const tasks = [];
  const email = p.email;
  if (enabled("mail") && email) {
    tasks.push(
      sendMail(email, p.title, p.html || `<p>${String(p.content || "")}</p>`).catch((e) => {
        console.error("[notify] 邮件发送失败", e.message);
      })
    );
  }
  if (enabled("tg")) {
    const text = p.tgText || `${p.title}\n${p.content || ""}`;
    tasks.push(sendTelegram(text));
  }
  // 站内通知(可选)
  if (p.userId) {
    db.run(
      "INSERT INTO user_notifications(user_id,type,title,content) VALUES(?,?,?,?)",
      [p.userId, p.type || "system", p.title, p.content || ""]
    );
  }
  await Promise.all(tasks);
  return { ok: true };
}

/** 便捷：仅落库站内通知 */
function notifyUser(userId, title, content, type = "system") {
  db.run(
    "INSERT INTO user_notifications(user_id,type,title,content) VALUES(?,?,?,?)",
    [userId, type, title, content || ""]
  );
}

/** 当前自然月 YYYY-MM */
function periodOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 定时扫描提醒(由调度器调用)：
 *  1) 已到期用户自动停用(status=0)
 *  2) 套餐临近到期 -> 到期提醒(expire_remind_sent, 一次)
 *  3) 流量用量达阈值 -> 用量提醒(traffic_remind_sent, 一次)
 * 提醒一律写站内通知；邮件/TG 按 notify.method 额外推送。
 */
async function sendReminders() {
  const now = Math.floor(Date.now() / 1000);

  // 已到期自动停用(users.status 为文本 active/disabled, 到期列 plan_expire_at)
  db.run(
    "UPDATE users SET status='disabled', plan_expire_at=NULL WHERE status='active' AND plan_id IS NOT NULL AND plan_expire_at IS NOT NULL AND plan_expire_at < ?",
    [now]
  );

  const expireDays = parseInt(settings.get("remind.expire_days") || 3, 10) || 3;
  const thresholdPct = parseFloat(settings.get("remind.traffic_threshold") || 80, 10) || 80;
  const due = now + expireDays * 86400;

  // 到期提醒
  const expiring = db.all(
    "SELECT * FROM users WHERE status='active' AND plan_expire_at IS NOT NULL AND plan_expire_at<=? AND plan_expire_at>=? AND expire_remind_sent=0",
    [due, now]
  );
  for (const u of expiring) {
    const days = Math.ceil((u.plan_expire_at - now) / 86400);
    await send({
      userId: u.id,
      email: u.email,
      title: "套餐即将到期提醒",
      content: `您的服务将于 ${days} 天后到期 (${new Date(u.plan_expire_at * 1000).toLocaleDateString()})，请及时续费。`,
      tgText: `套餐到期提醒\n邮箱: ${u.email}\n剩余 ${days} 天`,
      type: "expire",
    });
    db.run("UPDATE users SET expire_remind_sent=1 WHERE id=?", [u.id]);
  }

  // 流量用量提醒
  const quotaUsers = db.all(
    `SELECT u.*, p.traffic AS quota FROM users u JOIN plans p ON u.plan_id=p.id
     WHERE u.status='active' AND u.traffic_remind_sent=0 AND p.traffic>0`
  );
  for (const u of quotaUsers) {
    const row = db.get("SELECT IFNULL(SUM(traffic),0) AS used FROM flow_usages WHERE user_id=? AND period=?", [
      u.id,
      periodOf(),
    ]);
    const used = (row && row.used) || 0;
    const quotaBytes = u.quota * 1024 * 1024 * 1024;
    if (quotaBytes > 0 && used / quotaBytes >= thresholdPct / 100) {
      const pct = Math.min(100, Math.round((used / quotaBytes) * 100));
      await send({
        userId: u.id,
        email: u.email,
        title: "流量用量提醒",
        content: `您的套餐流量已用 ${pct}% (${(used / 1073741824).toFixed(2)} GB / ${u.quota} GB)。`,
        tgText: `流量用量提醒\n邮箱: ${u.email}\n已用 ${pct}%`,
        type: "traffic",
      });
      db.run("UPDATE users SET traffic_remind_sent=1 WHERE id=?", [u.id]);
    }
  }
  return { expiring: expiring.length, quotaChecked: quotaUsers.length };
}

module.exports = { enabled, send, sendTelegram, notifyUser, sendReminders };
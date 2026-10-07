// ============================================================
//  邮件服务 (nodemailer)
//  用于：邮箱验证 / 找回密码。未配置 SMTP 时降级为日志输出。
// ============================================================
const nodemailer = require("nodemailer");
const config = require("../config");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const m = config.mail;
  if (!m.host || !m.user) return null; // 未配置
  transporter = nodemailer.createTransport({
    host: m.host,
    port: m.port,
    secure: m.secure,
    auth: { user: m.user, pass: m.pass },
  });
  return transporter;
}

/**
 * 发送邮件。未配置 SMTP 时把内容打到控制台(开发模式便于联调)。
 */
async function sendMail(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[MAIL-DEV] to=${to} subject="${subject}"\n${html}\n`);
    return { dev: true, to };
  }
  return t.sendMail({
    from: `"${config.mail.name}" <${config.mail.from}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };

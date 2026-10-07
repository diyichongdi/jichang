// ============================================================
//  全局配置
//  生产环境用环境变量覆盖，见 .env.example
// ============================================================
require("dotenv").config();

module.exports = {
  env: process.env.NODE_ENV || "development",

  // 服务
  port: parseInt(process.env.PORT || "3000", 10),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  // 前端落地页地址
  webUrl: process.env.WEB_URL || "http://localhost:8800",

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_change_me_in_prod",
    expiresIn: process.env.JWT_EXPIRES || "7d",
  },

  // 邮件
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || "465", 10),
    secure: process.env.MAIL_SECURE !== "false",
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || "noreply@example.com",
    name: process.env.MAIL_NAME || "极光云",
  },

  // 支付驱动配置 (预留接口, 见 src/payments/providers/)
  payments: {
    // 支付宝当面付/电脑网站支付
    alipay: {
      enabled: process.env.ALIPAY_ENABLED === "true",
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do",
    },
    // USDT / 加密
    usdt: {
      enabled: process.env.USDT_ENABLED === "true",
      // 接入第三方USDT收银台/钱包监控时填
      apiUrl: process.env.USDT_API_URL,
      apiKey: process.env.USDT_API_KEY,
      merchantId: process.env.USDT_MERCHANT_ID,
      wallet: process.env.USDT_WALLET,
    },
    // 易支付 (第三方聚合)
    epay: {
      enabled: process.env.EPAY_ENABLED === "true",
      apiUrl: process.env.EPAY_API_URL,
      pid: process.env.EPAY_PID,
      merchantKey: process.env.EPAY_MERCHANT_KEY,
    },
  },

  // Xboard 面板对接
  xboard: {
    apiHost: process.env.XBOARD_API_HOST,
    // 面板通讯密钥/后端API, 给"恢复订阅与流量同步"用
    apiKey: process.env.XBOARD_API_KEY,
  },
};

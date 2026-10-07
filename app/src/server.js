// ============================================================
//  机场全栈站 · 服务入口 (Express)
// ============================================================
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const config = require("./config");
const { notFound, errorHandler } = require("./middleware/error");

async function main() {
  // 初始化数据库
  await db.init();
  console.log("[db] ready");

  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  if (config.env !== "test") app.use(morgan("dev"));

  // 限流(防刷)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  // 健康检查
  app.get("/health", (req, res) => res.json({ code: 0, msg: "ok", data: { uptime: process.uptime() } }));

  // 业务路由
  app.use("/api/auth", require("./modules/auth/auth.router"));
  app.use("/api/plans", require("./modules/plan/plan.router"));
  app.use("/api/orders", require("./modules/order/order.router"));
  app.use("/api/payments", require("./modules/payment/payment.router"));
  app.use("/api/user", require("./modules/user/user.router"));
  app.use("/api/admin", require("./modules/admin/admin.router"));
  app.use("/api/public", require("./modules/public/public.router"));
  app.use("/api/xboard", require("./modules/xboard/xboard.router"));
  app.use("/api/settings", require("./modules/settings/settings.router"));
  app.use("/api/nodes", require("./modules/nodes/nodes.router"));
  app.use("/api/tickets", require("./modules/ticket/ticket.router"));
  app.use("/api/coupons", require("./modules/coupon/coupon.router"));
  app.use("/api/cards", require("./modules/cardkey/cardkey.router"));

  // 后台调度器(到期/流量提醒等)
  require("./services/scheduler").start();

  // 仅开发：托管落地页静态文件(可从 site 目录)
  const siteDir = path.join(__dirname, "..", "..", "site");
  app.use(express.static(siteDir));

  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`[server] 运行于 http://localhost:${config.port}`);
    console.log(`[server] 健康检查 /health`);
  });
}

main().catch((e) => {
  console.error("[boot] 启动失败", e);
  process.exit(1);
});

# 机场全栈站 · 后端 (jichang/app)

自研 Node (Express) 后端：认证 / 套餐 / 订单与多支付渠道 / 用户中心 / 管理端 / Xboard 订阅与流量同步。
配套落地页：`../site`；服务器(Airport)面板与节点部署：`../deploy`。

> 合规提示：在中国大陆未获许可经营 VPN/代理属违法行为，本仓库仅作技术与信息整理，请合法合规使用。

## 技术栈

- **运行**: Node.js (v18+，开发在 v24 验证) + Express
- **数据库**: sql.js (SQLite WASM，纯 JS 无原生编译，Windows 直接可跑)，持久化到 `data/app.db`
  - 接口已抽象为 `src/db/index.js`，生产可换 MySQL/Postgres（保持同一接口）
- **认证**: JWT (jsonwebtoken) + bcryptjs
- **邮件**: nodemailer，未配 SMTP 时降级打印到控制台
- **支付**: 适配器模式，`src/payments/drivers/*` 实现统一 Provider 接口
- **限流/安全**: express-rate-limit + helmet + cors

## 目录结构

```
src/
  server.js                 入口：装配中间件与全部路由、托管 ../site 静态落地页
  config.js                 全局配置(读环境变量)
  db/
    index.js                sql.js 驱动(初始化/持久化/事务)
    schema.sql              全量表结构
    seed.js                 初始化: admin + 3 套餐 + 默认公告
  middleware/
    auth.js                 JWT 签发/鉴权/adminOnly
    error.js                ok/ApiError/wrap/errorHandler
  services/
    mail.service.js         邮件(降级打印)
    xboard.service.js       订阅生成 + 流量同步(面板/自管降级)
  modules/
    auth/                   注册/登录/邮箱验证/找回密码
    user/                   总览/改资料/改密码/订阅链接
    plan/                   套餐查询+管理
    order/                  下单/查询/渠道 + 余额支付
    payment/                支付异步回调统一入口 /api/payments/notify/:provider
    admin/                  统计/用户/订单/公告
    public/                 落地页公开数据(plans/notices/config)
    xboard/                 订阅内容/流量接口
  payments/
    providers/index.js      渠道注册表
    drivers/*.driver.js     alipay(RSA2) / usdt / epay(MD5) / balance
```

## 快速开始

```bash
cd jichang/app
npm install          # 已装则跳过
# 可选: 复制 .env.example 为 .env 并按需填支付/邮件/Xboard
npm run seed         # 初始化 admin/套餐/公告
npm start            # 启动 http://localhost:3000
```

默认初始化：
- 管理员：`admin@example.com / admin123456`（在 `.env` 用 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 覆盖）
- 3 个套餐：入门¥15 / 标准¥30 / 专业¥60（月付）

### 本地联调前后端

```bash
# 终端1: 后端
cd jichang/app && npm start            # 3000
# 终端2: 落地页静态服务
cd jichang/site && python -m http.server 8800
# 打开 http://localhost:8800
```

落地页的 API 地址在 `../site/js/config.js` 的 `API_BASE` 配置，默认指向 `http://localhost:3000`。

## 端到端冒烟测试

`scripts/e2e.js` 启动独立后端(端口 3999)，走通 注册→登录→下单→epay 异步回调验签→订单履约→套餐开通→余额→管理端→权限隔离，共 18 项断言。

```bash
npm run e2e          # 期望: 18/18 通过
```

## 支付接入

统一回调入口：`POST /api/payments/notify/:provider`（如 `/epay`），验签通过即调用 `orderService.markOrderPaid` 幂等履约（开通/续费套餐、充值余额）。

新增渠道：在 `src/payments/drivers/` 实现 `Provider` 接口（`enabled/createPayment/verify/buildNotifyResponse`）并在 `providers/index.js` 注册。生产用环境变量配置（见 `.env.example`）：

```
EPAY_ENABLED=true / EPAY_API_URL / EPAY_PID / EPAY_MERCHANT_KEY   # 易支付
ALIPAY_ENABLED=true / ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_GATEWAY
USDT_ENABLED=true / USDT_API_URL / USDT_API_KEY / USDT_WALLET / USDT_MERCHANT_ID
```

> 说明：USDT 在当前前端展示为收款地址+复制，QR 码需接入二维码库（预留）。

## Xboard 对接（预留）

在 `.env` 配置 `XBOARD_API_HOST` / `XBOARD_API_KEY` 即启用面板模式（订阅地址拼面板、流量从面板拉取）；未配置时降级为“自管订阅”（本系统生成订阅，无真实节点下发逻辑，接入面板后由面板负责）。

## 环境变量（见 `.env.example`）

`PORT` `BASE_URL` `WEB_URL` `JWT_SECRET` `JWT_EXPIRES` · 邮件 `MAIL_*` · 支付上述 `*PAY*`/`ALIPAY_*`/`USDT_*` · Xboard `XBOARD_*` · `DB_FILE`

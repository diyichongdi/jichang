# 极光云 · AuroraCloud

机场全栈站：自研 Node 后端 + 管理后台 + 落地页，支持套餐购买、支付回调、订阅下发、工单、优惠码、卡密、流量计量等。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express + sql.js (WASM) |
| 前端 | 原生 HTML/CSS/JS (无构建) |
| 数据库 | SQLite (sql.js 持久化到文件) |
| 认证 | JWT (jsonwebtoken) |
| 邮件 | nodemailer |

## 目录结构

```
jichang/
├── app/                    # 后端
│   ├── src/
│   │   ├── server.js       # 入口
│   │   ├── config.js       # 配置
│   │   ├── db/             # 数据库层 (sql.js)
│   │   ├── middleware/     # 鉴权 / 错误处理
│   │   ├── modules/        # 业务路由
│   │   │   ├── auth/       # 登录/注册/找回密码
│   │   │   ├── user/       # 用户中心
│   │   │   ├── order/      # 订单/支付
│   │   │   ├── plan/       # 套餐
│   │   │   ├── admin/      # 管理后台
│   │   │   ├── public/     # 公开接口
│   │   │   ├── nodes/      # 节点管理
│   │   │   ├── ticket/     # 工单
│   │   │   ├── coupon/     # 优惠码
│   │   │   ├── cardkey/    # 卡密
│   │   │   ├── payment/    # 支付回调
│   │   │   ├── settings/   # 系统设置
│   │   │   └── xboard/     # 订阅下发
│   │   ├── services/       # 业务服务
│   │   └── payments/       # 支付驱动
│   ├── data/               # 数据库文件 (gitignore)
│   ├── scripts/            # e2e 测试
│   └── package.json
├── site/                   # 前端 (静态)
│   ├── index.html          # 落地页
│   ├── dashboard.html      # 用户中心
│   ├── admin.html          # 管理后台
│   ├── css/style.css
│   └── js/
│       ├── api.js          # API 封装
│       ├── config.js       # 站点配置
│       ├── theme.js        # 主题切换
│       ├── main.js         # 落地页渲染
│       ├── app.js          # 落地页交互
│       ├── dashboard.js    # 用户中心
│       └── admin.js        # 管理后台
└── deploy/                 # 部署配置
```

## 快速开始

### 1. 安装依赖

```bash
cd app
npm install
```

### 2. 配置环境变量（可选）

```bash
cp .env.example .env
# 编辑 .env 填写实际值
```

### 3. 启动后端

```bash
cd app
npm start          # 生产模式
npm run dev        # 开发模式 (热重载)
```

后端默认监听 `http://localhost:3000`

### 4. 启动前端

```bash
# 在项目根目录
python -m http.server 8800 --directory site
```

或使用提供的脚本：

```bash
./start_static.bat   # Windows
```

前端访问 `http://localhost:8800`

### 5. 初始化数据

```bash
cd app
npm run seed       # 创建管理员 + 示例套餐/节点
```

## 测试账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | admin@example.com | admin123456 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| PORT | 3000 | 后端端口 |
| BASE_URL | http://localhost:3000 | 后端地址 |
| WEB_URL | http://localhost:8800 | 前端地址 |
| JWT_SECRET | dev_secret_change_me_in_prod | JWT 密钥（生产必改） |
| JWT_EXPIRES | 7d | Token 有效期 |
| MAIL_HOST | - | SMTP 服务器 |
| MAIL_PORT | 465 | SMTP 端口 |
| MAIL_USER | - | SMTP 用户名 |
| MAIL_PASS | - | SMTP 密码 |
| EPAY_ENABLED | false | 易支付开关 |
| EPAY_API_URL | - | 易支付接口 |
| EPAY_PID | - | 易支付商户ID |
| EPAY_MERCHANT_KEY | - | 易支付密钥 |
| XBOARD_API_HOST | - | Xboard 面板地址 |
| XBOARD_API_KEY | - | Xboard 通讯密钥 |

## 脚本

| 命令 | 说明 |
|---|---|
| npm start | 启动后端 |
| npm run dev | 开发模式 (热重载) |
| npm run seed | 初始化数据库 |
| npm run e2e | 端到端测试 |

## 支付驱动

支持以下支付方式（需在 `.env` 中配置）：

- **易支付** (EPAY) — 第三方聚合支付
- **支付宝** (ALIPAY) — 当面付/电脑网站支付
- **USDT** — 加密货币支付
- **余额支付** — 站内余额

## 许可证

MIT

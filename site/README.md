# 机场落地页（多主题）

一套**纯前端、多主题**的机场品牌落地页。用于对外宣传/获客（hero、优势、套餐展示、全球节点、FAQ、CTA），
功能操作（注册/登录/购买/订阅）跳转到你的 **Xboard 面板**。

```
site/
├── index.html          # 落地页主页面
├── css/style.css       # 多主题样式 (深色/浅色/霓虹) + 弹窗/购买流程样式
├── js/
│   ├── config.js       # ★ 站点配置(改这里全站生效)
│   ├── main.js         # 主题切换 + 数据渲染 + 交互
│   ├── api.js          # 后端 API 客户端 (window.JCAPI)
│   └── app.js          # 登录/注册/购买弹窗 + 支付流程 (对接后端)
├── preview-dark.png    # 预览截图(深色)
└── preview-buymodal.png# 预览截图(购买弹窗)
```

---

## 本地预览

任选其一（Windows PowerShell 在 `site` 目录下）：
```powershell
# 方式A: Python
python -m http.server 8800 --directory D:\c++++\jichang\site
# 浏览器打开
start http://localhost:8800
```

---

## 定制（只需改 `js/config.js`）

所有内容集中在一个文件，改它即可全站生效：

| 配置项 | 说明 |
|---|---|
| `brand` / `brandEn` | 品牌中文/英文名 |
| `API_BASE` | ★ 后端 API 地址（默认 `http://localhost:3000`，见 `../app`） |
| `USER_CENTER_URL` | 你的 Xboard 面板地址（面板模式开站后填） |
| `LOGIN_URL` | 面板登录页地址（若面板有随机路径） |
| `telegram` | 客服/频道 TG 链接 |
| `plans` | 套餐（价格/流量/设备/节点/卖点/主推） |
| `regions` | 全球节点地区标签 |
| `features` | 优势卡片 |
| `faqs` | 常见问题 |

> 改套餐、品牌、链接等，**不需要动 HTML/CSS/JS 逻辑**。
> `API_BASE` 指向本仓库自研 Node 后端（`../app`），落地页即可直接完成**注册/登录/下单/支付**。

---

## 主题切换

右上角 🌙 / ☀️ / 🌈 一键切换三套主题（深色科技 / 明亮商务 / 霓虹渐变），
选择会存入 `localStorage`，用户下次访问自动保留。

新增主题：在 `css/style.css` 里按 `html[data-theme="xxx"]` 加一组 CSS 变量，即可。

---

## 双模式：自研后端 或 Xboard 面板

- **自研后端模式（默认）**：`API_BASE` 指向 `../app`，落地页可直接完成注册/登录/下单/支付/订阅链接（全流程已实测，见下）。适合一体化自建。
- **面板模式**：若你主要用 Xboard 做功能页，把 `USER_CENTER_URL` / `LOGIN_URL` 改成面板域名即可，落地页"购买/登录"跳转面板。

**接入面板（面板模式，两步）**
1. 部署好 Xboard 面板（见 `../deploy/README.md`）。
2. 在 `js/config.js` 把 `USER_CENTER_URL` 和 `LOGIN_URL` 改成你的面板域名。

然后**二选一**上线落地页：
- **跟面板同域**：把本 `site/` 作为面板服务器的静态站点/伪静态首页。简单，域名统一。
- **独立域名**：落地页单独部署（任意静态托管/Nginx），"立即购买/登录"按钮跳转到面板域。

## 本地联调前后端

```bash
# 终端1: 自研后端 (../app)
cd ..\app && npm run seed && npm start     # 3000
# 终端2: 落地页静态服务
python -m http.server 8800 --directory D:\c++++\jichang\site
# 浏览器打开 http://localhost:8800
```

---

## 验证

已用无头浏览器(playwright-cli)实测：
- 品牌/套餐/节点/FAQ 数据全部由 config.js 动态渲染 ✓
- 三主题切换背景/文字/主色全部生效 ✓
- 套餐 3 项、优势 6 卡、节点 12 标签、FAQ 可折叠 ✓
- 对接自研后端 `../app`：注册→登录(JWT 存 localStorage)→选择套餐→四种支付方式(支付宝/USDT/易支付/余额) → 下单 → 支付回调履约→套餐开通 ✓
- 余额支付：余额不足正确提示"余额不足，请先充值" ✓
- 支付回调（模拟 epay 异步通知）→ 订单置为 paid、用户套餐/到期时间更新 ✓

> ⚠️ 合规声明：中国大陆未获许可经营 VPN/代理属违法行为。本页面为通用销售落地页模板，
> 仅作演示与品牌展示，上线请遵守当地法律法规，自行评估风险。

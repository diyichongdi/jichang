// ============================================================
//  机场落地页 · 站点配置（改这里即可全站生效）
//  接入面板后，把 USER_CENTER_URL 改成你的 Xboard 面板地址
// ============================================================
window.SITE = {
  // ---------- 品牌 ----------
  brand: "极光云",
  brandEn: "AuroraCloud",
  slogan: "极光般的稳定，云端的畅通",
  description:
    "全球多地区高质量节点，IEPL专线 / 中转 / 直连多种线路，助力开发者、外贸与日常上网，稳定不跑路。",

  // ---------- 后端 API (jichang/app, 默认本地 3000) ----------
  API_BASE: "http://localhost:3000",

  // ---------- 面板功能页地址 (开站后改成你的 Xboard 域名) ----------
  // 例: "https://panel.auroracloud.com"
  USER_CENTER_URL: "#",
  // 若面板用了随机后台路径，登录按钮可指向: USER_CENTER_URL + "#/login"
  LOGIN_URL: "#",

  // ---------- 社交 / 客服 ----------
  telegram: "https://t.me/your_channel",
  serviceTime: "9:00 - 23:00",

  // ---------- 套餐 ----------
  // price: 月付价; priceQ: 季付价; priceY: 年付价; unit: 周期(月/季/年); traffic: 月流量; devices: 设备数; nodes: 节点数; featured: 是否主推
  // 与后端 plans 表的 price/price_q/price_y 保持一致
  plans: [
    {
      name: "入门",
      price: 15,
      priceQ: 40,
      priceY: 150,
      unit: "月",
      traffic: "100G",
      devices: "6 台",
      nodes: "全节点",
      featured: false,
      features: ["100G/月高速流量", "全球主流地区节点", "6 台设备同时在线", "工单客服支持"],
    },
    {
      name: "标准",
      price: 30,
      priceQ: 80,
      priceY: 300,
      unit: "月",
      traffic: "300G",
      devices: "10 台",
      nodes: "全节点+专线",
      featured: true,
      features: ["300G/月高速流量", "含专线/中转节点", "10 台设备同时在线", "流媒体解锁更佳", "优先客服"],
    },
    {
      name: "专业",
      price: 60,
      priceQ: 160,
      priceY: 600,
      unit: "月",
      traffic: "800G",
      devices: "不限",
      nodes: "全节点+专线",
      featured: false,
      features: ["800G/月高速流量", "全节点+专线不限速", "不限设备数", "顶级流媒体解锁", "最高优先级客服"],
    },
  ],

  // 套餐周期的官方标签 (落地页「月/季/年」切换)
  cycleUnits: { month: "月", quarter: "季", year: "年" },
  cycleKeys: ["month", "quarter", "year"],

  // ---------- 全球节点地区 (用于展示) ----------
  regions: [
    "香港", "台湾", "日本", "新加坡", "美国", "韩国",
    "英国", "德国", "法国", "加拿大", "澳大利亚", "泰国",
  ],

  // ---------- 优势卡片 ----------
  features: [
    { icon: "🚀", title: "高速稳定", desc: "IEPL专线/中转/直连多线路，晚高峰不掉速，4K秒开。" },
    { icon: "🛡️", title: "安全隐私", desc: "不记录用户日志，全程加密传输，保护你的隐私数据。" },
    { icon: "🌍", title: "全球节点", desc: "亚洲、欧美、澳洲多地节点，覆盖主流需求区域。" },
    { icon: "🎬", title: "流媒体解锁", desc: "优化版节点，Netflix、ChatGPT等多服务解锁支持。" },
    { icon: "💬", title: "贴心客服", desc: "在线客服与工单系统，快速响应你的每一个问题。" },
    { icon: "⚡", title: "简单易用", desc: "主流客户端一键订阅，小白也能轻松上手。" },
  ],

  // ---------- 常见问题 ----------
  faqs: [
    { q: "支持哪些客户端?", a: "支持 Clash / Clash Verge / Sing-box / Shadowrocket / V2RayN 等主流客户端，导入订阅链接即可。" },
    { q: "可以同时几台设备使用?", a: "根据套餐不同支持多台设备同时在线，具体见各套餐说明。" },
    { q: "流量用完了怎么办?", a: "可以购买流量包，或续费/升级更高套餐，实时生效。" },
    { q: "支持哪些支付方式?", a: "支持支付宝 / 微信 / USDT 等常用支付方式。" },
  ],

  // ---------- 信任数字条 ----------
  trustNumbers: [
    { val: "99.9%", label: "在线率" },
    { val: "12+", label: "地区节点" },
    { val: "24h", label: "在线客服" },
    { val: "即买", label: "即买即用" },
  ],

  // ---------- 节点状态(静态占位; 对接面板后改为接口) ----------
  nodes: [
    { loc: "香港", code: "HK", region: "Asia", online: true, latency: 21, load: 32 },
    { loc: "台湾", code: "TW", region: "Asia", online: true, latency: 38, load: 45 },
    { loc: "日本", code: "JP", region: "Asia", online: true, latency: 58, load: 51 },
    { loc: "新加坡", code: "SG", region: "Asia", online: true, latency: 66, load: 39 },
    { loc: "美国", code: "US", region: "NorthAm", online: true, latency: 152, load: 47 },
    { loc: "韩国", code: "KR", region: "Asia", online: true, latency: 44, load: 28 },
    { loc: "英国", code: "GB", region: "Europe", online: true, latency: 198, load: 22 },
    { loc: "德国", code: "DE", region: "Europe", online: false, latency: 0, load: 100 },
    { loc: "法国", code: "FR", region: "Europe", online: true, latency: 205, load: 18 },
    { loc: "加拿大", code: "CA", region: "NorthAm", online: true, latency: 178, load: 30 },
    { loc: "澳大利亚", code: "AU", region: "Oceania", online: true, latency: 230, load: 15 },
    { loc: "泰国", code: "TH", region: "Asia", online: true, latency: 81, load: 25 },
  ],

  // ---------- 使用文档(静态; 可在后台「站点内容」统一维护) ----------
  docs: [
    { group: "快速开始", items: [
      { t: "什么是订阅链接？", upd: "2026-08", body: '<p>订阅链接是购买服务后系统为你生成的专属地址。把它导入任意支持订阅的客户端，客户端会自动拉取全部节点列表，无需手动配置每一个节点。</p><p>示例：<code>https://你的域名/api/xboard/subscribe?token=xxx</code></p>' },
      { t: "购买与充值流程", upd: "2026-08", body: '<ol><li>登录后进入「充值中心」，选择套餐与计费周期（月 / 季 / 年）。</li><li>选择支付方式（支付宝 / 易支付 / USDT / 余额），完成支付。</li><li>支付成功后套餐即时开通，到「我的订阅」复制订阅链接。</li><li>把订阅链接导入客户端即可使用。</li></ol>' },
      { t: "主流客户端怎么选", upd: "2026-08", body: '<p>全平台通用选 <b>Clash Verge</b>（Windows/macOS）或 <b>Flclash</b>；iOS 推荐 <b>Shadowrocket</b>；Android 可选 <b>Clash Meta</b> / <b>v2rayNG</b>。所有客户端导入同一个订阅链接即可。</p>' },
    ]},
    { group: "Windows", items: [
      { t: "Clash Verge 详细配置", upd: "2026-08", body: '<ol><li>下载并安装 Clash Verge。</li><li>左侧「订阅」→「新建」。</li><li>名称随意，URL 粘贴订阅链接，点击「导入」。</li><li>回到首页，打开订阅开关，勾选「系统代理」。</li><li>点击节点卡片选择节点，即可上网。</li></ol><p>提示：Clash Verge 支持「规则模式」与「全局模式」，日常建议规则模式。</p>' },
      { t: "v2rayN 详细配置", upd: "2026-08", body: '<ol><li>下载 v2rayN 并解压，运行 v2rayN.exe。</li><li>右键托盘图标 →「订阅分组」→「订阅分组设置」。</li><li>点击「添加」，地址栏粘贴订阅链接，保存。</li><li>右键托盘 →「订阅分组」→「更新全部订阅」。</li><li>选择节点并右键「设为活动服务器」，开启「系统代理」。</li></ol>' },
      { t: "Nekobox 配置", upd: "2026-08", body: '<p>Nekobox 支持 Windows / Android。导入订阅后选择路由模式（默认规则路由），开启 VPN 开关即可。</p>' },
    ]},
    { group: "macOS", items: [
      { t: "Clash Verge (macOS)", upd: "2026-08", body: '<ol><li>安装 Clash Verge（macOS 版）。</li><li>「订阅」→ 新建 → 粘贴订阅链接 → 导入。</li><li>开启订阅与「系统代理」，选择节点。</li><li>若提示「无法验证开发者」，在 系统设置 → 隐私与安全性 中点击「仍要打开」。</li></ol>' },
      { t: "Stash (macOS)", upd: "2026-08", body: '<p>Stash 是原生 macOS 客户端：文件 → 从 URL 下载配置 → 粘贴订阅链接 → 保存，打开开关即可。</p>' },
    ]},
    { group: "Android", items: [
      { t: "Clash Meta (Android)", upd: "2026-08", body: '<ol><li>安装 Clash Meta for Android。</li><li>「配置」→ 右上角 + →「新建配置」→「URL」。</li><li>名称随意，URL 粘贴订阅链接，保存。</li><li>点击配置右侧「启用」，回到首页打开「代理」开关。</li><li>首次会请求创建 VPN 连接，点「确定」授权即可。</li></ol>' },
      { t: "Flclash (Android)", upd: "2026-08", body: '<ol><li>安装 Flclash。</li><li>主界面「添加订阅」→ 粘贴订阅链接 → 保存。</li><li>选择节点，点击右下角按钮开启代理（需授予 VPN 权限）。</li></ol>' },
      { t: "v2rayNG", upd: "2026-08", body: '<ol><li>安装 v2rayNG。</li><li>右上角菜单 →「订阅设置」→ 右上角 + 添加订阅。</li><li>备注随意，地址粘贴订阅链接，保存。</li><li>返回主界面，右上角 ⋮ →「更新订阅」。</li><li>选择节点后点右下角 🚀 开启。</li></ol>' },
    ]},
    { group: "iOS", items: [
      { t: "Shadowrocket 小火箭", upd: "2026-08", body: '<ol><li>App Store 下载 Shadowrocket（需海外账号）。</li><li>右上角 + →「类型」选 Subscribe → URL 粘贴订阅链接。</li><li>保存后回到首页，选择节点，顶部开关打开。</li><li>首次会提示添加 VPN 配置，点「允许」并输入设备密码。</li></ol>' },
      { t: "Stash (iOS)", upd: "2026-08", body: '<p>Stash：设置 → 订阅 → 添加订阅 → 粘贴链接。与 Shadowrocket 类似，首次需授权 VPN。</p>' },
      { t: "Loon", upd: "2026-08", body: '<p>Loon：配置 → 订阅 → 添加订阅链接；回到首页开启全局代理即可。</p>' },
    ]},
    { group: "其他平台", items: [
      { t: "Linux / OpenWrt 路由器", upd: "2026-08", body: '<p>可使用 Clash（mihomo）命令行版：下载对应架构二进制，把订阅链接放入订阅配置或经转换工具生成 config.yaml。路由器端可配合 OpenClash / PassWall 插件使用。</p>' },
      { t: "订阅格式转换", upd: "2026-08", body: '<p>部分旧客户端只接受 v2ray / ss 格式，可先用订阅转换服务把订阅链接转成对应格式再导入。</p>' },
    ]},
    { group: "常见问题", items: [
      { t: "连不上 / 全部超时", upd: "2026-08", body: '<ol><li>先切换其他节点试试，单节点故障常见。</li><li>确认系统代理已开启，无其他代理软件冲突。</li><li>尝试关闭再开启代理，或重启客户端。</li><li>仍不行请提交工单，附上节点、地区与错误信息。</li></ol>' },
      { t: "速度慢 / 掉线", upd: "2026-08", body: '<p>优先选择延迟低、负载低的节点；避开晚高峰；可尝试 UDP 开关；专线节点对国际链路更稳定。</p>' },
      { t: "流量显示异常或未重置", upd: "2026-08", body: '<p>流量按自然月重置，面板回传可能有几分钟延迟；以「充值中心 / 我的订阅」显示为准，必要时刷新。</p>' },
      { t: "DNS 异常 / 部分网站打不开", upd: "2026-08", body: '<p>尝试在客户端把 DNS 设为 223.5.5.5 或 1.1.1.1；规则模式下确认目标域名命中代理规则。</p>' },
    ]},
  ],
};


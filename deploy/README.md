# 机场全栈部署包

一套可上线的 **Xboard 面板 + 节点后端 + 反代防封锁** 部署包。
目标环境：**Linux VPS (Debian/Ubuntu)**。本地 Windows 仅用于编辑/上传文件。

```
deploy/
├── panel/                    # 面板服务器
│   ├── docker-compose.yml    # Xboard + MariaDB + Redis
│   └── .env.example          # 环境变量模板
├── node/
│   ├── xrayr/                # 节点后端 A (成熟、教程多)
│   │   ├── docker-compose.yml
│   │   └── config.yml.example
│   └── xboard-node/          # 节点后端 B (官方配套,支持新协议)
│       ├── docker-compose.yml
│       └── config.yml.example
├── reverse/                  # 反代(防墙 + HTTPS)
│   ├── caddy/Caddyfile       # 推荐,自动证书
│   └── nginx/xboard.conf     # 备选
├── scripts/                  # 一键部署脚本
│   ├── setup-panel.sh        # 面板一键部署
│   └── setup-node.sh         # 节点一键部署
├── ops/                      # 运维脚本
│   ├── firewall-panel.sh     # 防火墙
│   ├── backup-panel.sh       # 备份
│   └── update-panel.sh       # 更新
└── docs/
    └── QUICKSTART.md         # 本文(快速上手)
```

---

## 架构总览

```
用户客户端(Clash/Singbox/Shadowrocket...)
   │
   ├──> [HTTPS] 面板站点  → Caddy/Nginx → Xboard(127.0.0.1:7001) + MariaDB + Redis
   │                      (自动TLS, CF反代防墙)
   │
   └──> [代理流量] 节点服务器 → Xboard-Node / XrayR (Xray/sing-box 内核)
                               (API 对接面板, 通讯密钥鉴权)
```

---

## 快速上手 (3 步)

### Step 1 — 部署面板

在**面板 VPS**(海外,1C1G+) 上：

```bash
# root 运行(需先上传本 deploy 包或用 curl 拉脚本)
bash deploy/scripts/setup-panel.sh
```

脚本会：装 Docker → 生成 compose 与 .env → `xboard:install` 向导 → (可选)Caddy 反代 → 启动。

**向导必填(重要)：**
- 数据库地址填 `mariadb`，Redis 地址填 `redis`（**不要**启用内置 SQLite/Redis）
- 完成后**保存输出**：管理员邮箱/密码 + 后台随机路径 `/xxxx`

接着把域名 A 记录解析到面板 VPS IP，等待 HTTPS 证书自动签发。

### Step 2 — 后台初始化

访问 `https://你的域名/随机路径` 登录：
1. 系统设置 → 站点名/货币(CNY)/SMTP 邮箱(防刷库)/邀请返佣
2. **节点配置 → 设置通讯密钥**（复制保存，后面节点要用）
3. 添加节点：得到节点 ID、类型
4. 创建套餐（流量/价格/设备数/倍率）
5. 支付接入（见 docs/支付指引 或 01-技术搭建方案 第 6 节）

### Step 3 — 部署节点

在每台**节点 VPS** 上：

```bash
# 方式 A: 新协议优先(推荐)  Xboard-Node
bash deploy/scripts/setup-node.sh
# 方式 B: 成熟稳定  XrayR
cp deploy/node/xrayr/config.yml.example config.yml
#   修改:面板域名 / 通讯密钥 / 节点ID / 协议
#   然后 docker compose up -d
```

配完后在面板节点管理确认「在线」，给用户分配套餐即可使用。

---

## 常用运维命令

| 操作 | 命令 |
|---|---|
| 面板状态 | `docker ps` |
| 面板日志 | `docker logs -f xboard` |
| 节点日志 | `docker logs -f xboard-node` (或 xrayr) |
| 更新面板 | `bash ops/update-panel.sh` |
| 备份面板 | `bash ops/backup-panel.sh` (加 crontab 定时) |
| 防火墙 | `bash ops/firewall-panel.sh` |

### crontab 每日备份示例
```bash
crontab -e
# 每天凌晨 3 点备份
0 3 * * * bash /opt/xboard/../deploy/ops/backup-panel.sh
```

---

## 防封锁要点(务必做)

- 面板/订阅域名**套 Cloudflare** 并隐藏源站，用「CX」优选 IP 反代面板。
- 节点尽量用**中转架构**，落地 IP 被封只在面板换落地、用户无感。
- 备好 **2-3 个备用域名**，用于防墙轮换。
- 节点用 **Reality / Hysteria2** 等新协议，抗封锁更强。

---

## 安全默认值(上线前必须改)

- [ ] `.env` 的 `DB_PASSWORD` 已改强随机（脚本已自动生成）
- [ ] 通讯密钥已改成复杂随机值并保密
- [ ] SMTP 邮箱验证已开启
- [ ] 7001 端口未对外开放（仅回环）
- [ ] ufw 防火墙已开，只放行 22/80/443
- [ ] 后台随机路径未公开

---

> ⚠️ 合规声明：中国大陆未获电信主管部门批准擅自经营 VPN/代理服务属违法行为。
> 本文档仅作技术部署说明，不构成运营鼓励或法律建议，请自行评估并承担全部责任与风险。

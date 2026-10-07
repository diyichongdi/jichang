-- ============================================================
--  机场全栈站 · 数据库 Schema (SQLite / sql.js)
--  说明：本 schema 同时可用于 MySQL/Postgres（字段用通用类型，
--        迁移到生产库时调整类型映射即可，见 docs/DATABASE.md）
-- ============================================================

PRAGMA foreign_keys = ON;

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname      TEXT,
  role          TEXT NOT NULL DEFAULT 'user',      -- user / admin
  email_verified INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',    -- active / disabled
  referral_code TEXT UNIQUE,
  referrer_id   INTEGER,
  balance       REAL NOT NULL DEFAULT 0,           -- 账户余额(元)
  total_traffic BIGINT NOT NULL DEFAULT 0,         -- 已用/分配流量(字节)
  plan_id      INTEGER,                            -- 当前套餐
  plan_expire_at  INTEGER,                        -- 套餐到期(Unix秒)
  last_login_at   INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER
);

-- 邮箱验证令牌
CREATE TABLE IF NOT EXISTS email_tokens (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  token     TEXT NOT NULL,
  type      TEXT NOT NULL,            -- verify_email / reset_password
  expires_at INTEGER NOT NULL,
  used      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 套餐
CREATE TABLE IF NOT EXISTS plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,           -- 月付单价(元)
  price_q     REAL,                    -- 季付单价(元), 为空则按月价
  price_y     REAL,                    -- 年付单价(元), 为空则按月价
  cycle       TEXT NOT NULL DEFAULT 'month',   -- 默认周期 month / quarter / year / once
  traffic     INTEGER NOT NULL,        -- 流量(GB)
  devices     INTEGER NOT NULL DEFAULT 0,  -- 设备数, 0=不限
  node_group  TEXT,                    -- 可用节点组
  rate        REAL NOT NULL DEFAULT 1, -- 倍率
  desc        TEXT,                    -- 一句话卖点
  featured    INTEGER NOT NULL DEFAULT 0, -- 推荐角标 0/1
  sort        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 订单
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT UNIQUE NOT NULL,
  user_id     INTEGER NOT NULL,
  plan_id     INTEGER,
  type        TEXT NOT NULL DEFAULT 'plan',   -- plan / recharge / flow_pack
  amount      REAL NOT NULL,           -- 应付金额(元)
  status      TEXT NOT NULL DEFAULT 'pending', -- pending / paid / cancelled / refunded
  currency    TEXT NOT NULL DEFAULT 'CNY',
  pay_method  TEXT,                    -- alipay / wechat / usdt / balance
  provider    TEXT,                    -- 支付驱动名
  pay_trade_no TEXT,                   -- 支付平台流水号
  paid_at     INTEGER,
  extra       TEXT,                    -- JSON 扩展
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 支付流水（回调记录，审计用）
CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT NOT NULL,
  provider    TEXT NOT NULL,
  trade_no    TEXT,
  provider_raw TEXT,                   -- 支付平台原始回调
  status      TEXT NOT NULL DEFAULT 'created',
  ip          TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 充值订单(按量)与钱包流水
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  amount     REAL NOT NULL,
  type       TEXT NOT NULL,            -- recharge / consume / refund / reward
  order_no   TEXT,
  remark     TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- 公告
CREATE TABLE IF NOT EXISTS notices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  content    TEXT,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 系统设置 (KV)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 管理员权限 (模块化授权, 按 admin 用户存储)
CREATE TABLE IF NOT EXISTS admin_perms (
  user_id INTEGER NOT NULL,
  perm    TEXT NOT NULL,
  PRIMARY KEY (user_id, perm)
);
CREATE INDEX IF NOT EXISTS idx_admin_perms_user ON admin_perms(user_id);

-- ============================================================
--  Phase 2 新增表：节点 / 流量 / 工单 / 优惠码 / 卡密 / 返佣 / 通知
-- ============================================================

-- 节点(自管模式：订阅下发与节点卡的真实数据源)
CREATE TABLE IF NOT EXISTS nodes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,                 -- 名称, 如 "香港01"
  code        TEXT DEFAULT '',               -- 地区码, 如 HK
  region      TEXT DEFAULT 'Asia',           -- 大区 Asia/NorthAm/Europe/Oceania
  host        TEXT DEFAULT '',               -- 节点地址(订阅用户链路用)
  port        INTEGER DEFAULT 0,
  protocol    TEXT DEFAULT 'vless',          -- vless / trojan / ss
  node_id     TEXT DEFAULT '',               -- 链路凭证: uuid / 密码 / 端口密码
  security    TEXT DEFAULT 'none',           -- none / reality / tls
  sni         TEXT DEFAULT '',
  alpn        TEXT DEFAULT '',
  flow        TEXT DEFAULT '',
  rate        REAL DEFAULT 1,                -- 倍率
  latency     INTEGER DEFAULT 0,             -- 延迟ms(探测或手工)
  load        INTEGER DEFAULT 0,             -- 负载%
  online      INTEGER DEFAULT 1,
  group_name  TEXT DEFAULT 'default',
  sort        INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(active, sort);

-- 流量流水(自管模式计量记录)
CREATE TABLE IF NOT EXISTS flow_usages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  node_id     INTEGER,
  up          BIGINT DEFAULT 0,              -- 上行 bytes
  down        BIGINT DEFAULT 0,              -- 下行 bytes
  traffic     BIGINT DEFAULT 0,              -- 合计 bytes
  rate        REAL DEFAULT 1,
  period      TEXT DEFAULT '',               -- 归属自然月 YYYY-MM
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(node_id) REFERENCES nodes(id)
);
CREATE INDEX IF NOT EXISTS idx_flow_user ON flow_usages(user_id, period);

-- 工单(客户自助)
CREATE TABLE IF NOT EXISTS tickets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  subject       TEXT NOT NULL,
  content       TEXT NOT NULL,
  level         TEXT DEFAULT 'normal',       -- normal / urgent
  status        TEXT DEFAULT 'open',          -- open / closed
  admin_replied INTEGER DEFAULT 0,
  last_reply_by INTEGER,                      -- user_id 或 null(管理员)
  last_reply_at INTEGER,
  closed_at     INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL,
  user_id     INTEGER,                        -- null 或作者user_id(admin时 null)
  is_admin    INTEGER DEFAULT 0,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(ticket_id) REFERENCES tickets(id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_msg ON ticket_messages(ticket_id);

-- 优惠码
CREATE TABLE IF NOT EXISTS coupons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT UNIQUE NOT NULL,
  type          TEXT DEFAULT 'percent',       -- percent / fixed
  value         REAL NOT NULL,                -- 折扣(百分比 0-100) 或 直减(元)
  min_amount    REAL DEFAULT 0,               -- 订单最低金额
  limit_times   INTEGER DEFAULT 0,            -- 总可用次数, 0=不限
  used_times    INTEGER DEFAULT 0,
  plan_ids      TEXT DEFAULT '',              -- 可用套餐id, 逗号分隔, 空=全部
  per_user      INTEGER DEFAULT 1,            -- 每人限用次数
  expired_at    INTEGER,                      -- 过期时间戳
  status        INTEGER DEFAULT 1,            -- 1启用 0禁用
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status, expired_at);

-- 卡密(充值卡)
CREATE TABLE IF NOT EXISTS card_keys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  amount      REAL NOT NULL,                 -- 充值金额(元)
  batch       TEXT DEFAULT '',
  status      TEXT DEFAULT 'unused',          -- unused / used
  used_by     INTEGER,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_cardkeys_status ON card_keys(status, batch);

-- 邀请返佣明细
CREATE TABLE IF NOT EXISTS commission_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,              -- 收款人(推荐者)
  from_user_id INTEGER NOT NULL,              -- 来源(被推荐者)
  order_id     INTEGER,
  order_no     TEXT DEFAULT '',
  amount       REAL NOT NULL,                 -- 返佣金额(元)
  source       TEXT DEFAULT 'plan',           -- plan(subscription) paid
  status       TEXT DEFAULT 'paid',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(from_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_comm_user ON commission_records(user_id);

-- 站内通知(到期/用量提醒、订单通知等汇总)
CREATE TABLE IF NOT EXISTS user_notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT DEFAULT 'system',          -- system / reminder / order_ok
  title       TEXT NOT NULL,
  content     TEXT DEFAULT '',
  read        INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON user_notifications(user_id, read);

-- 索引
CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_no);

-- 卡密兑换隐藏其为未使用状态（用于并发核销的唯一约束）
CREATE UNIQUE INDEX IF NOT EXISTS idx_cardkeys_code ON card_keys(code);

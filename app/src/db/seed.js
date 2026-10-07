// ============================================================
//  数据初始化 (seed)
//  用法: npm run seed  (或 node src/db/seed.js)
//  创建: 管理账号 / 默认套餐 / 公告
// ============================================================
const db = require("./index");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { allPerms, setPerms } = require("../services/permission.service");

async function seed() {
  await db.init();

  // 管理账号
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";
  if (!db.get("SELECT id FROM users WHERE email=?", [adminEmail])) {
    db.run(
      "INSERT INTO users(email,password_hash,nickname,role,email_verified,referral_code) VALUES(?,?,?,?,1,?)",
      [adminEmail, bcrypt.hashSync(adminPassword, 10), "Admin", "admin", nanoid(8).toUpperCase()]
    );
    const adminId = db.get("SELECT id FROM users WHERE email=?", [adminEmail]).id;
    // 授予全部权限点
    const perms = allPerms();
    setPerms(adminId, perms);
    console.log(`[seed] 已创建管理员: ${adminEmail} / ${adminPassword} (权限: ${perms.length} 项)`);
  } else {
    // 已存在也确保有权限
    const adminId = db.get("SELECT id FROM users WHERE email=?", [adminEmail]).id;
    const perms = allPerms();
    setPerms(adminId, perms);
    console.log("[seed] 管理员已存在，跳过（已补全权限）");
  }

  // 默认套餐
  const plans = [
    ["入门", 15, "month", 100, 6, "standard", 1, 0, "适合轻度使用", ["IEPL 精品专线", "100GB/月流量", "6 设备同时在线", "客服工单支持"]],
    ["标准", 30, "month", 300, 10, "standard", 1, 1, "性价比之选", ["IEPL 精品专线", "300GB/月流量", "10 设备同时在线", "旗舰客服优先"]],
    ["专业", 60, "month", 800, 0, "premium", 1, 2, "重度用户首选", ["全节点解锁", "800GB/月流量", "不限设备", "独立线路优先"]],
  ];
  for (const [name, price, cycle, traffic, devices, nodeGroup, rate, sortValue, desc, features] of plans) {
    const existed = db.get("SELECT id FROM plans WHERE name=?", [name]);
    if (!existed) {
      db.run(
        "INSERT INTO plans(name,price,cycle,traffic,devices,node_group,rate,sort,active,desc,features) VALUES(?,?,?,?,?,?,?,?,1,?,?)",
        [name, price, cycle, traffic, devices, nodeGroup, rate, sortValue, desc, JSON.stringify(features)]
      );
      console.log(`[seed] 套餐: ${name}`);
    } else if (!existed.desc) {
      db.run("UPDATE plans SET desc=?, features=? WHERE id=?", [desc, JSON.stringify(features), existed.id]);
    }
  }

  // 示例节点(自管模式数据源)
  const nodes = [
    ["香港-01", "HK", "Asia", "hk01.example.com", 443, "vless", "uuid-0000-aaaa-hk01", "none", "", "default", 1],
    ["香港-02", "HK", "Asia", "hk02.example.com", 443, "vless", "uuid-0000-aaaa-hk02", "reality", "hk02.example.com", "premium", 2],
    ["新加坡-01", "SG", "Asia", "sg01.example.com", 443, "trojan", "sg01-trojan-pass", "tls", "sg01.example.com", "default", 3],
    ["日本-01", "JP", "Asia", "jp01.example.com", 443, "vless", "uuid-0000-aaaa-jp01", "none", "", "premium", 4],
    ["美国-01", "US", "NorthAm", "us01.example.com", 443, "ss", "us01-ss-password", "none", "", "default", 5],
  ];
  for (const [name, code, region, host, port, protocol, nodeId, security, sni, group, sortValue] of nodes) {
    if (!db.get("SELECT id FROM nodes WHERE name=?", [name])) {
      db.run(
        "INSERT INTO nodes(name,code,region,host,port,protocol,node_id,security,sni,group_name,sort,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)",
        [name, code, region, host, port, protocol, nodeId, security, sni, group, sortValue]
      );
      console.log(`[seed] 节点: ${name}`);
    }
  }

  // 默认公告
  if (!db.get("SELECT id FROM notices LIMIT 1")) {
    db.run("INSERT INTO notices(title,content) VALUES(?,?)", ["欢迎使用", "注册即享免费试用，稳定不跑路。"]);
    console.log("[seed] 默认公告已创建");
  }

  console.log("[seed] 完成");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[seed] 失败", e);
    process.exit(1);
  });

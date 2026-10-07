// ============================================================
//  端到端冒烟测试 (本地验证)
//  启动 server.js 子进程 -> 走通 注册/登录/下单/epay回调/余额/管理
//  用法: node scripts/e2e.js
// ============================================================
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const BASE = "http://localhost:3999";
const crypto = require("crypto");

function request(method, urlPath, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + urlPath);
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: data ? { ...headers, "Content-Length": Buffer.byteLength(data) } : headers,
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          let j = null;
          try { j = JSON.parse(b); } catch (e) {}
          resolve({ status: res.statusCode, json: j, raw: b });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const md5 = (s) => crypto.createHash("md5").update(s, "utf8").digest("hex");
function epaySign(params, key) {
  const str = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "" && k !== "sign" && k !== "sign_type")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return md5(str + key);
}

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (extra ? "  " + JSON.stringify(extra) : ""));
}

async function waitServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { await request("GET", "/health"); return true; } catch (e) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  process.env.PORT = "3999";
  process.env.JWT_SECRET = "e2e_secret";
  process.env.BASE_URL = BASE;
  process.env.WEB_URL = "http://localhost:8800";
  process.env.EPAY_ENABLED = "true";
  process.env.EPAY_PID = "10000";
  process.env.EPAY_MERCHANT_KEY = "test_merchant_key";
  process.env.EPAY_API_URL = "https://pay.example.com";
  process.env.ALIPAY_ENABLED = "false";
  process.env.USDT_ENABLED = "false";

  const server = spawn(process.execPath, ["src/server.js"], {
    cwd: path.join(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write("[svr] " + d));
  server.stderr.on("data", (d) => process.stdout.write("[svr-err] " + d));

  if (!(await waitServer())) {
    console.error("服务器未启动");
    server.kill();
    process.exit(1);
  }
  console.log("--- 服务器就绪 ---\n");

  // 1. 公开: 套餐列表
  let r = await request("GET", "/api/public/plans");
  check("公开: 套餐列表", r.status === 200 && Array.isArray(r.json.data) && r.json.data.length >= 3, r.json && r.json.data);

  // 2. 注册
  const email = `user${Date.now()}@test.com`;
  r = await request("POST", "/api/auth/register", { body: { email, password: "pass123456" } });
  check("注册", r.json && r.json.code === 0, r.json);

  // 3. 登录
  r = await request("POST", "/api/auth/login", { body: { email, password: "pass123456" } });
  check("登录", r.status === 200 && r.json.data && r.json.data.token, r.json && r.json.data);
  const token = r.json.data.token;
  const userId = r.json.data.user.id;

  // 4. 我的信息
  r = await request("GET", "/api/auth/me", { token });
  check("me", r.status === 200 && r.json.data.email === email, r.json && r.json.data);

  // 5. 可用支付渠道
  r = await request("GET", "/api/orders/channels");
  check("支付渠道(含余额)", r.status === 200 && r.json.data.includes("balance"), r.json && r.json.data);

  // 6. 选择第一个套餐并下单(epay)
  const plans = (await request("GET", "/api/public/plans")).json.data;
  const plan = plans[0];
  r = await request("POST", "/api/orders/create", { body: { planId: plan.id, method: "epay" }, token });
  check("下单(epay)", r.status === 200 && r.json.data && r.json.data.order && r.json.data.pay, r.json && r.json.data);
  const orderNo = r.json.data.order.orderNo;

  // 7. 余额充值下单
  r = await request("POST", "/api/orders/create", { body: { type: "recharge", amount: 100, method: "epay" }, token });
  check("充值下单", r.status === 200 && r.json.data.order.type === "recharge", r.json && r.json.data.order);

  // 8. 模拟 epay 异步回调(验签) 履约
  const notifyParams = {
    pid: "10000",
    trade_no: "T" + Date.now(),
    out_trade_no: orderNo,
    type: "alipay",
    name: "套餐",
    money: String(plan.price),
    trade_status: "TRADE_SUCCESS",
    sign_type: "MD5",
  };
  notifyParams.sign = epaySign(notifyParams, "test_merchant_key");
  r = await request("POST", "/api/payments/notify/epay", { body: notifyParams });
  check("epay回调验签履约", r.raw === "success", r.raw);

  // 9. 订单状态已支付
  r = await request("GET", `/api/orders/status/${orderNo}`, { token });
  check("订单状态=已支付且套餐激活", r.status === 200 && r.json.data.status === "paid", r.json && r.json.data);

  // 10. 我的订单列表
  r = await request("GET", "/api/orders/list", { token });
  check("我的订单列表", r.status === 200 && r.json.data.some((o) => o.order_no === orderNo), r.json && r.json.data);

  // 11. 用户总览
  r = await request("GET", "/api/user/overview", { token });
  check("用户总览(套餐已绑)", r.status === 200 && r.json.data.plan && r.json.data.plan.id === plan.id, r.json && r.json.data);

  // 12. 修改资料与密码
  r = await request("PUT", "/api/user/profile", { body: { nickname: "测试君" }, token });
  check("修改资料", r.status === 200 && r.json.code === 0, r.json);
  r = await request("GET", "/api/auth/me", { token });
  check("昵称已更新", r.json.data.nickname === "测试君", r.json.data);

  // 13. 管理端: 登录管理员 (seed 已建 admin@example.com/admin123456)
  r = await request("POST", "/api/auth/login", { body: { email: "admin@example.com", password: "admin123456" } });
  const adminToken = r.json && r.json.data && r.json.data.token;
  check("管理员登录", r.status === 200 && !!adminToken);

  if (adminToken) {
    r = await request("GET", "/api/admin/stats", { token: adminToken });
    check("管理统计", r.status === 200 && r.json.data.totalUsers >= 1, r.json && r.json.data);
    r = await request("PUT", `/api/admin/users/${userId}`, { body: { balance: 50 }, token: adminToken });
    check("管理改余额", r.status === 200 && r.json.code === 0, r.json);
    r = await request("POST", "/api/admin/notices", { body: { title: "系统公告", content: "测试" }, token: adminToken });
    check("发布公告", r.status === 200 && r.json.code === 0, r.json);
  }

  // 14. 权限隔离: 普通用户访问 admin 应403
  r = await request("GET", "/api/admin/stats", { token });
  check("权限隔离(普通用户->管理被拒)", r.status === 403, { status: r.status, msg: r.json && r.json.msg });

  const failed = results.filter((x) => !x.pass).length;
  console.log(`\n=== 结果: ${results.length - failed}/${results.length} 通过 ===`);
  server.kill();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E 异常", e);
  process.exit(1);
});

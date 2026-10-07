// ============================================================
//  机场落地页 · 认证 + 购买流程
//  依赖 js/api.js (window.JCAPI)
//  功能：登录 / 注册 / 购买套餐 / 余额支付 / 支付结果
// ============================================================
(function () {
  "use strict";

  const api = window.JCAPI;
  if (!api) {
    console.error("[app] 未加载 js/api.js");
    return;
  }

  const state = { user: null, buyingPlan: null, channels: [] };

  // 邀请码: 从邀请链接 ?ref=CODE 捕获, 注册时自动带上
  function captureRef() {
    try {
      const m = location.search.match(/[?&]ref=([^&]+)/);
      if (m) {
        const code = decodeURIComponent(m[1]).toUpperCase().trim();
        if (code) localStorage.setItem("jc:ref", code);
      }
      return localStorage.getItem("jc:ref") || "";
    } catch (e) {
      return "";
    }
  }

  // ---------- 通用弹窗 ----------
  let ov = null;
  function ensureOverlay() {
    if (ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeModal();
    });
    document.body.appendChild(ov);
    return ov;
  }
  function showModal(html) {
    const o = ensureOverlay();
    o.innerHTML = html;
    o.classList.add("open");
    // 绑定关闭按钮
    o.querySelectorAll(".modal-close").forEach((b) => b.addEventListener("click", closeModal));
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (ov) {
      ov.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  function field(key) {
    const el = document.getElementById(key);
    return el ? el.value.trim() : "";
  }

  // ---------- 登录 / 注册 / 找回密码 ----------
  function showAuth(mode, { onSuccess } = {}) {
    const isLogin = mode === "login";
    const isForgot = mode === "forgot";
    showModal(`
      <div class="modal">
        <div class="modal-titlebar">
          <button class="modal-close" aria-label="关闭">&times;</button>
          <h3>${isForgot ? "找回密码" : isLogin ? "登录账号" : "注册账号"}</h3>
        </div>
        <form id="jc-auth-form">
          ${isForgot
            ? '<div class="field"><label>邮箱</label><input id="a-email" type="email" placeholder="you@example.com" required autocomplete="email" /></div>'
            : '<div class="field"><label>邮箱</label><input id="a-email" type="email" placeholder="you@example.com" required autocomplete="email" /></div>' +
              '<div class="field"><label>密码</label><input id="a-pass" type="password" placeholder="${isLogin ? "密码" : "至少 8 位"}" required autocomplete="${isLogin ? "current-password" : "new-password"}" /></div>' +
              (isLogin ? "" : '<div class="field"><label>确认密码</label><input id="a-pass2" type="password" placeholder="再次输入密码" required /></div>')}
          <div class="error-msg" id="a-err"></div>
          <button class="btn btn-primary" type="submit">${isForgot ? "发送重置邮件" : isLogin ? "登录" : "注册"}</button>
        </form>
        <div class="switch-line">
          ${isForgot
            ? '<a id="a-switch">返回登录</a>'
            : isLogin
            ? '还没有账号？<a id="a-switch">去注册</a> <a id="a-forgot" style="margin-left:10px">忘记密码？</a>'
            : '已有账号？<a id="a-switch">去登录</a>'}
        </div>
      </div>
    `);
    const onSub = async (e) => {
      e.preventDefault();
      const email = field("a-email");
      const err = document.getElementById("a-err");
      const form = document.getElementById("jc-auth-form");
      const btn = form ? form.querySelector("button[type=submit]") : null;
      // 客户端校验
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.textContent = "请输入有效的邮箱地址";
        return;
      }
      if (!isForgot) {
        const password = field("a-pass");
        if (!password) {
          err.textContent = "请输入密码";
          return;
        }
        if (!isLogin) {
          if (password.length < 8) {
            err.textContent = "密码至少 8 位";
            return;
          }
          const password2 = field("a-pass2");
          if (password !== password2) {
            err.textContent = "两次输入的密码不一致";
            return;
          }
        }
      }
      if (btn) { btn.disabled = true; btn.textContent = "提交中…"; }
      try {
        let r;
        if (isForgot) {
          r = await api.forgotPassword({ email });
          err.style.color = ""; err.textContent = r.msg || "重置邮件已发送，请查收邮箱";
          if (btn) { btn.disabled = false; btn.textContent = "重新发送"; }
          return;
        }
        r = isLogin
          ? await api.login({ email, password: field("a-pass") })
          : await api.register({ email, password: field("a-pass"), inviteCode: captureRef() });
        api.setToken(r.data.token);
        await refreshUser();
        closeModal();
        if (typeof onSuccess === "function") onSuccess();
      } catch (ex) {
        err.textContent = ex.message || "操作失败";
        if (btn) { btn.disabled = false; btn.textContent = isForgot ? "发送重置邮件" : isLogin ? "登录" : "注册"; }
      }
    };
    document.getElementById("jc-auth-form").addEventListener("submit", onSub);
    document.getElementById("a-switch").addEventListener("click", () =>
      showAuth(isForgot ? "login" : isLogin ? "register" : "login", { onSuccess })
    );
    const forgot = document.getElementById("a-forgot");
    if (forgot) forgot.addEventListener("click", () => showAuth("forgot"));
  }

  // ---------- 刷新用户态 + 更新导航 ----------
  async function refreshUser() {
    if (!api.isLoggedIn()) {
      state.user = null;
      renderNavUser();
      return;
    }
    try {
      const r = await api.me();
      state.user = r.data;
    } catch (e) {
      api.setToken("");
      state.user = null;
    }
    renderNavUser();
  }

  function renderNavUser() {
    var loginBtn = document.querySelector(".nav-actions .btn-login");
    if (!loginBtn) return;
    if (state.user) {
      loginBtn.classList.add("btn-user");
      loginBtn.innerHTML = '<span class="user-chip"><span class="dot"></span>' + escapeHtml(state.user.nickname || state.user.email) + '</span>';
      loginBtn.href = "#/dashboard";
      var cp = document.getElementById("nav-dashboard");
      if (!cp) {
        cp = document.createElement("a");
        cp.id = "nav-dashboard";
        cp.href = "dashboard.html#/dashboard";
        cp.className = "btn btn-primary btn-sm";
        cp.textContent = "控制面板";
        loginBtn.after(cp);
      }
    } else {
      loginBtn.classList.remove("btn-user");
      loginBtn.innerHTML = "登录";
      loginBtn.href = "#";
      var cp = document.getElementById("nav-dashboard");
      if (cp) cp.remove();
    }
  }

  // ---------- 购买流程 ----------
  function buyCycle() {
    try { return window.__cycle ? (window.__cycle() || "month") : "month"; } catch (e) { return "month"; }
  }

  async function startBuy(plan) {
    state.buyingPlan = plan;
    if (!api.isLoggedIn()) {
      showAuth("login", { onSuccess: () => startBuyAfterAuth(plan) });
      return;
    }
    await startBuyAfterAuth(plan);
  }

  async function startBuyAfterAuth(plan) {
    let channels = [];
    try {
      channels = (await api.channels()).data || [];
    } catch (e) {
      /* 至少保留余额 */
    }
    if (!channels.includes("balance")) channels.push("balance");
    state.channels = channels;

    const cycle = buyCycle();
    const unitLabel = { month: "月", quarter: "季", year: "年" }[cycle] || "月";
    const k = { month: "price", quarter: "priceQ", year: "priceY" }[cycle] || "price";
    const price = plan[k] != null ? plan[k] : plan.price;

    showModal(`
      <div class="modal">
        <div class="modal-titlebar">
          <button class="modal-close" aria-label="关闭">&times;</button>
          <h3>购买 · ${escapeHtml(plan.name)}</h3>
        </div>
        <div class="order-no">¥${price} / ${unitLabel}</div>
        <div class="field"><label>选择支付方式</label>
          <div class="pay-methods">
            ${channels
              .map(
                (c) =>
                  `<div class="pay-method" data-channel="${c}">
                     <span class="ico">${payIcon(c)}</span>${payName(c)}
                   </div>`
              )
              .join("")}
          </div>
        </div>
        <div class="error-msg" id="b-err"></div>
        <button class="btn btn-primary" id="b-go" disabled>请选择支付方式</button>
      </div>
    `);
    ov.querySelectorAll(".pay-method").forEach((el) => {
      el.addEventListener("click", () => {
        ov.querySelectorAll(".pay-method").forEach((x) => x.classList.remove("selected"));
        el.classList.add("selected");
        state.payChannel = el.dataset.channel;
        document.getElementById("b-go").disabled = false;
        document.getElementById("b-go").textContent = `去支付（${payName(el.dataset.channel)}）`;
      });
    });
    document.getElementById("b-go").addEventListener("click", () => doPay(plan));
  }

  async function doPay(plan) {
    const btn = document.getElementById("b-go");
    const err = document.getElementById("b-err");
    btn.disabled = true;
    btn.textContent = "处理中…";
    try {
      const method = state.payChannel || "epay";
      const cycle = buyCycle();
      const backendPlans = (await api.plans()).data || [];
      const bp = backendPlans.find((p) => p.name === plan.name);
      const body = bp
        ? { planId: bp.id, method, cycle }
        : { type: "recharge", amount: plan.price, method };
      const r = await api.createOrder(body);
      if (method === "balance") {
        await showPaySuccess("balance", r.data.order, plan);
      } else {
        await showPayWait(r.data.pay, r.data.order, plan);
        // 简单轮询订单状态，若已支付则显示成功 + 订阅
        pollOrder(r.data.order.orderNo, plan);
      }
    } catch (ex) {
      err.textContent = ex.message || "下单失败，请重试";
      btn.disabled = false;
      btn.textContent = "重试";
    }
  }

  // 弹出支付等待页（非余额，返回链接/地址）
  async function showPayWait(pay, order, plan) {
    const payUrl = pay && (pay.payUrl || pay.qrContent || "");
    const isUrl = payUrl && /^https?:\/\//.test(payUrl);
    showModal(`
      <div class="modal">
        <div class="modal-titlebar">
          <button class="modal-close" aria-label="关闭">&times;</button>
          <h3>等待支付</h3>
        </div>
        <div class="pay-result">
          <div class="order-no">订单号：${order.orderNo}</div>
          ${payUrl && isUrl
            ? `<p>请在支付平台完成付款</p>
               <div class="copy-row">
                 <input readonly value="${escapeHtml(payUrl)}" />
                 <button class="btn btn-ghost" id="open-pay">去支付</button>
               </div>`
            : `<p>请向以下地址转账，并复制订单号备注</p>
               <div class="copy-row">
                 <input readonly value="${escapeHtml(payUrl || "")}" id="wallet-addr" />
                 <button class="btn btn-ghost" id="copy-pay">复制</button>
               </div>`}
          <p class="order-no" style="margin-top:12px">支付完成后本页将自动更新</p>
        </div>
      </div>
    `);
    if (isUrl) {
      document.getElementById("open-pay").addEventListener("click", () => window.open(payUrl, "_blank"));
    } else {
      document.getElementById("copy-pay").addEventListener("click", async () => {
        const inp = document.getElementById("wallet-addr");
        inp.select();
        try {
          await navigator.clipboard.writeText(payUrl);
          alert("已复制收款地址");
        } catch (e) {
          /* ignore */
        }
      });
    }
  }

  async function showPaySuccess(kind, order, plan) {
    showModal(`
      <div class="modal">
        <div class="modal-titlebar">
          <button class="modal-close" aria-label="关闭">&times;</button>
          <h3>支付成功 ✓</h3>
        </div>
        <div class="pay-result">
          <p>订单 ${order.orderNo} 已完成</p>
          <p class="order-no">${kind === "balance" ? "已从余额扣款" : "套餐已开通"}</p>
          <button class="btn btn-primary" id="done-btn">查看我的订阅</button>
        </div>
      </div>
    `);
    document.getElementById("done-btn").addEventListener("click", () => {
      closeModal();
      showCenter();
    });
  }

  // 轮询订单直到 paid
  function pollOrder(orderNo, plan) {
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const r = await api.orderStatus(orderNo);
        if (r.data.status === "paid") {
          clearInterval(iv);
          await refreshUser();
          showPaySuccess("paid", r.data, plan);
        } else if (tries > 40) {
          clearInterval(iv);
        }
      } catch (e) {
        clearInterval(iv);
      }
    }, 2500);
  }

  // ---------- 用户中心(直接跳个人面板) ----------
  async function showCenter() {
    if (!api.isLoggedIn()) {
      showAuth("login", { onSuccess: () => { location.href = "dashboard.html#/dashboard"; } });
      return;
    }
    location.href = "dashboard.html#/dashboard";
  }

  // 未登录先登录，登录后跳转个人面板指定页
  function gotoCenter(hash) {
    if (api.isLoggedIn()) {
      location.href = "dashboard.html" + (hash || "#/dashboard");
    } else {
      showAuth("login", { onSuccess: () => { location.href = "dashboard.html" + (hash || "#/dashboard"); } });
    }
  }

  // ---------- 辅助 ----------
  function payName(c) {
    return { alipay: "支付宝", epay: "易支付", usdt: "USDT", balance: "余额" }[c] || c;
  }
  function payIcon(c) {
    return { alipay: "🅰️", epay: "💳", usdt: "₮", balance: "💰" }[c] || "💳";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // ---------- 事件绑定 ----------
  document.addEventListener("click", (e) => {
    // 购买按钮(套餐卡片) -> 跳个人面板充值中心
    const buyBtn = e.target.closest("[data-buy]");
    if (buyBtn) {
      e.preventDefault();
      gotoCenter("#/wallet");
      return;
    }
    // 导航登录
    const login = e.target.closest(".nav-actions .btn-login");
    if (login) {
      e.preventDefault();
      if (api.isLoggedIn()) showCenter();
      else showAuth("login");
      return;
    }
    // "立即购买/立即开始" 等 data-center 链接 -> 跳个人面板充值中心
    const center = e.target.closest("[data-center]");
    if (center) {
      e.preventDefault();
      gotoCenter("#/wallet");
      return;
    }
    // data-login
    const dl = e.target.closest("[data-login]");
    if (dl && !dl.classList.contains("btn")) {
      e.preventDefault();
      if (api.isLoggedIn()) showCenter();
      else showAuth("login");
    }
  });

  // 初始化
  refreshUser();
})();

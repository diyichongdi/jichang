// ============================================================
//  机场落地页 · SPA 哈希路由器
//  依赖 js/api.js (window.JCAPI)
// ============================================================
(function () {
  "use strict";

  const routes = {};
  const guards = [];
  let currentRoute = null;
  let currentCleanup = null;

  function onHashChange() {
    const hash = location.hash.slice(1) || "/";
    const parts = hash.split("?");
    const path = parts[0];
    const qs = {};
    if (parts[1]) {
      parts[1].split("&").forEach(function (s) {
        const i = s.indexOf("=");
        if (i >= 0) qs[s.slice(0, i)] = decodeURIComponent(s.slice(i + 1));
      });
    }
    let handler = routes[path];
    if (!handler) {
      // 支持形如 /tickets/:id 的路径参数路由
      const ps = path.split("/");
      for (const key of Object.keys(routes)) {
        const ks = key.split("/");
        if (ks.length !== ps.length || !key.includes(":")) continue;
        let m = true;
        for (let i = 0; i < ks.length; i++) {
          if (ks[i].startsWith(":")) continue;
          if (ks[i] !== ps[i]) { m = false; break; }
        }
        if (m) { handler = routes[key]; break; }
      }
    }
    const routeParams = {};
    const cleanup = currentCleanup;
    if (currentCleanup) {
      try { currentCleanup(); } catch (e) {}
      currentCleanup = null;
    }
    currentRoute = path;
    if (!handler) {
      renderNotFound();
      return;
    }
    let ok = true;
    for (const g of guards) {
      if (g(path, qs) === false) {
        ok = false;
        break;
      }
    }
    if (!ok) return;
    handler(path, qs, function (html, cleanup) {
      const main = document.getElementById("page-main");
      if (main) main.innerHTML = html;
      currentCleanup = cleanup || null;
    }, qs, routeParams);
  }

  function renderNotFound() {
    const main = document.getElementById("page-main");
    if (main) {
      main.innerHTML = '<div class="empty-state"><div class="ico">🔍</div><h3>页面未找到</h3><p>请检查地址或返回首页</p><a href="#/" class="btn btn-primary" style="margin-top:16px;display:inline-block;">返回首页</a></div>';
    }
  }

  // ---------- 通用工具 ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function badge(status) {
    const map = {
      active: '<span class="badge badge-success">正常</span>',
      paid: '<span class="badge badge-success">已支付</span>',
      pending: '<span class="badge badge-warning">待支付</span>',
      cancelled: '<span class="badge badge-muted">已取消</span>',
      refunded: '<span class="badge badge-danger">已退款</span>',
      disabled: '<span class="badge badge-danger">已禁用</span>',
      admin: '<span class="badge badge-accent">管理员</span>',
      user: '<span class="badge badge-muted">用户</span>',
      superadmin: '<span class="badge badge-primary">超级管理员</span>',
      email_verified: '<span class="badge badge-success">已验证</span>',
      email_unverified: '<span class="badge badge-muted">未验证</span>',
    };
    return map[status] || '<span class="badge badge-muted">' + esc(status) + '</span>';
  }
  function timeAgo(ts) {
    if (!ts) return "—";
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return "刚刚";
    if (diff < 3600) return Math.floor(diff / 60) + "分钟前";
    if (diff < 86400) return Math.floor(diff / 3600) + "小时前";
    return Math.floor(diff / 86400) + "天前";
  }

  // ---------- 模态框 ----------
  let ov = null;
  function ensureOverlay() {
    if (ov) return ov;
    ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.addEventListener("click", function (e) {
      if (e.target === ov) closeModal();
    });
    document.body.appendChild(ov);
    return ov;
  }
  function showModal(html) {
    const o = ensureOverlay();
    o.innerHTML = html;
    o.classList.add("open");
    o.querySelectorAll(".modal-close").forEach(function (b) { b.addEventListener("click", closeModal); });
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (ov) { ov.classList.remove("open"); document.body.style.overflow = ""; }
  }

  // ---------- 路由注册 ----------
  function on(path, handler) { routes[path] = handler; }
  function guard(fn) { guards.push(fn); }

  // ---------- 跳转 ----------
  function navigate(path) { location.hash = path; }

  // ---------- 加载状态 ----------
  function loading(text) {
    return '<div class="state-block"><span class="spinner" aria-hidden="true"></span>' +
      '<p class="state-text">' + esc(text || "加载中…") + '</p></div>';
  }

  // ---------- 空状态 ----------
  function empty(icon, title, text, actionHtml) {
    return '<div class="empty-state"><div class="ico">' + (icon || "🗂️") + '</div>' +
      (title ? '<h3>' + esc(title) + '</h3>' : '') +
      (text ? '<p>' + esc(text) + '</p>' : '') +
      (actionHtml ? '<div class="empty-actions">' + actionHtml + '</div>' : '') +
      '</div>';
  }

  // ---------- 错误态(可选重试) ----------
  let retryCallback = null;
  function error(msg, retry) {
    retryCallback = typeof retry === "function" ? retry : null;
    return '<div class="empty-state state-error"><div class="ico">⚠️</div><h3>加载失败</h3>' +
      (msg ? '<p>' + esc(msg) + '</p>' : '<p>请稍后重试</p>') +
      (retryCallback ? '<div class="empty-actions"><button class="btn btn-primary" data-sp-retry>重试</button></div>' : '') +
      '</div>';
  }
  // 文档级委托：点击 [data-sp-retry] 触发最近一次注册的重试回调
  document.addEventListener("click", function (e) {
    const el = e.target && e.target.closest ? e.target.closest("[data-sp-retry]") : null;
    if (el && retryCallback) retryCallback();
  });

  // ---------- 确认弹窗 ----------
  function confirm(opts) {
    const o = ensureOverlay();
    o.innerHTML =
      '<div class="modal confirm-modal" role="alertdialog" aria-modal="true">' +
      '<div class="modal-titlebar"><button class="modal-close" aria-label="关闭">&times;</button>' +
      '<h3>' + esc(opts.title || "确认操作") + '</h3></div>' +
      (opts.text ? '<div class="modal-body">' + opts.text + '</div>' : '') +
      '<div class="modal-actions">' +
      '<button class="btn btn-ghost" data-cancel>' + esc(opts.cancelText || "取消") + '</button>' +
      '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-ok>' + esc(opts.okText || "确定") + '</button>' +
      '</div></div>';
    o.classList.add("open");
    document.body.style.overflow = "hidden";
    const done = function () {
      closeModal();
      if (opts.onCancel) opts.onCancel();
    };
    o.querySelector(".modal-close").addEventListener("click", done);
    o.querySelector("[data-cancel]").addEventListener("click", done);
    o.querySelector("[data-ok]").addEventListener("click", function () {
      closeModal();
      if (opts.onOk) opts.onOk();
    });
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, type) {
    const t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : " toast-info");
    const icon = type === "error" ? "✕" : type === "success" ? "✓" : "ℹ";
    t.innerHTML = '<span class="toast-ico">' + icon + '</span><span>' + esc(msg) + '</span>';
    document.body.appendChild(t);
    // 移除旧 toast，避免堆叠
    const old = document.querySelectorAll(".toast");
    if (old.length > 3) {
      for (let i = 0; i < old.length - 3; i++) old[i].classList.add("toast-out");
      setTimeout(function () {
        old.forEach(function (el) { if (el.classList.contains("toast-out")) el.remove(); });
      }, 300);
    }
    setTimeout(function () {
      t.classList.add("toast-out");
      setTimeout(function () { t.remove(); }, 320);
    }, 3000);
  }

  // ---------- 暴露 ----------
  window.__SP__ = {
    on, guard, navigate, esc, badge, timeAgo, showModal, closeModal,
    ensureOverlay, loading, empty, error, confirm, toast, currentRoute, onHashChange,
  };

  // 监听 hash 变化，使 #/xxx 链接点击后可触发路由重渲染
  window.addEventListener("hashchange", function () {
    window.__SP__.onHashChange();
  });
})();
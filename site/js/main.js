// ============================================================
//  机场落地页 · 渲染脚本
//  功能：主题切换(theme.js) / 汉堡菜单 / 节点卡 / 套餐月季年切换+对比表 / 教程折叠 / FAQ
// ============================================================
(function () {
  "use strict";

  const S = window.SITE || {};

  // ---------- 拉取后台站点内容(可覆盖静态默认; 后端未启动则用静态配置) ----------
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", (S.API_BASE || "http://localhost:3000") + "/api/settings/public", false);
    xhr.send();
    if (xhr.status === 200) {
      const pub = JSON.parse(xhr.responseText).data || {};
      const c = pub.content || {};
      S._content = c;
      if (c.slogan) S.slogan = c.slogan;
      if (c.heroSub) S.description = c.heroSub;
      if (Array.isArray(c.features) && c.features.length) S.features = c.features;
      if (Array.isArray(c.faqs) && c.faqs.length) S.faqs = c.faqs;
      if (Array.isArray(c.trust) && c.trust.length) S.trustNumbers = c.trust;
      if (Array.isArray(c.docs) && c.docs.length) S.docs = c.docs;
    }
  } catch (e) { /* 忽略：后端未启动 */ }

  // ---------- 数据源切换：套餐 / 节点 均改读后端真实表(后端在线时覆盖静态) ----------
  try {
    const xhrPlans = new XMLHttpRequest();
    xhrPlans.open("GET", (S.API_BASE || "http://localhost:3000") + "/api/public/plans", false);
    xhrPlans.send();
    if (xhrPlans.status === 200) {
      const list = JSON.parse(xhrPlans.responseText).data || [];
      if (Array.isArray(list) && list.length) {
        S.plans = list.map((p) => ({
          name: p.name,
          price: p.price,
          priceQ: p.priceQ != null ? p.priceQ : p.price,
          priceY: p.priceY != null ? p.priceY : p.price,
          unit: (S.cycleUnits && S.cycleUnits[p.cycle]) || "月",
          traffic: p.traffic + "G",
          devices: p.devices == null || p.devices === 0 ? "不限" : p.devices + " 台",
          nodes: "全节点",
          featured: !!p.featured,
          features: (p.features || []).map((f) => (typeof f === "string" ? f : f.text)),
        }));
      }
    }
  } catch (e) { /* 忽略 */ }
  try {
    const xhrNodes = new XMLHttpRequest();
    xhrNodes.open("GET", (S.API_BASE || "http://localhost:3000") + "/api/public/nodes", false);
    xhrNodes.send();
    if (xhrNodes.status === 200) {
      const list = JSON.parse(xhrNodes.responseText).data || [];
      if (Array.isArray(list) && list.length) {
        S.nodes = list.map((n) => ({
          loc: n.name || n.code,
          code: n.code || "",
          region: n.region,
          online: !!n.online && !!n.active,
          latency: n.latency || 0,
          load: n.load || 0,
        }));
      }
    }
  } catch (e) { /* 忽略 */ }

  // ---------- 区块显示开关 ----------
  const _c = S._content || {};
  const hideSec = (sel) => { const el = document.querySelector(sel); if (el) el.style.display = "none"; };
  if (_c.showFeatures === false) hideSec("#features");
  if (_c.showNodes === false) hideSec("#nodes");
  if (_c.showPlans === false) hideSec("#plans");
  if (_c.showDocs === false) hideSec("#docs");
  if (_c.showFaq === false) hideSec("#faq");
  if (_c.showTrust === false) hideSec(".hero-stats");

  // ---------- 统一主题 ----------
  if (window.SiteTheme) {
    window.SiteTheme.init("#theme-switch");
  }

  // ---------- 汉堡菜单 ----------
  const burger = document.querySelector(".burger");
  const navLinks = document.querySelector(".nav-links");
  if (burger && navLinks) {
    burger.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => navLinks.classList.remove("open"))
    );
  }

  // ---------- 渲染：品牌 ----------
  const applyText = (sel, val) => {
    const els = document.querySelectorAll(sel);
    els.forEach((e) => (e.textContent = val));
  };
  applyText("[data-brand]", S.brand);
  applyText("[data-brand-en]", S.brandEn);
  const heroTitle = (S._content && S._content.heroTitle) || null;
  if (heroTitle) {
    applyText("[data-slogan]", heroTitle);
    const gt = document.querySelector(".grad-text");
    if (gt) gt.style.display = "none";
  } else {
    const sloganParts = String(S.slogan || "").split(/[，,]/);
    if (sloganParts.length >= 2) {
      applyText("[data-slogan]", sloganParts[0] + "，");
      applyText(".grad-text", sloganParts.slice(1).join("，"));
    } else {
      applyText("[data-slogan]", S.slogan);
    }
  }
  applyText("[data-description]", S.description);
  document.title = `${S.brand} · ${S.brandEn} - ${S.slogan}`;

  // ---------- 渲染：信任数字条 ----------
  const trustWrap = document.querySelector("[data-trust]");
  if (trustWrap && Array.isArray(S.trustNumbers)) {
    trustWrap.innerHTML = S.trustNumbers
      .map((t) => `<div class="stat"><b>${t.val}</b><span>${t.label}</span></div>`)
      .join("");
  }

  // ---------- 渲染：优势卡片 ----------
  const featWrap = document.querySelector("[data-features]");
  if (featWrap && Array.isArray(S.features)) {
    featWrap.innerHTML = S.features
      .map(
        (f) => `
        <div class="card">
          <div class="feature-icon">${f.icon}</div>
          <h3>${f.title}</h3>
          <p>${f.desc}</p>
        </div>`
      )
      .join("");
  }

  // ---------- 渲染：节点卡 ----------
  function nodeRegion(r) {
    var map = { Asia: "亚洲", NorthAm: "北美", Europe: "欧洲", Oceania: "大洋洲" };
    return map[r] || r;
  }
  const nodeWrap = document.querySelector("[data-nodes]");
  if (nodeWrap && Array.isArray(S.nodes)) {
    nodeWrap.innerHTML = S.nodes
      .map((n) => {
        const on = n.online;
        const loadCls = n.load >= 80 ? "danger" : n.load >= 60 ? "warn" : "ok";
        return `<div class="node-card ${on ? "" : "off"}">
          <div class="nc-top"><span class="flag">${n.code || ""}</span>
            <span class="node-loc">${n.loc}</span>
            <span class="dot ${on ? "on" : "off"}"></span></div>
          <div class="nc-meta"><span>${nodeRegion(n.region)}</span>
            <span class="load"><i class="loadbar ${loadCls}"><i style="width:${n.load}%"></i></i>${n.load}%</span></div>
          <div class="nc-sub">${on ? n.latency + " ms" : "维护中"}</div>
        </div>`;
      })
      .join("");
  }

  // ---------- 套餐：月份/季/年切换 + 对比表 ----------
  const plansWrap = document.querySelector("[data-plans]");
  const compareWrap = document.querySelector("[data-compare]");
  const plans = Array.isArray(S.plans) ? S.plans : [];
  const cycleMap = { month: "月", quarter: "季", year: "年" };
  const keyMap = { month: "price", quarter: "priceQ", year: "priceY" };
  let currentCycle = "month";

  function priceFor(p) {
    const k = keyMap[currentCycle];
    const v = p[k] != null ? p[k] : p.price;
    const unit = cycleMap[currentCycle];
    return { v, unit };
  }

  function renderPlans() {
    if (!plansWrap) return;
    plansWrap.innerHTML = plans
      .map((p, i) => {
        const pr = priceFor(p);
        return `<div class="plan${p.featured ? " featured" : ""}" data-i="${i}">
          ${p.featured ? '<span class="badge">最受欢迎</span>' : ""}
          <h3>${p.name}</h3>
          <div class="price"><b>¥${pr.v}</b> <span>/ ${pr.unit}</span></div>
          <ul class="meta">
            <li>${p.traffic} 月流量</li>
            <li>${p.devices} 设备</li>
            <li>${p.nodes || "全节点"}</li>
          </ul>
          <ul class="features">
            ${(p.features || []).map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <a class="btn btn-primary" href="#" data-buy="${i}">立即购买</a>
        </div>`;
      })
      .join("");
    renderCompare();
  }

  function renderCompare() {
    if (!compareWrap) return;
    const unit = cycleMap[currentCycle];
    compareWrap.innerHTML =
      `<table class="compare-table">
        <thead><tr><th>对比项</th>${plans.map((p) => `<th>${p.name}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><td>价格(${unit})</td>${plans.map((p) => `<td>¥${priceFor(p).v}</td>`).join("")}</tr>
          <tr><td>月流量</td>${plans.map((p) => `<td>${p.traffic}</td>`).join("")}</tr>
          <tr><td>设备数</td>${plans.map((p) => `<td>${p.devices}</td>`).join("")}</tr>
          <tr><td>线路</td>${plans.map((p) => `<td>${p.nodes || "全节点"}</td>`).join("")}</tr>
        </tbody>
      </table>`;
  }

  // 周期切换
  const cycleBtns = document.querySelectorAll("[data-cycle]");
  cycleBtns.forEach((b) =>
    b.addEventListener("click", () => {
      currentCycle = b.dataset.cycle;
      cycleBtns.forEach((x) => x.classList.toggle("active", x === b));
      renderPlans();
    })
  );
  if (plansWrap) renderPlans();

  // ---------- 渲染：教程(折叠分组) ----------
  const tutWrap = document.querySelector("[data-tutorial]");
  if (tutWrap && Array.isArray(S.docs)) {
    tutWrap.innerHTML = S.docs
      .map(
        (g) => `
        <div class="doc-group">
          <button class="doc-group-head" type="button"><b>${g.group}</b><span class="arrow">▾</span></button>
          <div class="doc-group-body">
            ${g.items
              .map((it) => `<div class="doc-item-block"><b>${it.t}</b><div class="doc-content">${it.body || ""}</div></div>`)
              .join("")}
          </div>
        </div>`
      )
      .join("");
    tutWrap.querySelectorAll(".doc-group-head").forEach((h) =>
      h.addEventListener("click", () => {
        const g = h.parentElement;
        const open = g.classList.contains("open");
        g.parentElement.querySelectorAll(".doc-group.open").forEach((o) => o.classList.remove("open"));
        if (!open) g.classList.add("open");
      })
    );
  }

  // ---------- 渲染：FAQ ----------
  const faqWrap = document.querySelector("[data-faqs]");
  function bindFaq() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const q = item.querySelector(".faq-q");
      const a = item.querySelector(".faq-a");
      q.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        document.querySelectorAll(".faq-item.open").forEach((o) => {
          o.classList.remove("open");
          o.querySelector(".faq-a").style.maxHeight = null;
        });
        if (!isOpen) {
          item.classList.add("open");
          a.style.maxHeight = a.scrollHeight + "px";
        }
      });
    });
  }
  if (faqWrap && Array.isArray(S.faqs)) {
    faqWrap.innerHTML = S.faqs
      .map(
        (f, i) => `
        <div class="faq-item">
          <button class="faq-q" type="button" aria-expanded="false">
            <span>Q${i + 1}. ${f.q}</span>
            <span class="arrow">▾</span>
          </button>
          <div class="faq-a">
            <div class="faq-a-inner">${f.a}</div>
          </div>
        </div>`
      )
      .join("");
    bindFaq();
  }

  // ---------- 渲染：链接按钮 ----------
  const setHref = (sel, url) => {
    document.querySelectorAll(sel).forEach((e) => {
      if (url && url !== "#") e.setAttribute("href", url);
    });
  };
  setHref("[data-center]", S.USER_CENTER_URL);
  setHref("[data-login]", S.LOGIN_URL || S.USER_CENTER_URL);
  setHref("[data-tg]", S.telegram);

  // 暴露当前周期供 app.js 下单使用
  window.__cycle = function () { return currentCycle; };
})();

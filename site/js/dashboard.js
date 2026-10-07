// ============================================================
//  用户 Dashboard 页面
//  概览 / 流量 / 钱包 / 邀请
//  依赖 js/api.js, js/router.js (window.__SP__)
// ============================================================
(function () {
  "use strict";

  const api = window.JCAPI;
  const sp = window.__SP__;

  function isLogged() { return api.isLoggedIn(); }

  // ---------- 头部 ----------
  function header(title, subtitle) {
    return '<div class="page-header"><div><h2>' + sp.esc(title) + '</h2>' +
      (subtitle ? '<div class="breadcrumb">' + sp.esc(subtitle) + '</div>' : '') +
      '</div><div><a href="./" class="btn btn-ghost btn-sm">← 首页</a></div></div>';
  }

  // ---------- 统计卡片 ----------
  function statCards(items) {
    return '<div class="grid grid-4" style="margin-bottom:24px">' +
      items.map(function (it) {
        return '<div class="stat-card">' +
          '<div class="stat-ico">' + it.ico + '</div>' +
          '<div><div class="stat-val">' + it.val + '</div><div class="stat-label">' + it.label + '</div></div>' +
          '</div>';
      }).join("") +
      '</div>';
  }

  // ---------- 卡片包裹 ----------
  function card(title, body, extra) {
    return '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-head"><div class="card-title">' + sp.esc(title) + '</div></div>' +
      (extra || '') +
      body +
      '</div>';
  }

  // ---------- 复制输入行 ----------
  function copyRow(id, value, btnId) {
    return '<div class="copy-row"><input readonly value="' + sp.esc(value) + '" id="' + id + '" />' +
      '<button class="btn btn-ghost btn-sm" id="' + (btnId || id + "-btn") + '">复制</button></div>';
  }

  // ============ 静态数据 ============
  function nodeRegion(r) {
    var map = { Asia: "亚洲", NorthAm: "北美", Europe: "欧洲", Oceania: "大洋洲" };
    return map[r] || r;
  }
  function nodesHtml() {
    var cfg = window.SITE || {};
    var nodes = (cfg.nodes || []).slice(0, 12);
    return nodes.map(function (n) {
      var on = n.online;
      var loadCls = n.load >= 80 ? "danger" : (n.load >= 60 ? "warn" : "ok");
      return '<div class="node-card ' + (on ? "" : "off") + '">' +
        '<div class="nc-top"><span class="flag">' + sp.esc(n.code || "") + '</span>' +
        '<span class="node-loc">' + sp.esc(n.loc) + '</span>' +
        '<span class="dot ' + (on ? "on" : "off") + '"></span></div>' +
        '<div class="nc-meta"><span>' + nodeRegion(n.region) + '</span>' +
        '<span class="load"><i class="loadbar ' + loadCls + '"><i style="width:' + n.load + '%"></i></i>' + n.load + '%</span></div>' +
        '<div class="nc-sub">' + (on ? n.latency + " ms" : "维护中") + '</div>' +
        '</div>';
    }).join("");
  }

  // ============ 页面: 概览 (仪表盘) ============
  function pageOverview(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    Promise.all([api.userOverview(), api.userTraffic(), api.walletRecent(), api.publicNotices()])
      .then(function (res) {
        const ov = res[0].data, tr = res[1].data, wl = res[2].data, nt = res[3];
        const plan = ov.plan ? ov.plan.name : "未购";
        const subscribe = ov.subscribeUrl || ov.subUrl || "";
        const expire = ov.planExpireAt ? new Date(ov.planExpireAt * 1000).toLocaleDateString() : "—";
        const totalGB = tr.total > 0 ? (tr.total / 1024 / 1024 / 1024).toFixed(0) : 0;
        const usedGB = tr.total > 0 ? (tr.used / 1024 / 1024 / 1024).toFixed(2) : "0";
        const pct = tr.total > 0 ? Math.min(100, (tr.used / tr.total) * 100).toFixed(0) : 0;
        const notices = ((nt && nt.data) || []).slice(0, 4).map(function (n) {
          return '<a class="notice-item" href="#/docs"><b>' + sp.esc(n.title) + '</b><span>' + sp.timeAgo(n.created_at || n.createdAt) + '</span></a>';
        }).join("") || '<div style="color:var(--text-muted);font-size:0.9rem;padding:8px 0">暂无公告</div>';

        render(
          header("控制面板", "欢迎回来, " + (ov.nickname || ov.email || "")) +
          statCards([
            { ico: "💰", val: "¥" + (ov.balance || 0), label: "账户余额" },
            { ico: "📦", val: plan, label: "当前套餐" },
            { ico: "⏰", val: expire, label: "到期时间" },
            { ico: "📡", val: (usedGB) + " GB", label: "已用流量" },
          ]) +
          '<div class="grid-2 card-grid">' +
          card("我的服务",
            '<div class="progress"><div style="width:' + pct + '%"></div></div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px">已用 ' + usedGB + ' / ' + totalGB + ' GB · ' + pct + '%</div>' +
            (subscribe ?
              copyRow("ov-sub", subscribe, "ov-sub-btn") +
              '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><a href="#/subscription" class="btn btn-primary btn-sm">订阅详情</a><a href="#/nodes" class="btn btn-ghost btn-sm">节点状态</a></div>'
              :
              '<div style="color:var(--text-dim);font-size:0.9rem;margin-bottom:8px">尚未购买套餐，订阅链接将在购买后生成。</div><div><a href="#/wallet" class="btn btn-primary btn-sm">去充值中心选购</a></div>')
          ) +
          card("最近公告",
            notices +
            '<div style="margin-top:8px"><a href="#/docs" class="btn btn-ghost btn-sm">查看文档</a></div>'
          ) +
          card("快捷入口",
            '<div class="quick-grid">' +
            '<a href="#/traffic" class="quick-btn">📡<span>流量</span></a>' +
            '<a href="#/subscription" class="quick-btn">📋<span>订阅</span></a>' +
            '<a href="#/nodes" class="quick-btn">🗺️<span>节点</span></a>' +
            '<a href="#/orders" class="quick-btn">🧾<span>订单</span></a>' +
            '<a href="#/wallet" class="quick-btn">💰<span>充值</span></a>' +
            '<a href="#/invite" class="quick-btn">🔗<span>邀请</span></a>' +
            '<a href="#/docs" class="quick-btn">📖<span>文档</span></a>' +
            '<a href="#/profile" class="quick-btn">👤<span>资料</span></a>' +
            '</div>'
          ) +
          '</div>'
        );
        var b = document.getElementById("ov-sub-btn");
        if (b) b.addEventListener("click", function () { copyText("ov-sub"); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 我的订阅 ============
  function pageSubscription(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    Promise.all([api.userOverview(), api.userTraffic()])
      .then(function (res) {
        const ov = res[0].data, tr = res[1].data;
        const plan = ov.plan ? ov.plan.name : "未购";
        const subscribe = ov.subscribeUrl || ov.subUrl || "";
        const expire = ov.planExpireAt ? new Date(ov.planExpireAt * 1000).toLocaleDateString() : "—";
        const totalGB = tr.total > 0 ? (tr.total / 1024 / 1024 / 1024).toFixed(0) : 0;
        const usedGB = tr.total > 0 ? (tr.used / 1024 / 1024 / 1024).toFixed(2) : "0";
        const pct = tr.total > 0 ? Math.min(100, (tr.used / tr.total) * 100).toFixed(0) : 0;
        const qr = subscribe ? '<img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(subscribe) + '" alt="QR" />' : "";
        const sep = subscribe.indexOf("?") >= 0 ? "&" : "?";
        function fmtLink(f, label, type) {
          var u = subscribe + sep + "format=" + f;
          return '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + sp.esc(u) + '" title="' + label + '">' + label + "</a>";
        }
        render(
          header("我的订阅", "订阅链接与设备") +
          card("订阅状态",
            '<div class="list-card">' +
            '<div class="row"><span>套餐</span><strong>' + sp.esc(plan) + '</strong></div>' +
            '<div class="row"><span>到期时间</span><strong>' + sp.esc(expire) + '</strong></div>' +
            '</div>' +
            '<div class="progress"><div style="width:' + pct + '%"></div></div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted)">已用 ' + usedGB + ' / ' + totalGB + ' GB · ' + pct + '%</div>'
          ) +
          (subscribe ? card("订阅链接",
            '<div class="copy-row" style="margin-bottom:10px"><input readonly value="' + sp.esc(subscribe) + '" id="sub-link" />' +
            '<button class="btn btn-ghost btn-sm" id="sub-copy">复制链接</button></div>' +
            (fmtLink("v2ray", "V2Ray", "txt") + " " + fmtLink("clash", "Clash", "yaml") + " " + fmtLink("singbox", "sing-box", "json")) +
            '<div class="qr-wrap">' + qr + '</div>' +
            '<div style="font-size:0.82rem;color:var(--text-muted);margin-top:10px">复制链接导入 Clash / sing-box / v2rayN 客户端即可；也可点击上方链接直接下载对应格式。<br>请妥善保管，勿泄露给他人。</div>'
          ) : card("尚未订阅",
            '<p style="color:var(--text-dim)">购买套餐后即可获得订阅链接。</p><a href="#/wallet" class="btn btn-primary btn-sm">去充值中心选购</a>')) +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><a href="#/docs" class="btn btn-ghost btn-sm">📖 接入教程</a>' +
          '<a href="#/nodes" class="btn btn-ghost btn-sm">🗺️ 节点状态</a></div>'
        );
        var c = document.getElementById("sub-copy");
        if (c) c.addEventListener("click", function () { copyText("sub-link"); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 我的订单 ============
  function pageOrders(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.ordersList()
      .then(function (res) {
        var list = (res.data && res.data.list) || res.data || [];
        var planMap = {};
        (window.SITE && window.SITE.plans || []).forEach(function (p) { planMap[p.id] = p.name; });
        var statusMap = { pending: "待支付", paid: "已支付", cancelled: "已取消", refunded: "已退款", expired: "已过期" };
        var rows = list.map(function (o) {
          var extra = {};
          try { extra = JSON.parse(o.extra || "{}") || {}; } catch (e) {}
          var pname = planMap[o.plan_id] || (extra.planId ? planMap[extra.planId] : null) || "";
          if (o.type !== "plan") pname = o.type === "recharge" ? "余额充值" : "流量包";
          var paid = o.status === "paid";
          var discount = extra.discount > 0 ? '<span class="badge badge-warn" title="优惠后实付">优惠 ¥' + extra.discount + '</span> ' : "";
          return '<tr>' +
            '<td>' + sp.esc(o.orderNo || o.order_no || "") + '</td>' +
            '<td>' + sp.esc(pname) + (extra.cycle ? " (" + sp.esc(extra.cycle) + ")" : "") + '</td>' +
            '<td>' + discount + '<span style="color:var(--text-muted)">原 ¥' + (extra.originalAmount || o.amount || 0) + '</span> → <b>¥' + o.amount + '</b></td>' +
            '<td><span class="badge ' + (paid ? "badge-success" : "badge-muted") + '">' + (statusMap[o.status] || o.status) + '</span></td>' +
            '<td style="font-size:0.82rem;color:var(--text-muted)">' + sp.timeAgo(o.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("我的订单", "购买记录") +
          card("订单列表",
            '<div class="table-wrap"><table><thead><tr><th>订单号</th><th>套餐</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">暂无订单</td></tr>') + '</tbody></table></div>'
          )
        );
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 节点状态 ============
  function pageNodes(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.publicNodes()
      .then(function (res) {
        var list = res.data || [];
        if (!list.length) return render(header("节点状态", "线路实时状态") + sp.empty("🌍", "暂无可展示节点", "节点配置后会自动出现在这里与订阅中"));
        var cards = list.map(function (n) {
          var on = !!n.online && !!n.active;
          var load = n.load || 0;
          var loadCls = load >= 80 ? "danger" : (load >= 60 ? "warn" : "ok");
          return '<div class="node-card ' + (on ? "" : "off") + '">' +
            '<div class="nc-top"><span class="flag">' + sp.esc(n.code || "") + '</span>' +
            '<span class="node-loc">' + sp.esc(n.name || n.loc || "") + '</span>' +
            '<span class="dot ' + (on ? "on" : "off") + '"></span></div>' +
            '<div class="nc-meta"><span>' + nodeRegion(n.region) + '</span>' +
            '<span class="load"><i class="loadbar ' + loadCls + '"><i style="width:' + load + '%"></i></i>' + load + '%</span></div>' +
            '<div class="nc-sub">' + (on ? (n.latency ? n.latency + " ms" : "在线") : "维护中") + '</div>' +
            '</div>';
        }).join("");
        render(
          header("节点状态", "各节点实时状态(自管数据源)") +
          '<div class="node-grid">' + cards + '</div>' +
          '<div style="color:var(--text-muted);font-size:0.85rem;margin-top:14px">完整节点请在客户端导入订阅链接后获取。</div>'
        );
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 使用文档 ============
  function pageDocs(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    var cfg = window.SITE || {};
    var groups = (cfg.docs || []);
    var all = [];
    groups.forEach(function (g) { g.items.forEach(function (it) { all.push(it); }); });

    var listHtml = groups.map(function (g) {
      return '<div class="doc-group"><div class="doc-group-title">' + sp.esc(g.group) + '</div>' +
        g.items.map(function (it) {
          return '<a class="doc-item" href="#" data-i="' + all.indexOf(it) + '"><b>' + sp.esc(it.t) + '</b><span>' + sp.esc(it.upd) + '</span></a>';
        }).join("") + '</div>';
    }).join("");

    render(
      header("使用文档", "客户端接入指南") +
      '<div class="doc-layout">' +
      '<div class="doc-nav">' +
      '<input class="form-control" id="doc-search" placeholder="搜索文档…" />' +
      listHtml +
      '</div>' +
      '<div class="doc-body" id="doc-body">' +
      (all[0] ? '<h3>' + sp.esc(all[0].t) + '</h3><div class="doc-content">' + (all[0].body || "") + '</div>' : '<p>暂无文档</p>') +
      '</div>' +
      '</div>'
    );

    var body = document.getElementById("doc-body");
    var links = document.querySelectorAll(".doc-item");
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        links.forEach(function (x) { x.classList.remove("active"); });
        a.classList.add("active");
        var it = all[parseInt(a.getAttribute("data-i"))];
        if (it) body.innerHTML = '<h3>' + sp.esc(it.t) + '</h3><div class="doc-content">' + (it.body || "") + '</div>';
      });
    });

    var search = document.getElementById("doc-search");
    if (search) search.addEventListener("input", function () {
      var kw = search.value.trim().toLowerCase();
      links.forEach(function (a) {
        var it = all[parseInt(a.getAttribute("data-i"))];
        var hit = !kw || (it.t + (it.body || "")).toLowerCase().indexOf(kw) !== -1;
        a.style.display = hit ? "" : "none";
      });
    });
  }

  // ============ 页面: 流量 ============
  function pageTraffic(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.userTraffic()
      .then(function (res) {
        const d = res.data;
        const totalGB = (d.total / 1024 / 1024 / 1024).toFixed(0);
        const usedGB = (d.used / 1024 / 1024 / 1024).toFixed(2);
        const pct = d.total > 0 ? Math.min(100, ((d.used / d.total) * 100)).toFixed(1) : 0;
        render(
          header("流量使用", "订阅详情与用量") +
          statCards([
            { ico: "📡", val: totalGB + " GB", label: "总流量" },
            { ico: "🔻", val: usedGB + " GB", label: "已用" },
            { ico: "🔺", val: (d.remaining / 1024 / 1024 / 1024).toFixed(2) + " GB", label: "剩余" },
            { ico: d.expired ? "🚫" : "✅", val: d.expired ? "已用完" : "正常", label: "状态" },
          ]) +
          card("本月用量",
            '<div style="background:var(--input-bg);border-radius:var(--radius);padding:16px;margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:0.85rem;color:var(--text-muted)">已用 ' + usedGB + ' GB / ' + totalGB + ' GB</span><span style="font-size:0.85rem;color:var(--primary)">' + pct + '%</span></div>' +
            '<div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--grad);border-radius:5px;transition:width 0.5s"></div></div>' +
            '</div>' +
            '<div class="list-card"><div class="row"><span>重置日</span><span>' + (d.resetDay ? new Date(d.resetDay * 1000).toLocaleDateString() : "月初") + '</span></div>' +
            '<div class="row"><span>说明</span><span style="color:var(--text-muted);font-size:0.85rem">' + sp.esc(d.provider || "") + '</span></div></div>'
          ) +
          '<div style="color:var(--text-muted);font-size:0.85rem">节点实际回传流量以面板为准；自管模式显示库内累计值。</div>'
        );
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 充值中心 (选购套餐 + 余额充值 + 流水) ============
  var walletCycle = "month";
  var walletPlanIdx = null;
  var walletChannel = "balance";
  var walletChannels = ["balance"];
  var walletPlans = [];

  function walletPayName(c) { return { alipay: "支付宝", epay: "易支付", usdt: "USDT", balance: "余额" }[c] || c; }
  function walletPayIcon(c) { return { alipay: "🅰️", epay: "💳", usdt: "₮", balance: "💰" }[c] || "💳"; }
  function walletKey() { return { month: "price", quarter: "priceQ", year: "priceY" }[walletCycle] || "price"; }
  function walletUnit() { return { month: "月", quarter: "季", year: "年" }[walletCycle] || "月"; }
  function walletPrice(p) { var v = p[walletKey()]; return v != null ? v : p.price; }

  function walletPlanCards() {
    var plans = walletPlans;
    if (!plans.length) return sp.empty("📦", "暂无可购套餐", "套餐配置完善后即可购买");
    return '<div class="plans-grid wallet-plans">' + plans.map(function (p, i) {
      return '<div class="plan' + (p.featured ? " featured" : "") + (walletPlanIdx === i ? " selected" : "") + '" data-wplan="' + i + '" role="button" tabindex="0">' +
        (p.featured ? '<span class="badge">最受欢迎</span>' : "") +
        '<h3>' + sp.esc(p.name) + '</h3>' +
        '<div class="price"><b>¥' + walletPrice(p) + '</b><span>/ ' + walletUnit() + '</span></div>' +
        '<ul class="meta"><li>' + sp.esc(p.traffic) + ' 月流量</li><li>' + sp.esc(p.devices) + ' 设备</li><li>' + sp.esc(p.nodes || "全节点") + '</li></ul>' +
        '<ul class="features">' + (p.features || []).map(function (f) { return "<li>" + sp.esc(f) + "</li>"; }).join("") + '</ul>' +
        '</div>';
    }).join("") + '</div>';
  }

  function walletPayMethods(scope) {
    if (!walletChannels.length) return '<div class="tip" style="padding:8px 0">暂无可用的支付方式，请联系管理员。</div>';
    return '<div class="pay-methods">' + walletChannels.map(function (c) {
      var sel = walletChannel === c ? " selected" : "";
      return '<div class="pay-method' + sel + '" data-wp-channel="' + scope + '|' + c + '"><span class="ico">' + walletPayIcon(c) + '</span>' + walletPayName(c) + '</div>';
    }).join("") + '</div>';
  }

  function walletCopy(v) {
    try { navigator.clipboard.writeText(v).then(function () { sp.toast("已复制", "success"); }); } catch (e) { sp.toast("复制失败", "error"); }
  }

  function walletReload() {
    var m = document.getElementById("page-main");
    if (m) pageWallet("/wallet", {}, function (html) { m.innerHTML = html; });
  }

  function walletPollOrder(orderNo) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      api.orderStatus(orderNo)
        .then(function (r) {
          if (r.data && r.data.status === "paid") {
            clearInterval(iv);
            sp.toast("支付成功", "success");
            sp.closeModal();
            walletReload();
          } else if (tries > 40) { clearInterval(iv); }
        })
        .catch(function () { clearInterval(iv); });
    }, 2500);
  }

  function walletShowPay(pay, order, kind) {
    if (walletChannel === "balance") {
      sp.showModal(
        '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>支付成功 ✓</h3></div>' +
        '<div class="modal-body"><p>订单 ' + sp.esc(order.orderNo) + ' 已完成。</p>' +
        '<p style="margin-top:6px">' + (kind === "plan" ? "套餐已开通，可在「我的订阅」查看。" : "余额已到账。") + '</p></div>' +
        '<div class="modal-actions"><button class="btn btn-primary" data-wclose>好的</button></div></div>'
      );
      var c = document.querySelector(".modal-overlay.open [data-wclose]");
      if (c) c.addEventListener("click", function () { sp.closeModal(); walletReload(); });
      return;
    }
    var payUrl = pay && (pay.payUrl || pay.qrContent || "");
    var isUrl = payUrl && /^https?:\/\//.test(payUrl);
    sp.showModal(
      '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>等待支付</h3></div>' +
      '<div class="modal-body"><p class="order-no">订单号：' + sp.esc(order.orderNo) + '</p>' +
      (isUrl
        ? '<p style="margin-top:6px">请在支付平台完成付款，支付完成后本页自动更新。</p><div class="copy-row" style="margin-top:10px"><input readonly value="' + sp.esc(payUrl) + '" /><button class="btn btn-primary btn-sm" id="w-open-pay">去支付</button></div>'
        : '<p style="margin-top:6px">请向以下地址转账，并备注订单号。</p><div class="copy-row" style="margin-top:10px"><input readonly value="' + sp.esc(payUrl || "") + '" /><button class="btn btn-ghost btn-sm" id="w-copy-pay">复制地址</button></div>') +
      '</div></div>'
    );
    if (isUrl) {
      var open = document.getElementById("w-open-pay");
      if (open) open.addEventListener("click", function () { window.open(payUrl, "_blank"); });
    } else {
      var cp = document.getElementById("w-copy-pay");
      if (cp) cp.addEventListener("click", function () { walletCopy(payUrl || ""); });
    }
    walletPollOrder(order.orderNo);
  }

  function walletSubmitBuy(btn, msgEl) {
    if (walletPlanIdx == null) { msgEl.textContent = "请先选择套餐"; return; }
    var plan = walletPlans[walletPlanIdx];
    if (!plan) { msgEl.textContent = "套餐不存在，请刷新重试"; return; }
    btn.classList.add("loading"); btn.disabled = true;
    var couponEl = document.getElementById("coupon-code");
    var couponCode = couponEl ? couponEl.value.trim() : "";
    api.plans()
      .then(function (pr) {
        var backend = ((pr.data) || []).find(function (bp) { return bp.name === plan.name; });
        var body = backend
          ? { planId: backend.id, method: walletChannel, cycle: walletCycle, couponCode: couponCode || undefined }
          : { type: "recharge", amount: walletPrice(plan), method: walletChannel };
        return api.createOrder(body);
      })
      .then(function (r) { walletShowPay(r.data.pay, r.data.order, "plan"); })
      .catch(function (e) {
        msgEl.textContent = (e && (e.msg || e.message)) || "下单失败，请重试";
        btn.classList.remove("loading"); btn.disabled = false;
      });
  }

  function walletSubmitRecharge(btn, msgEl) {
    var amt = parseFloat(document.getElementById("recharge-amt").value);
    if (!(amt > 0)) { msgEl.textContent = "请输入有效的充值金额"; return; }
    btn.classList.add("loading"); btn.disabled = true;
    api.createOrder({ type: "recharge", amount: amt, method: walletChannel })
      .then(function (r) { walletShowPay(r.data.pay, r.data.order, "recharge"); })
      .catch(function (e) {
        msgEl.textContent = (e && (e.msg || e.message)) || "充值失败，请重试";
        btn.classList.remove("loading"); btn.disabled = false;
      });
  }

  function pageWallet(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    Promise.all([api.userOverview(), api.channels(), api.userWallet(1, 20), api.plans()])
      .then(function (res) {
        var ov = res[0].data || {};
        var chs = (res[1].data) || [];
        if (chs.indexOf("balance") < 0) chs.push("balance");
        walletChannels = chs;
        walletPlans = (res[3].data) || [];
        if (walletChannels.indexOf(walletChannel) < 0) walletChannel = walletChannels[0];
        if (walletPlanIdx != null && walletPlanIdx >= walletPlans.length) walletPlanIdx = null;
        var d = res[2].data;
        var rows = (d.list || []).map(function (it) {
          return '<tr>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '<td><span class="badge ' + (it.amount < 0 ? 'badge-danger' : 'badge-success') + '">' + (it.amount < 0 ? "-" : "+") + ' ¥' + it.amount + '</span></td>' +
            '<td>' + sp.esc(it.type) + '</td>' +
            '<td style="font-size:0.85rem;color:var(--text-muted)">' + sp.esc(it.order_no || "") + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("充值中心", "选购套餐 · 余额充值 · 收支明细") +
          statCards([
            { ico: "💰", val: "¥" + (ov.balance || 0), label: "账户余额" },
            { ico: "📦", val: ov.plan ? ov.plan.name : "未购", label: "当前套餐" },
            { ico: "⏰", val: ov.planExpireAt ? new Date(ov.planExpireAt * 1000).toLocaleDateString() : "—", label: "到期时间" },
          ]) +
          card("选购套餐",
            '<div class="cycle-toggle" id="wallet-cycle" role="group" aria-label="计费周期">' +
            '<button type="button" data-wcycle="month"' + (walletCycle === "month" ? ' class="active"' : '') + '>按月</button>' +
            '<button type="button" data-wcycle="quarter"' + (walletCycle === "quarter" ? ' class="active"' : '') + '>按季</button>' +
            '<button type="button" data-wcycle="year"' + (walletCycle === "year" ? ' class="active"' : '') + '>按年</button>' +
            '</div>' +
            walletPlanCards() +
            '<div class="form-row" style="margin-top:14px">' +
            '<div class="field" style="flex:2"><label>优惠码 (选填)</label><input class="form-control" id="coupon-code" placeholder="如 SUMMER10" style="text-transform:uppercase" /></div>' +
            '<div class="field" style="flex:1"><label>&nbsp;</label><button class="btn btn-ghost" id="coupon-check">校验</button></div>' +
            '</div>' +
            '<div class="tip" id="coupon-msg" style="margin-top:6px"></div>' +
            '<div style="margin-top:16px"><div class="form-label">选择支付方式</div>' + walletPayMethods("buy") + '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="btn btn-primary btn-lg" id="wallet-buy">立即购买</button>' +
            '<span class="tip">已选：' + sp.esc((walletPlanIdx != null && walletPlans[walletPlanIdx]) ? walletPlans[walletPlanIdx].name : "未选择") +
            ' · ' + sp.esc(walletPayName(walletChannel)) + '</span></div>' +
            '<div class="error-msg" id="wallet-buy-msg" style="margin-top:8px"></div>'
          ) +
          card("余额充值",
            '<div class="form-row">' +
            '<div class="field"><label>充值金额 (¥)</label><input class="form-control" id="recharge-amt" type="number" min="1" step="1" placeholder="例如 50" value="50" /></div>' +
            '<div class="field"><label>快捷金额</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
            [10, 50, 100, 200].map(function (a) { return '<button class="btn btn-ghost btn-sm" data-amt="' + a + '">¥' + a + '</button>'; }).join("") +
            '</div></div></div>' +
            '<div style="margin-top:10px"><div class="form-label">选择支付方式</div>' + walletPayMethods("recharge") + '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="btn btn-primary" id="wallet-recharge">立即充值</button>' +
            '<span class="tip">充值到余额，可任意选购套餐</span></div>' +
            '<div class="error-msg" id="wallet-recharge-msg" style="margin-top:8px"></div>'
          ) +
          card("钱包流水",
            '<div class="table-wrap"><table><thead><tr><th>时间</th><th>金额</th><th>类型</th><th>订单号</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">暂无记录</td></tr>') + '</tbody></table></div>'
          ) +
          card("卡密兑换",
            '<div class="form-row">' +
            '<div class="field" style="flex:2"><label>充值卡密</label><input class="form-control" id="card-code" placeholder="输入卡密兑换余额" style="text-transform:uppercase" /></div>' +
            '<div class="field" style="flex:1"><label>&nbsp;</label><button class="btn btn-primary" id="card-redeem">兑换</button></div>' +
            '</div>' +
            '<div class="tip" id="card-msg" style="margin-top:8px"></div>'
          )
        );
        // 周期切换
        document.querySelectorAll("[data-wcycle]").forEach(function (b) {
          b.addEventListener("click", function () {
            walletCycle = b.getAttribute("data-wcycle");
            walletReload();
          });
        });
        // 套餐选择
        document.querySelectorAll("[data-wplan]").forEach(function (el) {
          el.addEventListener("click", function () {
            walletPlanIdx = parseInt(el.getAttribute("data-wplan"), 10);
            document.querySelectorAll("[data-wplan]").forEach(function (x) { x.classList.remove("selected"); });
            el.classList.add("selected");
          });
        });
        // 支付方式（buy/recharge 共用当前渠道）
        document.querySelectorAll("[data-wp-channel]").forEach(function (el) {
          el.addEventListener("click", function () {
            walletChannel = el.getAttribute("data-wp-channel").split("|")[1];
            document.querySelectorAll("[data-wp-channel]").forEach(function (x) { x.classList.remove("selected"); });
            el.classList.add("selected");
          });
        });
        // 快捷金额
        document.querySelectorAll("[data-amt]").forEach(function (b) {
          b.addEventListener("click", function () {
            document.getElementById("recharge-amt").value = b.getAttribute("data-amt");
          });
        });
        var buyBtn = document.getElementById("wallet-buy");
        if (buyBtn) buyBtn.addEventListener("click", function () { walletSubmitBuy(buyBtn, document.getElementById("wallet-buy-msg")); });
        var rcBtn = document.getElementById("wallet-recharge");
        if (rcBtn) rcBtn.addEventListener("click", function () { walletSubmitRecharge(rcBtn, document.getElementById("wallet-recharge-msg")); });
        // 优惠码校验
        var couponBtn = document.getElementById("coupon-check");
        if (couponBtn) couponBtn.addEventListener("click", function () {
          var msgEl = document.getElementById("coupon-msg");
          var code = (document.getElementById("coupon-code").value || "").trim();
          if (!code) { msgEl.textContent = "请输入优惠码"; return; }
          if (walletPlanIdx == null) { msgEl.textContent = "请先选择套餐"; return; }
          var plan = walletPlans[walletPlanIdx];
          var price = plan[walletKey()] != null ? plan[walletKey()] : plan.price;
          api.plans().then(function (pr) {
            var backend = ((pr.data) || []).find(function (bp) { return bp.name === plan.name; });
            if (!backend) { msgEl.textContent = "套餐未同步，无法校验"; return; }
            return api.couponValidate({ code: code, orderAmount: price, planId: backend.id });
          }).then(function (r) {
            var d = r.data || {};
            var applied = sp.esc(d.name || "优惠码可用");
            msgEl.innerHTML = '<span style="color:var(--success)">✓ ' + applied + ' → 实付 ¥' + d.final + '</span>';
          }).catch(function (e) {
            msgEl.textContent = (e && (e.msg || e.message)) || "优惠码无效";
          });
        });
        // 卡密兑换
        var redeemBtn = document.getElementById("card-redeem");
        if (redeemBtn) redeemBtn.addEventListener("click", function () {
          var msgEl = document.getElementById("card-msg");
          var code = (document.getElementById("card-code").value || "").trim();
          if (!code) { msgEl.textContent = "请输入卡密"; return; }
          redeemBtn.classList.add("loading"); redeemBtn.disabled = true;
          api.cardRedeem({ code: code })
            .then(function (r) { msgEl.innerHTML = '<span style="color:var(--success)">✓ ' + sp.esc(r.msg || "充值成功") + '</span>'; walletReload(); })
            .catch(function (e) { msgEl.textContent = (e && (e.msg || e.message)) || "兑换失败"; })
            .finally(function () { redeemBtn.classList.remove("loading"); redeemBtn.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 邀请 ============
  function pageInvite(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    Promise.all([api.userInvite(), api.myCommissions(1, 50)])
      .then(function (res) {
        var d = res[0].data;
        var cm = res[1].data || {};
        var rows = (d.referrals || []).map(function (it) {
          return '<tr>' +
            '<td>' + sp.esc(it.email) + '</td>' +
            '<td>' + sp.esc(it.nickname || "") + '</td>' +
            '<td>¥' + it.balance + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '</tr>';
        }).join("");
        var cmRows = (cm.list || []).map(function (it) {
          return '<tr>' +
            '<td>' + sp.esc(it.order_no || "") + '</td>' +
            '<td>' + sp.esc(it.from_email || "") + '</td>' +
            '<td>¥' + it.amount + '</td>' +
            '<td>' + (it.source === "plan" ? "套餐订单" : it.source || "plan") + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("邀请返佣", "邀请好友获得奖励") +
          card("邀请信息",
            '<div class="list-card"><div class="row"><span>邀请码</span><code style="color:var(--primary);font-size:1.1rem">' + sp.esc(d.code || "") + '</code></div>' +
            '<div class="row"><span>奖励</span><span>¥' + (d.bonus || 0) + '/人</span></div>' +
            '<div class="row"><span>已邀请</span><strong>' + d.totalInvited + ' 人</strong></div></div>' +
            '<div class="copy-row" style="margin-top:12px"><input readonly value="' + sp.esc(d.url || "") + '" id="invite-link" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--text)" /><button class="btn btn-ghost btn-sm" id="copy-invite">复制链接</button></div>'
          ) +
          card("已邀请好友",
            '<div class="table-wrap"><table><thead><tr><th>邮箱</th><th>昵称</th><th>余额</th><th>时间</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">暂无邀请记录</td></tr>') + '</tbody></table></div>'
          ) +
          card("返佣明细 (累计 ¥" + (cm.totalAmount || 0) + ")",
            '<div class="table-wrap"><table><thead><tr><th>订单号</th><th>来源用户</th><th>返佣金额</th><th>类型</th><th>时间</th></tr></thead>' +
            '<tbody>' + (cmRows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">暂无返佣记录</td></tr>') + '</tbody></table></div>'
          )
        );
        var copyBtn = document.getElementById("copy-invite");
        if (copyBtn) copyBtn.addEventListener("click", function () {
          var inp = document.getElementById("invite-link");
          inp.select();
          try { navigator.clipboard.writeText(inp.value); sp.toast("已复制", "success"); } catch (e) {}
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 资料修改 ============
  function pageProfile(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.me()
      .then(function (res) {
        var u = res.data || {};
        render(
          header("资料修改", "账号与密码") +
          card("基本资料",
            '<div class="list-card" style="margin-bottom:14px">' +
            '<div class="row"><span>邮箱</span><strong>' + sp.esc(u.email || "") + '</strong></div>' +
            '<div class="row"><span>角色</span><span>' + sp.badge(u.role || "user") + '</span></div>' +
            '<div class="row"><span>邮箱验证</span><span>' + sp.badge(u.emailVerified ? "email_verified" : "unverified") + '</span></div>' +
            '</div>' +
            '<div class="field" style="margin-bottom:12px"><label>昵称</label>' +
            '<input class="form-control" id="pf-nickname" value="' + sp.esc(u.nickname || "") + '" /></div>' +
            '<button class="btn btn-primary" id="pf-save">保存昵称</button>' +
            '<div class="error-msg" id="pf-msg" style="margin-top:8px"></div>' +
            '<div style="margin-top:12px"><a href="#/wallet" class="btn btn-ghost btn-sm">💰 钱包</a> ' +
            '<a href="#/traffic" class="btn btn-ghost btn-sm">📡 流量</a></div>'
          ) +
          card("修改密码",
            '<div class="field" style="margin-bottom:12px"><label>旧密码</label><input class="form-control" type="password" id="pf-old" placeholder="请输入旧密码" /></div>' +
            '<div class="field" style="margin-bottom:12px"><label>新密码</label><input class="form-control" type="password" id="pf-new" placeholder="至少 8 位" /></div>' +
            '<div class="field" style="margin-bottom:12px"><label>确认新密码</label><input class="form-control" type="password" id="pf-new2" placeholder="再次输入新密码" /></div>' +
            '<button class="btn btn-ghost" id="pf-pwd">修改密码</button>' +
            '<div class="error-msg" id="pf-pwd-msg" style="margin-top:8px"></div>'
          )
        );
        var saveBtn = document.getElementById("pf-save");
        if (saveBtn) saveBtn.addEventListener("click", function () {
          var msg = document.getElementById("pf-msg");
          var nick = document.getElementById("pf-nickname").value.trim();
          if (!nick) { msg.textContent = "昵称不能为空"; return; }
          saveBtn.classList.add("loading"); saveBtn.disabled = true;
          api.userUpdateProfile({ nickname: nick })
            .then(function (r) { msg.textContent = r.msg || "已保存"; sp.toast("资料已保存", "success"); })
            .catch(function (e) { msg.textContent = e.message || "保存失败"; sp.toast("保存失败", "error"); })
            .finally(function () { saveBtn.classList.remove("loading"); saveBtn.disabled = false; });
        });
        var pwdBtn = document.getElementById("pf-pwd");
        if (pwdBtn) pwdBtn.addEventListener("click", function () {
          var msg = document.getElementById("pf-pwd-msg");
          var oldP = document.getElementById("pf-old").value;
          var newP = document.getElementById("pf-new").value;
          var new2 = document.getElementById("pf-new2").value;
          if (!oldP) { msg.textContent = "请输入旧密码"; return; }
          if (newP.length < 8) { msg.textContent = "新密码至少 8 位"; return; }
          if (newP !== new2) { msg.textContent = "两次输入的新密码不一致"; return; }
          pwdBtn.classList.add("loading"); pwdBtn.disabled = true;
          api.userChangePassword({ oldPassword: oldP, newPassword: newP })
            .then(function (r) { msg.textContent = r.msg || "密码已修改"; document.getElementById("pf-old").value = ""; document.getElementById("pf-new").value = ""; document.getElementById("pf-new2").value = ""; sp.toast("密码已修改", "success"); })
            .catch(function (e) { msg.textContent = e.message || "修改失败"; sp.toast("修改失败", "error"); })
            .finally(function () { pwdBtn.classList.remove("loading"); pwdBtn.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---------- 共享工具：复制文本 ----------
  function copyText(id) {
    var inp = document.getElementById(id);
    if (!inp) return;
    inp.select();
    var val = inp.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(function () { sp.toast("已复制", "success"); }).catch(function () { fallbackCopy(val); });
    } else { fallbackCopy(val); }
  }
  function fallbackCopy(val) {
    try { document.execCommand("copy"); sp.toast("已复制", "success"); } catch (e) { sp.toast("复制失败", "error"); }
  }

  // ============ 页面: 站内消息 ============
  function pageNotifications(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.userNotifications(1, 50)
      .then(function (res) {
        var d = res.data || {};
        var rows = (d.list || []).map(function (n) {
          var unread = !n.read;
          return '<div class="list-card" style="margin-bottom:10px' + (unread ? ';border-left:3px solid var(--primary)' : '') + '">' +
            '<div class="row" style="align-items:flex-start"><span>' + sp.esc(n.title) + '</span>' +
            (unread ? '<span class="badge badge-warn">未读</span>' : '<span class="badge badge-muted">已读</span>') + '</div>' +
            '<div style="font-size:0.88rem;color:var(--text);margin:6px 0">' + sp.esc(n.content || "") + '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted)">' + sp.timeAgo(n.created_at) + ' · ' + sp.esc(n.type || "system") + '</div>' +
            '</div>';
        }).join("");
        render(
          header("站内消息", (d.unread ? "未读 " + d.unread + " 条" : "全部已读")) +
          (d.unread > 0 ? '<div style="margin-bottom:12px"><button class="btn btn-ghost btn-sm" id="notif-readall">全部标记已读</button></div>' : "") +
          (rows || sp.empty("🔔", "暂无消息", "系统通知与到期提醒会出现在这里"))
        );
        var ra = document.getElementById("notif-readall");
        if (ra) ra.addEventListener("click", function () {
          api.notificationsRead({ all: true })
            .then(function () { sp.toast("已全部标记为已读", "success"); sp.onHashChange(); })
            .catch(function () { sp.toast("操作失败", "error"); });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 我的工单 ============
  var ticketState = { open: null }; // open 的 ticketId

  function ticketStatusBadge(s) { return s === "open" ? '<span class="badge badge-warn">处理中</span>' : '<span class="badge badge-muted">已关闭</span>'; }

  function tktEscape(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function pageTickets(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    api.ticketsList()
      .then(function (res) {
        var list = (res.data && (res.data.list || res.data)) || res.data || [];
        var rows = list.map(function (t) {
          return '<a class="doc-item" style="display:flex;justify-content:space-between;align-items:center" href="#/tickets/' + t.id + '">' +
            '<span><b>#' + t.id + ' · ' + tktEscape(t.subject) + '</b><div style="font-size:0.8rem;color:var(--text-muted)">' +
            (t.level === "urgent" ? '<span class="badge badge-danger">紧急</span> ' : "") +
            sp.timeAgo(t.created_at) + (t.admin_replied ? " · 有新回复" : "") + '</div></span>' +
            ticketStatusBadge(t.status) + '</a>';
        }).join("");
        render(
          header("我的工单", "自助提交 · 跟踪处理进度") +
          '<div style="margin-bottom:12px"><a href="#/tickets/new" class="btn btn-primary btn-sm">＋ 提交新工单</a></div>' +
          (rows || sp.empty("🎫", "暂无工单", "遇到问题可提交工单，我们会尽快答复"))
        );
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // 新工单表单
  function pageTicketNew(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    render(
      header("提交工单", "尽量提供详细信息便于快速处理") +
      card("新建工单",
        '<div class="field" style="margin-bottom:12px"><label>主题</label>' +
        '<input class="form-control" id="tkt-subject" placeholder="一句话描述问题" /></div>' +
        '<div class="field" style="margin-bottom:12px"><label>紧急程度</label>' +
        '<select class="form-control" id="tkt-level"><option value="normal">普通</option><option value="urgent">紧急</option></select></div>' +
        '<div class="field" style="margin-bottom:12px"><label>内容</label>' +
        '<textarea class="form-control" id="tkt-content" rows="6" placeholder="请描述你的问题 / 附上订单号、节点地区、错误提示等"></textarea></div>' +
        '<button class="btn btn-primary" id="tkt-submit">提交工单</button>' +
        '<div class="error-msg" id="tkt-msg" style="margin-top:8px"></div>'
      )
    );
    var btn = document.getElementById("tkt-submit");
    btn.addEventListener("click", function () {
      var msg = document.getElementById("tkt-msg");
      var subject = document.getElementById("tkt-subject").value.trim();
      var content = document.getElementById("tkt-content").value.trim();
      var level = document.getElementById("tkt-level").value;
      if (!subject) { msg.textContent = "请填写主题"; return; }
      if (content.length < 5) { msg.textContent = "内容至少 5 个字"; return; }
      btn.classList.add("loading"); btn.disabled = true;
      api.ticketCreate({ subject: subject, content: content, level: level })
        .then(function (r) { sp.toast("工单已提交", "success"); location.hash = "#/tickets"; })
        .catch(function (e) { msg.textContent = (e && (e.msg || e.message)) || "提交失败"; })
        .finally(function () { btn.classList.remove("loading"); btn.disabled = false; });
    });
  }

  // 工单详情/回复
  function pageTicketDetail(path, qs, render) {
    render(sp.loading());
    if (!isLogged()) { sp.navigate("/"); return; }
    var id = path.replace("/tickets/", "");
    if (!/^\d+$/.test(id)) { sp.navigate("/tickets"); return; }
    api.ticketDetail(id)
      .then(function (res) {
        var t = res.data.ticket || res.data;
        var msgs = (res.data.messages || []).map(function (m) {
          return '<div class="ticket-msg ' + (m.is_admin ? "admin" : "user") + '">' +
            '<div class="tm-head"><b>' + (m.is_admin ? "客服" : "我") + '</b><span>' + sp.timeAgo(m.created_at) + '</span></div>' +
            '<div class="tm-body">' + tktEscape(m.content).replace(/\n/g, "<br/>") + '</div></div>';
        }).join("");
        var canReply = t.status === "open";
        render(
          header("工单 #" + t.id + " · " + tktEscape(t.subject), "创建于 " + sp.timeAgo(t.created_at)) +
          card("对话",
            msgs + '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:8px">状态：' + (t.status === "open" ? "处理中" : "已关闭") + '</div>'
          ) +
          (canReply ?
            card("回复",
              '<textarea class="form-control" id="tkt-reply" rows="4" placeholder="补充说明…"></textarea>' +
              '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
              '<button class="btn btn-primary btn-sm" id="tkt-reply-btn">发送回复</button>' +
              '<button class="btn btn-ghost btn-sm" id="tkt-close-btn">关闭工单</button></div>' +
              '<div class="error-msg" id="tkt-reply-msg" style="margin-top:8px"></div>'
            )
            :
            '<div style="margin-bottom:12px"><a href="#/tickets/new" class="btn btn-ghost btn-sm">新建工单</a></div>')
        );
        var rp = document.getElementById("tkt-reply-btn");
        if (rp) rp.addEventListener("click", function () {
          var msg = document.getElementById("tkt-reply-msg");
          var content = document.getElementById("tkt-reply").value.trim();
          if (content.length < 2) { msg.textContent = "内容至少 2 个字"; return; }
          api.ticketReply(id, { content: content })
            .then(function () { sp.toast("已回复", "success"); sp.onHashChange(); })
            .catch(function (e) { msg.textContent = (e && (e.msg || e.message)) || "发送失败"; });
        });
        var cl = document.getElementById("tkt-close-btn");
        if (cl) cl.addEventListener("click", function () {
          api.ticketClose(id)
            .then(function () { sp.toast("工单已关闭", "success"); sp.onHashChange(); })
            .catch(function (e) { sp.toast((e && (e.msg || e.message)) || "关闭失败", "error"); });
        });
      })
      .catch(function () { render(sp.error("工单加载失败", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 重置密码(找回密码邮件链接进入) ============
  function pageResetPassword(path, qs, render) {
    render(sp.loading());
    var token = qs.token || "";
    if (!token) {
      render(header("重置密码", "") + empty("🔑", "链接无效", "缺少重置令牌，请从邮件中的重置链接进入", '<a href="#/dashboard" class="btn btn-primary">返回</a>'));
      return;
    }
    render(
      header("重置密码", "设置新密码") +
      '<div style="max-width:420px;margin:0 auto">' +
      card("设置新密码",
        '<div class="field" style="margin-bottom:12px"><label>新密码</label><input class="form-control" type="password" id="rp-new" placeholder="至少 8 位" autocomplete="new-password" /></div>' +
        '<div class="field" style="margin-bottom:12px"><label>确认新密码</label><input class="form-control" type="password" id="rp-new2" placeholder="再次输入新密码" /></div>' +
        '<button class="btn btn-primary" id="rp-submit" style="width:100%">确认重置</button>' +
        '<div class="error-msg" id="rp-msg" style="margin-top:8px;text-align:center"></div>'
      ) +
      '</div>'
    );
    var btn = document.getElementById("rp-submit");
    btn.addEventListener("click", function () {
      var msg = document.getElementById("rp-msg");
      var p1 = document.getElementById("rp-new").value;
      var p2 = document.getElementById("rp-new2").value;
      if (p1.length < 8) { msg.textContent = "新密码至少 8 位"; return; }
      if (p1 !== p2) { msg.textContent = "两次输入的新密码不一致"; return; }
      btn.classList.add("loading"); btn.disabled = true;
      api.resetPassword({ token: token, password: p1 })
        .then(function (r) {
          msg.style.color = ""; msg.textContent = r.msg || "密码已重置，请使用新密码登录";
          sp.toast("密码已重置", "success");
          setTimeout(function () { location.hash = "#/dashboard"; }, 1500);
        })
        .catch(function (e) { msg.textContent = (e && (e.msg || e.message)) || "重置失败"; })
        .finally(function () { btn.classList.remove("loading"); btn.disabled = false; });
    });
  }

  function pageVerifyEmail(path, qs, render) {
    render(sp.loading());
    var token = qs.token || "";
    if (!token) {
      render(header("邮箱验证", "") + empty("📧", "链接无效", "缺少验证令牌，请从邮件中的验证链接进入", '<a href="#/dashboard" class="btn btn-primary">返回</a>'));
      return;
    }
    api.verifyEmail(token)
      .then(function (r) {
        if (r && r.data && r.data.token) api.setToken(r.data.token);
        sp.toast("邮箱验证成功", "success");
        setTimeout(function () { location.hash = "#/dashboard"; }, 800);
      })
      .catch(function (e) {
        render(
          header("邮箱验证", "") +
          empty("📧", "验证失败", (e && (e.msg || e.message)) || "链接无效或已过期", '<a href="#/dashboard" class="btn btn-primary">返回</a>')
        );
      });
  }

  // ---------- 注册页面 ----------
  function registerPages() {
    sp.on("/dashboard", pageOverview);
    sp.on("/subscription", pageSubscription);
    sp.on("/orders", pageOrders);
    sp.on("/nodes", pageNodes);
    sp.on("/docs", pageDocs);
    sp.on("/traffic", pageTraffic);
    sp.on("/wallet", pageWallet);
    sp.on("/invite", pageInvite);
    sp.on("/profile", pageProfile);
    sp.on("/notifications", pageNotifications);
    sp.on("/reset-password", pageResetPassword);
    sp.on("/verify-email", pageVerifyEmail);
    sp.on("/tickets/new", pageTicketNew);
    sp.on("/tickets/:id", pageTicketDetail);
    sp.on("/tickets", pageTickets);
  }

  if (window.__SP__) registerPages();
})();
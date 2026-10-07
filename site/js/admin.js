// ============================================================
//  Admin 后台页面
//  统计 / 用户 / 订单 / 套餐 / 公告 / 设置 / 权限
//  依赖 js/api.js, js/router.js (window.__SP__)
// ============================================================
(function () {
  "use strict";

  const api = window.JCAPI;
  const sp = window.__SP__;

  function isLogged() { return api.isLoggedIn(); }
  function isAdmin() {
    const t = api.getToken();
    if (!t) return false;
    try { return ["admin", "superadmin"].includes(JSON.parse(atob(t.split(".")[1])).role); } catch (e) { return false; }
  }

  function header(title, subtitle) {
    return '<div class="page-header"><div><h2>' + sp.esc(title) + '</h2>' +
      (subtitle ? '<div class="breadcrumb">' + sp.esc(subtitle) + '</div>' : '') +
      '</div><div><a href="./" class="btn btn-ghost btn-sm">← 首页</a></div></div>';
  }

  function statCards(items) {
    return '<div class="grid grid-4" style="margin-bottom:24px">' +
      items.map(function (it) {
        var inner = '<div class="stat-ico">' + it.ico + '</div>' +
          '<div><div class="stat-val">' + it.val + '</div><div class="stat-label">' + it.label + '</div></div>';
        return it.link
          ? '<a class="stat-card stat-link" href="' + it.link + '" style="text-decoration:none;color:inherit">' + inner + '</a>'
          : '<div class="stat-card">' + inner + '</div>';
      }).join("") + '</div>';
  }

  function card(title, body) {
    return '<div class="card" style="margin-bottom:16px">' +
      '<div class="card-head"><div class="card-title">' + sp.esc(title) + '</div></div>' + body + '</div>';
  }

  function table(headers, rows, empty) {
    return '<div class="table-wrap"><table><thead><tr>' +
      headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
      '</tr></thead><tbody>' +
      (rows || '<tr><td colspan="' + headers.length + '" style="text-align:center;color:var(--text-muted)">' + (empty || "暂无记录") + '</td></tr>') +
      '</tbody></table></div>';
  }

  // 流量字节 -> GB 展示
  function gbOf(r) {
    var b = r.traffic || ((r.up || 0) + (r.down || 0));
    return (b / 1024 / 1024 / 1024).toFixed(2);
  }

  // ============ 页面: 统计 ============
  function pageStats(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    Promise.all([api.adminStats(), api.adminTrend(14)])
      .then(function (res) {
        var d = res[0].data;
        var trend = res[1].data || [];
        var maxAmt = Math.max.apply(null, trend.map(function (t) { return t.amount; }).concat([1]));
        var chart = '<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="card-title">近 14 天收入趋势</div>' +
          '<span style="font-size:0.8rem;color:var(--text-muted)">¥ 当月累计: ' + trend.reduce(function (s, t) { return s + t.amount; }, 0) + '</span></div>' +
          '<div class="trend-bars">' + trend.map(function (t) {
            return '<div class="trend-bar">' +
              '<div class="trend-val">¥' + t.amount + '</div>' +
              '<div class="trend-col" style="height:' + Math.max(4, Math.round(t.amount / maxAmt * 88)) + 'px" title="' + t.date + ': ¥' + t.amount + ' / ' + t.orders + ' 单"></div>' +
              '<div class="trend-label">' + t.date + '</div></div>';
          }).join("") + '</div></div>';
        render(
          header("控制台统计", "运营概览") +
          statCards([
            { ico: "👥", val: d.totalUsers, label: "总用户" },
            { ico: "📦", val: d.totalPaidOrders, label: "已支付订单" },
            { ico: "💰", val: "¥" + (d.totalRevenue || 0), label: "累计收入" },
            { ico: "📈", val: "¥" + (d.todayRevenue || 0), label: "今日收入" },
          ]) +
          statCards([
            { ico: "🔄", val: d.activeSubscriptions, label: "活跃订阅" },
            { ico: "💵", val: d.totalBalance || 0, label: "总余额" },
            { ico: "📄", val: d.todayOrders || 0, label: "今日订单" },
            { ico: "🎫", val: d.openTickets || 0, label: "待处理工单", link: "#/tickets" },
            { ico: "💳", val: d.unusedCards || 0, label: "未使用卡密", link: "#/cards" },
          ]) +
          chart +
          card("快捷操作",
            '<div class="flex-wrap" style="gap:8px">' +
            '<a class="btn btn-ghost btn-sm" href="#/tickets">🎫 处理工单</a>' +
            '<a class="btn btn-ghost btn-sm" href="#/orders">🧾 订单对账</a>' +
            '<a class="btn btn-ghost btn-sm" href="#/finance/payments">💳 支付流水</a>' +
            '<a class="btn btn-ghost btn-sm" href="#/cards">💳 卡密管理</a>' +
            '<a class="btn btn-ghost btn-sm" href="#/coupons">🎟️ 优惠码</a>' +
            '</div>'
          )
        );
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 用户列表 ============
  var userPage = 1;
  function pageUsers(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    var kw = qs.keyword || "";
    api.adminUsers(userPage, 20, kw)
      .then(function (res) {
        var d = res.data;
        var rows = d.list.map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.email) + '</td>' +
            '<td>' + sp.esc(it.nickname || "") + '</td>' +
            '<td>' + sp.badge(it.role) + '</td>' +
            '<td>' + sp.badge(it.email_verified ? "email_verified" : "unverified") + '</td>' +
            '<td>' + sp.badge(it.status) + '</td>' +
            '<td>¥' + it.balance + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("用户管理", "总用户: " + d.total) +
          '<div class="card" style="margin-bottom:16px">' +
          '<div class="card-head"><div class="card-title">筛选</div></div>' +
          '<div class="form-row">' +
          '<input class="form-control" id="user-kw" placeholder="邮箱/昵称搜索" value="' + sp.esc(kw) + '" />' +
          '<div><button class="btn btn-primary" id="user-search">搜索</button></div>' +
          '</div></div>' +
          table(["ID", "邮箱", "昵称", "角色", "验证", "状态", "余额", "时间"], rows) +
          '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
          (userPage > 1 ? '<button class="btn btn-ghost btn-sm" id="up-prev">上一页</button>' : '') +
          '<span style="padding:8px">' + userPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
          (d.list.length > 0 ? '<button class="btn btn-ghost btn-sm" id="up-next">下一页</button>' : '') +
          '</div>'
        );
        var s = document.getElementById("user-search");
        if (s) s.addEventListener("click", function () { userPage = 1; pageUsers("/users", { keyword: document.getElementById("user-kw").value }, render); });
        var prev = document.getElementById("up-prev");
        var next = document.getElementById("up-next");
        if (prev) prev.addEventListener("click", function () { userPage--; pageUsers("/users", { keyword: kw }, render); });
        if (next) next.addEventListener("click", function () { userPage++; pageUsers("/users", { keyword: kw }, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 用户详情 ============
  function pageUserDetail(path, qs, render) {
    var id = qs.id;
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminUser(id)
      .then(function (res) {
        var d = res.data;
        render(
          header("用户详情", "ID: " + id) +
          '<div class="grid grid-2">' +
          card("账户信息",
            '<div class="list-card"><div class="row"><span>ID</span><strong>' + d.user.id + '</strong></div>' +
            '<div class="row"><span>邮箱</span><strong>' + sp.esc(d.user.email) + '</strong></div>' +
            '<div class="row"><span>昵称</span><strong>' + sp.esc(d.user.nickname || "") + '</strong></div>' +
            '<div class="row"><span>角色</span><span>' + sp.badge(d.user.role) + '</span></div>' +
            '<div class="row"><span>状态</span><span>' + sp.badge(d.user.status) + '</span></div>' +
            '<div class="row"><span>余额</span><strong>¥' + d.user.balance + '</strong></div>' +
            '<div class="row"><span>套餐</span><strong>' + (d.plan ? d.plan.name : "无") + '</strong></div>' +
            '<div class="row"><span>到期</span><strong>' + (d.user.plan_expire_at ? new Date(d.user.plan_expire_at * 1000).toLocaleDateString() : "—") + '</strong></div></div>' +
            '<div style="margin-top:12px">' +
            '<div class="form-row"><input class="form-control" id="ud-nickname" placeholder="昵称" value="' + sp.esc(d.user.nickname || "") + '" /></div>' +
            '<button class="btn btn-primary" id="ud-update">更新资料</button>' +
            '</div>'
          ) +
          card("钱包流水",
            '<div class="table-wrap"><table><thead><tr><th>金额</th><th>类型</th><th>时间</th></tr></thead>' +
            '<tbody>' + (d.wallet && d.wallet.length ? d.wallet.map(function (it) {
              return '<tr><td><span class="badge ' + (it.amount < 0 ? 'badge-danger' : 'badge-success') + '">' + (it.amount < 0 ? "-" : "+") + ' ¥' + it.amount + '</span></td>' +
                '<td>' + sp.esc(it.type) + '</td>' +
                '<td>' + sp.timeAgo(it.created_at) + '</td></tr>';
            }).join("") : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">暂无</td></tr>') +
            '</tbody></table></div>' +
            '<div class="form-row" style="margin-top:12px"><input class="form-control" id="ud-amt" placeholder="金额(负为扣款)" /></div>' +
            '<button class="btn btn-primary" id="ud-wallet">调整余额</button>'
          ) +
          '</div>'
        );
        var updateBtn = document.getElementById("ud-update");
        if (updateBtn) updateBtn.addEventListener("click", function () {
          api.adminUpdateUser(id, { nickname: document.getElementById("ud-nickname").value })
            .then(function () { sp.toast("已更新", "success"); pageUserDetail("/users", { id: id }, render); })
            .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
        });
        var wBtn = document.getElementById("ud-wallet");
        if (wBtn) wBtn.addEventListener("click", function () {
          var amt = parseFloat(document.getElementById("ud-amt").value);
          if (isNaN(amt)) return sp.toast("请输入金额", "error");
          api.adminWalletUser(id, { amount: amt, type: "admin", remark: "管理员调整" })
            .then(function (r) { sp.toast("已调整,当前余额 ¥" + r.data.balance, "success"); pageUserDetail("/users", { id: id }, render); })
            .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 订单 ============
  var orderPage = 1;
  function pageOrders(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    var st = qs.status || "";
    api.adminOrders(orderPage, 20, st)
      .then(function (res) {
        var d = res.data;
        var rows = d.list.map(function (it) {
          return '<tr>' +
            '<td>' + it.order_no + '</td>' +
            '<td>' + sp.esc(it.user_id) + '</td>' +
            '<td>' + sp.badge(it.type) + '</td>' +
            '<td>¥' + it.amount + '</td>' +
            '<td>' + sp.badge(it.status) + '</td>' +
            '<td>' + sp.timeAgo(it.paid_at) + '</td>' +
            '<td><button class="btn btn-ghost btn-sm" data-oid="' + it.id + '" data-status="paid" style="font-size:0.8rem">标记已付</button></td>' +
            '</tr>';
        }).join("");
        render(
          header("订单管理", st ? "状态: " + st + " | " : "") +
          '<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="card-title">筛选</div></div>' +
          '<div class="form-row"><select class="form-control" id="order-status">' +
          '<option value="">全部</option><option value="pending"' + (st === "pending" ? " selected" : "") + '>待支付</option>' +
          '<option value="paid"' + (st === "paid" ? " selected" : "") + '>已支付</option>' +
          '<option value="cancelled"' + (st === "cancelled" ? " selected" : "") + '>已取消</option></select>' +
          '<div><button class="btn btn-primary" id="order-search">搜索</button></div></div></div>' +
          table(["订单号", "用户", "类型", "金额", "状态", "支付时间", "操作"], rows) +
          '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
          (orderPage > 1 ? '<button class="btn btn-ghost btn-sm" id="op-prev">上一页</button>' : '') +
          '<span style="padding:8px">' + orderPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
          (d.list.length > 0 ? '<button class="btn btn-ghost btn-sm" id="op-next">下一页</button>' : '') +
          '</div>'
        );
        var s = document.getElementById("order-search");
        if (s) s.addEventListener("click", function () { orderPage = 1; pageOrders("/orders", { status: document.getElementById("order-status").value }, render); });
        var prev = document.getElementById("op-prev");
        var next = document.getElementById("op-next");
        if (prev) prev.addEventListener("click", function () { orderPage--; pageOrders("/orders", { status: st }, render); });
        if (next) next.addEventListener("click", function () { orderPage++; pageOrders("/orders", { status: st }, render); });
        document.querySelectorAll("[data-oid]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.dataset.oid, status = btn.dataset.status;
            sp.confirm({
              title: "标记订单为已支付",
              text: "确认将该订单标记为“已支付”并发放对应服务吗？建议先在支付渠道侧核实到账后再执行。",
              okText: "确认已付",
              onOk: function () {
                api.adminOrder(id, { status: status })
                  .then(function () { sp.toast("已标记为" + status, "success"); pageOrders("/orders", { status: st }, render); })
                  .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
              },
            });
          });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 套餐 ============
  function pagePlans(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminPlans()
      .then(function (res) {
        var plans = res.data || [];
        var rows = plans.map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.name) + (it.featured ? ' <span class="badge badge-primary">主推</span>' : "") + '</td>' +
            '<td>¥' + it.price + (it.price_q != null ? '<div style="font-size:0.75rem;color:var(--text-muted)">季 ¥' + it.price_q + '</div>' : "") + (it.price_y != null ? '<div style="font-size:0.75rem;color:var(--text-muted)">年 ¥' + it.price_y + '</div>' : "") + '</td>' +
            '<td>' + it.traffic + ' GB</td>' +
            '<td>' + (it.devices || 0) + '</td>' +
            '<td>' + (it.active ? sp.badge("active") : sp.badge("disabled")) + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button class="btn btn-ghost btn-sm" data-edit-plan="' + it.id + '">编辑</button>' +
            (it.active
              ? '<button class="btn btn-ghost btn-sm" data-toggle-plan="' + it.id + '">下架</button>'
              : '<button class="btn btn-success btn-sm" data-toggle-plan="' + it.id + '">上架</button>') +
            '<button class="btn btn-danger btn-sm" data-del-plan="' + it.id + '">删除</button>' +
            '</div></td>' +
            '</tr>';
        }).join("");
        render(
          header("套餐管理", "共 " + plans.length + " 个 · 价格/流量/上下架精细调整") +
          card("套餐列表",
            table(["ID", "名称", "价格", "流量", "设备", "状态", "创建时间", "操作"], rows) +
            '<div style="margin-top:16px;padding-top:16px;border-top:1px dashed var(--border)">' +
            '<div class="card-title" style="margin-bottom:10px">新增套餐</div>' +
            '<div class="form-row">' +
            '<input class="form-control" id="p-name" placeholder="名称" />' +
            '<input class="form-control" id="p-price" placeholder="月价" type="number" />' +
            '<input class="form-control" id="p-priceQ" placeholder="季价" type="number" />' +
            '<input class="form-control" id="p-priceY" placeholder="年价" type="number" />' +
            '<input class="form-control" id="p-traffic" placeholder="流量(GB)" type="number" />' +
            '<input class="form-control" id="p-devices" placeholder="设备数" type="number" />' +
            '<input class="form-control" id="p-features" placeholder="特性,逗号分隔" />' +
            '</div>' +
            '<div class="form-row" style="margin-top:10px">' +
            '<select class="form-control" id="p-cycle"><option value="month">月付</option><option value="quarter">季付</option><option value="year">年付</option></select>' +
            '<label class="checkbox-wrap" style="align-self:center"><input type="checkbox" id="p-featured" /> 标记为主推</label>' +
            '</div>' +
            '<button class="btn btn-primary" id="p-add" style="margin-top:10px">新增套餐</button>' +
            '</div>'
          )
        );
        // 编辑
        document.querySelectorAll("[data-edit-plan]").forEach(function (b) {
          b.addEventListener("click", function () { showPlanEdit(parseInt(b.getAttribute("data-edit-plan"), 10), plans, render); });
        });
        // 上下架
        document.querySelectorAll("[data-toggle-plan]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-toggle-plan"), 10);
            var p = plans.find(function (x) { return x.id === id; });
            if (!p) return;
            api.adminUpdatePlan(id, { active: p.active ? 0 : 1 })
              .then(function () { sp.toast(p.active ? "已下架" : "已上架", "success"); pagePlans("/plans", {}, render); })
              .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
          });
        });
        // 删除
        document.querySelectorAll("[data-del-plan]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-del-plan"), 10);
            sp.confirm({
              title: "删除套餐",
              text: "删除后不可恢复，已购买该套餐的用户不受影响，但新用户将无法再购买。确认删除？",
              okText: "确认删除",
              danger: true,
              onOk: function () {
                api.adminDeletePlan(id)
                  .then(function () { sp.toast("已删除", "success"); pagePlans("/plans", {}, render); })
                  .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
              },
            });
          });
        });
        var addBtn = document.getElementById("p-add");
        if (addBtn) addBtn.addEventListener("click", function () {
          var name = document.getElementById("p-name").value.trim();
          var price = parseFloat(document.getElementById("p-price").value);
          var priceQ = document.getElementById("p-priceQ").value === "" ? null : parseFloat(document.getElementById("p-priceQ").value);
          var priceY = document.getElementById("p-priceY").value === "" ? null : parseFloat(document.getElementById("p-priceY").value);
          var traffic = parseFloat(document.getElementById("p-traffic").value);
          var devices = parseInt(document.getElementById("p-devices").value, 10) || 0;
          var cycle = document.getElementById("p-cycle").value;
          var featured = document.getElementById("p-featured").checked;
          var features = document.getElementById("p-features").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (!name) return sp.toast("请输入套餐名称", "error");
          if (!(price > 0)) return sp.toast("请输入有效价格", "error");
          if (!(traffic > 0)) return sp.toast("请输入有效流量", "error");
          if (devices < 0) return sp.toast("设备数不能为负", "error");
          addBtn.classList.add("loading"); addBtn.disabled = true;
          api.adminCreatePlan({ name: name, price: price, priceQ: priceQ, priceY: priceY, traffic: traffic, cycle: cycle, devices: devices, featured: featured, features: features })
            .then(function (r) { sp.toast(r.msg || "创建成功", "success"); pagePlans("/plans", {}, render); })
            .catch(function (e) { sp.toast(e.msg || e.message || "失败", "error"); })
            .finally(function () { addBtn.classList.remove("loading"); addBtn.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---- 套餐编辑弹窗 ----
  function showPlanEdit(id, plans, render) {
    var p = plans.find(function (x) { return x.id === id; });
    if (!p) return;
    sp.showModal(
      '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>编辑套餐 · ' + sp.esc(p.name) + '</h3></div>' +
      '<div class="field"><label>名称</label><input id="pe-name" class="form-control" value="' + sp.esc(p.name || "") + '" /></div>' +
      '<div class="field"><label>月价 (¥)</label><input id="pe-price" class="form-control" type="number" value="' + p.price + '" /></div>' +
      '<div class="field"><label>季价 (¥, 可空)</label><input id="pe-priceQ" class="form-control" type="number" value="' + (p.price_q != null ? p.price_q : "") + '" /></div>' +
      '<div class="field"><label>年价 (¥, 可空)</label><input id="pe-priceY" class="form-control" type="number" value="' + (p.price_y != null ? p.price_y : "") + '" /></div>' +
      '<div class="field"><label>月流量 (GB)</label><input id="pe-traffic" class="form-control" type="number" value="' + p.traffic + '" /></div>' +
      '<div class="field"><label>设备数</label><input id="pe-devices" class="form-control" type="number" value="' + (p.devices || 0) + '" /></div>' +
      '<div class="field"><label>特性 (逗号分隔)</label><input id="pe-features" class="form-control" value="' + sp.esc((p.features || []).join(", ")) + '" placeholder="例如: 全线路IEPL, 多设备共享" /></div>' +
      '<div class="field"><label>节点分组</label><input id="pe-nodeGroup" class="form-control" value="' + sp.esc(p.nodeGroup || "") + '" /></div>' +
      '<label class="checkbox-wrap" style="margin-top:6px"><input type="checkbox" id="pe-featured"' + (p.featured ? " checked" : "") + ' /> 标记为主推</label>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-pe-cancel>取消</button><button class="btn btn-primary" id="pe-save">保存</button></div></div>'
    );
    var cancel = document.querySelector(".modal-overlay.open [data-pe-cancel]");
    if (cancel) cancel.addEventListener("click", function () { sp.closeModal(); });
    var save = document.getElementById("pe-save");
    if (save) save.addEventListener("click", function () {
      var body = {
        name: document.getElementById("pe-name").value.trim(),
        price: parseFloat(document.getElementById("pe-price").value),
        priceQ: document.getElementById("pe-priceQ").value === "" ? null : parseFloat(document.getElementById("pe-priceQ").value),
        priceY: document.getElementById("pe-priceY").value === "" ? null : parseFloat(document.getElementById("pe-priceY").value),
        traffic: parseFloat(document.getElementById("pe-traffic").value),
        devices: parseInt(document.getElementById("pe-devices").value, 10) || 0,
        nodeGroup: document.getElementById("pe-nodeGroup").value.trim(),
        featured: document.getElementById("pe-featured").checked,
        features: document.getElementById("pe-features").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      };
      if (!body.name || !(body.price > 0) || !(body.traffic > 0)) { sp.toast("请填写名称/月价/流量", "error"); return; }
      api.adminUpdatePlan(id, body)
        .then(function () { sp.toast("已保存", "success"); sp.closeModal(); pagePlans("/plans", {}, render); })
        .catch(function (e) { sp.toast(e.msg || e.message || "保存失败", "error"); });
    });
  }

  // ============ 页面: 公告 ============
  var notices = [];
  function pageNotices(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminNotices()
      .then(function (res) {
        notices = res.data || [];
        var rows = notices.map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.title) + '</td>' +
            '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sp.esc(it.content || "") + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-del-nid="' + it.id + '">删除</button></td>' +
            '</tr>';
        }).join("");
        render(
          header("公告管理", "共 " + notices.length + " 条") +
          card("发布公告",
            '<div class="form-row"><input class="form-control" id="n-title" placeholder="标题" />' +
            '<textarea class="form-control" id="n-content" placeholder="内容"></textarea></div>' +
            '<button class="btn btn-primary" id="n-publish">发布</button>'
          ) +
          card("公告列表", table(["ID", "标题", "内容", "时间", "操作"], rows))
        );
        var pub = document.getElementById("n-publish");
        if (pub) pub.addEventListener("click", function () {
          var title = document.getElementById("n-title").value.trim();
          var content = document.getElementById("n-content").value.trim();
          if (!title) return sp.toast("请输入公告标题", "error");
          if (!content) return sp.toast("请输入公告内容", "error");
          pub.classList.add("loading"); pub.disabled = true;
          api.adminCreateNotice({ title: title, content: content })
            .then(function () { sp.toast("已发布", "success"); pageNotices("/notices", {}, render); })
            .catch(function (e) { sp.toast(e.msg || "失败", "error"); })
            .finally(function () { pub.classList.remove("loading"); pub.disabled = false; });
        });
        document.querySelectorAll("[data-del-nid]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            sp.confirm({
              title: "删除公告",
              text: "删除后不可恢复，确认删除这条公告吗？",
              okText: "确认删除",
              danger: true,
              onOk: function () {
                api.adminDeleteNotice(btn.dataset.delNid)
                  .then(function () { sp.toast("已删除", "success"); pageNotices("/notices", {}, render); })
                  .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
              },
            });
          });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 设置(分组化, 含支付渠道配置) ============
  var SETTING_GROUPS = [
    { prefix: "site.", title: "站点设置", desc: "品牌名称、标语、公告与营销参数" },
    { prefix: "pay.", title: "支付渠道", desc: "在此填写第三方支付渠道参数并保存，渠道立即启用；参数未填齐全的渠道不会对用户展示" },
    { prefix: "mail.", title: "邮件服务", desc: "SMTP 发信配置，用于发送验证邮件" },
    { prefix: "sec.", title: "安全设置", desc: "注册开关与邮箱验证要求" },
    { prefix: "plan.", title: "套餐与试用", desc: "新用户试用时长与流量" },
    { prefix: "ui.", title: "界面主题", desc: "站点可切换的主题(逗号分隔)" },
  ];
  var SETTING_LABELS = {
    "site.name": "站点名称", "site.slogan": "站点标语", "site.desc": "站点描述",
    "site.telegram": "Telegram 频道", "site.announce": "顶部公告条", "site.enable_register": "开放注册", "site.invite_bonus": "邀请奖励(元)",
    "pay.enable_balance": "启用余额支付", "pay.currency": "货币单位", "pay.min_recharge": "最低充值金额",
    "pay.epay_enabled": "启用易支付", "pay.epay_api_url": "易支付接口地址", "pay.epay_pid": "商户ID (pid)", "pay.epay_key": "商户密钥 (key)", "pay.epay_name": "易支付展示名称",
    "pay.alipay_enabled": "启用支付宝", "pay.alipay_app_id": "支付宝 AppID", "pay.alipay_private_key": "应用私钥", "pay.alipay_public_key": "支付宝公钥", "pay.alipay_gateway": "支付宝网关地址", "pay.alipay_name": "支付宝展示名称",
    "pay.usdt_enabled": "启用 USDT", "pay.usdt_api_url": "USDT 收银台地址", "pay.usdt_api_key": "USDT API Key", "pay.usdt_merchant_id": "商户号", "pay.usdt_wallet": "USDT 收款地址", "pay.usdt_name": "USDT 展示名称",
    "mail.host": "SMTP 主机", "mail.port": "SMTP 端口", "mail.secure": "SSL 加密", "mail.user": "发信账号", "mail.pass": "发信密码", "mail.from": "发件人地址",
    "sec.allow_signup": "允许注册", "sec.require_email_verify": "注册需邮箱验证",
    "plan.free_trial_days": "试用天数", "plan.trial_traffic": "试用流量(GB)",
    "ui.themes_enabled": "可用主题", "ui.default_theme": "默认主题",
  };
  function settingRow(k, s) {
    var val = s.value;
    var input;
    if (typeof val === "boolean") {
      input = '<div class="toggle ' + (val ? "on" : "") + '" data-setting-key="' + k + '" data-kind="toggle" role="switch" aria-checked="' + val + '" tabindex="0"></div>';
    } else {
      input = '<input class="form-control" style="width:240px" value="' + sp.esc(String(val)) + '" data-setting-key="' + k + '" data-type="' + s.type + '" data-kind="input" />';
    }
    var label = SETTING_LABELS[k] || k;
    var isSecret = k.indexOf("key") >= 0 || k.indexOf("pass") >= 0 || k.indexOf("private") >= 0;
    return '<div class="list-card setting-row"><div class="row">' +
      '<span><strong>' + sp.esc(label) + '</strong>' +
      (label !== k ? '<div class="tip">' + sp.esc(k) + '</div>' : '') +
      (isSecret ? '<div class="tip">敏感信息，请妥善保管</div>' : '') +
      '</span>' + input + '</div></div>';
  }

  function pageSettings(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.settingsAdmin()
      .then(function (res) {
        var settings = res.data || {};
        var body = "";
        SETTING_GROUPS.forEach(function (g) {
          var keys = Object.keys(settings).filter(function (k) { return k.indexOf(g.prefix) === 0; }).sort();
          if (!keys.length) return;
          body += '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-head"><div class="card-title">' + sp.esc(g.title) + '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted)">' + sp.esc(g.desc) + '</div></div>' +
            '<div>' + keys.map(function (k) { return settingRow(k, settings[k]); }).join("") + '</div></div>';
        });
        render(
          header("系统设置", "分组配置 · 支付渠道可在后台直接启用") +
          body +
          '<div style="margin-top:8px"><button class="btn btn-primary" id="settings-save">保存全部设置</button>' +
          '<span id="settings-msg" style="margin-left:12px;color:var(--text-muted);font-size:0.85rem"></span></div>'
        );
        // toggle 点击切换
        document.querySelectorAll('[data-kind="toggle"]').forEach(function (t) {
          t.addEventListener("click", function () {
            t.classList.toggle("on");
            t.setAttribute("aria-checked", t.classList.contains("on"));
          });
        });
        var saveBtn = document.getElementById("settings-save");
        if (saveBtn) saveBtn.addEventListener("click", function () {
          var vals = {};
          document.querySelectorAll("[data-setting-key]").forEach(function (el) {
            var k = el.dataset.settingKey;
            if (el.dataset.kind === "toggle") {
              vals[k] = el.classList.contains("on");
            } else {
              var type = el.dataset.type;
              var v = el.value;
              if (type === "int") vals[k] = parseInt(v, 10) || 0;
              else if (type === "float") vals[k] = parseFloat(v) || 0;
              else if (type === "bool") vals[k] = v === "true";
              else vals[k] = v;
            }
          });
          saveBtn.classList.add("loading"); saveBtn.disabled = true;
          api.settingsSave({ values: vals })
            .then(function (r) {
              var m = document.getElementById("settings-msg");
              if (m) m.textContent = r.msg || "已保存";
              sp.toast("设置已保存", "success");
              pageSettings("/settings", {}, render);
            })
            .catch(function (e) { sp.toast(e.msg || e.message || "保存失败", "error"); })
            .finally(function () { saveBtn.classList.remove("loading"); saveBtn.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 权限 ============
  function pagePerms(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    Promise.all([api.permsCatalog(), api.adminUsers(1, 200)])
      .then(function (res) {
        var catalog = res[0].data;
        var users = (res[1].data && res[1].data.list) || [];
        var admins = users.filter(function (u) { return u.role === "admin" || u.role === "superadmin"; });
        // group catalog
        var groups = {};
        (catalog.groups || []).forEach(function (g) {
          if (!groups[g.group]) groups[g.group] = [];
          groups[g.group].push(g);
        });
        var body = "";
        for (var gname in groups) {
          body += '<div class="card" style="margin-bottom:16px"><div class="card-title" style="color:var(--primary);margin-bottom:12px">' + sp.esc(gname) + '</div><div class="flex-wrap">' +
            groups[gname].map(function (p) {
              return '<label class="checkbox-wrap" style="margin-right:16px;margin-bottom:8px"><input type="checkbox" class="perm-check" data-perm="' + sp.esc(p.key) + '" /> ' + sp.esc(p.label) + '</label>';
            }).join("") + '</div></div>';
        }
        var adminRows = admins.map(function (u) {
          return '<tr>' +
            '<td>' + u.id + '</td>' +
            '<td>' + sp.esc(u.email) + '</td>' +
            '<td>' + sp.badge(u.role) + '</td>' +
            '<td><button class="btn btn-primary btn-sm" data-perms-uid="' + u.id + '">设置权限</button></td>' +
            '</tr>';
        }).join("");
        render(
          header("权限管理", "管理员授权") +
          card("权限点目录", body) +
          card("管理员列表",
            table(["ID", "邮箱", "角色", "操作"], adminRows) +
            '<div id="perm-modal-area"></div>'
          )
        );
        document.querySelectorAll("[data-perms-uid]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var uid = btn.dataset.permsUid;
            api.permsOf(uid)
              .then(function (r) {
                var assigned = r.data || [];
                showPermModal(uid, assigned, render);
              });
          });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  function showPermModal(uid, assigned, render) {
    sp.showModal(
      '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>设置管理员权限</h3></div>' +
      '<div id="modal-perms">' + sp.loading() + '</div>' +
      '<button class="btn btn-primary" id="modal-save-perms">保存</button></div>'
    );
    Promise.all([api.permsCatalog(), api.permsOf(uid)])
      .then(function (resArr) {
        var catalog = resArr[0].data;
        var cur = resArr[1].data || [];
        var groups = {};
        (catalog.groups || []).forEach(function (g) {
          if (!groups[g.group]) groups[g.group] = [];
          groups[g.group].push(g);
        });
        var body = "";
        for (var gname in groups) {
          body += '<div style="margin-bottom:12px"><div style="font-weight:600;color:var(--primary);margin-bottom:6px">' + sp.esc(gname) + '</div><div class="flex-wrap">' +
            groups[gname].map(function (p) {
              var on = cur.indexOf(p.key) >= 0;
              return '<label class="checkbox-wrap" style="margin-right:14px;margin-bottom:6px"><input type="checkbox" class="perm-check" data-perm="' + sp.esc(p.key) + '"' + (on ? ' checked' : '') + ' /> ' + sp.esc(p.label) + '</label>';
            }).join("") + '</div></div>';
        }
        document.getElementById("modal-perms").innerHTML = body;
        var saveBtn = document.getElementById("modal-save-perms");
        if (saveBtn) saveBtn.addEventListener("click", function () {
          var perms = [];
          document.querySelectorAll("#modal-perms .perm-check").forEach(function (c) {
            if (c.checked) perms.push(c.dataset.perm);
          });
          api.permsSet(uid, { perms: perms })
            .then(function () { sp.toast("权限已更新", "success"); sp.closeModal(); pagePerms("/perms", {}, render); })
            .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
        });
      })
      .catch(function () { document.getElementById("modal-perms").innerHTML = '<div class="empty-state"><div class="ico">⚠️</div><p>加载失败</p></div>'; });
  }

  // ============ 页面: 站点内容管理 (落地页文案/区块开关/内容) ============
  function pageSite(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.settingsAdmin()
      .then(function (res) {
        var s = res.data || {};
        var g = function (k) { return s[k] ? s[k].value : null; };
        var jsonArea = function (id, val, rows) {
          return '<textarea class="form-control" id="' + id + '" rows="' + (rows || 6) + '" spellcheck="false" style="font-family:monospace;font-size:0.85rem">' + sp.esc(JSON.stringify(val || [], null, 2)) + '</textarea>';
        };
        var toggleRow = function (key, label, on) {
          return '<div class="list-card"><div class="row"><span><strong>' + label + '</strong></span>' +
            '<div class="toggle ' + (on ? "on" : "") + '" data-skey="' + key + '" role="switch" tabindex="0"></div></div></div>';
        };
        render(
          header("站点内容", "落地页文案、区块开关与内容（留空 / 空数组 = 用前端默认）") +
          card("品牌与文案",
            '<div class="field"><label>Hero 主标题（留空用默认）</label><input class="form-control" id="c-heroTitle" value="' + sp.esc(g("content.hero_title") || "") + '" placeholder="例如：极光般的稳定，云端的畅通" /></div>' +
            '<div class="field"><label>Hero 副标题</label><input class="form-control" id="c-heroSub" value="' + sp.esc(g("content.hero_sub") || "") + '" placeholder="例如：全球多地区高质量节点，稳定不跑路" /></div>' +
            '<div class="field"><label>标语 Slogan</label><input class="form-control" id="c-slogan" value="' + sp.esc(g("content.slogan") || "") + '" /></div>'
          ) +
          card("页面区块开关",
            toggleRow("content.show_features", "显示「优势」区块", g("content.show_features") !== false) +
            toggleRow("content.show_nodes", "显示「节点」区块", g("content.show_nodes") !== false) +
            toggleRow("content.show_plans", "显示「套餐」区块", g("content.show_plans") !== false) +
            toggleRow("content.show_docs", "显示「教程」区块", g("content.show_docs") !== false) +
            toggleRow("content.show_faq", "显示「FAQ」区块", g("content.show_faq") !== false) +
            toggleRow("content.show_trust", "显示「信任数字」条", g("content.show_trust") !== false)
          ) +
          card("信任数字 (JSON)",
            jsonArea("c-trust", g("content.trust"), 4) +
            '<div class="tip">格式：[{"val":"99.9%","label":"在线率"}, {"val":"12+","label":"地区节点"}]</div>'
          ) +
          card("FAQ 内容 (JSON)",
            jsonArea("c-faqs", g("content.faqs"), 7) +
            '<div class="tip">格式：[{"q":"支持哪些客户端？","a":"支持 Clash / sing-box / v2rayN 等主流客户端。"}]</div>'
          ) +
          card("教程文档 (JSON)",
            jsonArea("c-docs", g("content.docs"), 7) +
            '<div class="tip">格式：[{"group":"分组名","items":[{"t":"标题","upd":"2026-08","body":"&lt;p&gt;内容HTML&lt;/p&gt;"}]}]</div>'
          ) +
          card("套餐列表 (JSON, 可选)",
            jsonArea("c-plans", g("content.plans"), 7) +
            '<div class="tip">覆盖落地页展示套餐。留空数组则使用后端数据库中的套餐。参考 site/js/config.js 的 plans 结构。</div>'
          ) +
          card("节点状态 (JSON, 可选)",
            jsonArea("c-nodes", g("content.nodes"), 7) +
            '<div class="tip">节点展示已由「节点管理」页面维护（后端节点库 /api/public/nodes 实时返回），此字段仅作向后兼容、一般无需填写。</div>'
          ) +
          '<div style="margin-top:8px"><button class="btn btn-primary" id="site-save">保存站点内容</button>' +
          '<span id="site-msg" style="margin-left:12px;color:var(--text-muted);font-size:0.85rem"></span></div>'
        );
        document.querySelectorAll("[data-skey]").forEach(function (t) {
          t.addEventListener("click", function () { t.classList.toggle("on"); });
        });
        var save = document.getElementById("site-save");
        if (save) save.addEventListener("click", function () {
          var vals = {};
          document.querySelectorAll("[data-skey]").forEach(function (t) {
            vals[t.getAttribute("data-skey")] = t.classList.contains("on");
          });
          vals["content.hero_title"] = document.getElementById("c-heroTitle").value.trim();
          vals["content.hero_sub"] = document.getElementById("c-heroSub").value.trim();
          vals["content.slogan"] = document.getElementById("c-slogan").value.trim();
          var jsonFields = [["c-trust", "content.trust"], ["c-faqs", "content.faqs"], ["c-docs", "content.docs"], ["c-plans", "content.plans"], ["c-nodes", "content.nodes"]];
          try {
            jsonFields.forEach(function (pair) {
              var raw = document.getElementById(pair[0]).value.trim();
              vals[pair[1]] = raw ? JSON.parse(raw) : [];
            });
          } catch (err) {
            sp.toast("JSON 格式错误，请检查后重试", "error");
            return;
          }
          save.classList.add("loading"); save.disabled = true;
          api.settingsSave({ values: vals })
            .then(function (r) {
              var m = document.getElementById("site-msg");
              if (m) m.textContent = r.msg || "已保存";
              sp.toast("站点内容已保存", "success");
            })
            .catch(function (e) { sp.toast(e.msg || e.message || "保存失败", "error"); })
            .finally(function () { save.classList.remove("loading"); save.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 节点管理 (数据源已切换为后端节点库) ============
  function pageNodesMgmt(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    Promise.all([api.adminNodes(), api.adminTrafficLogs(1, 8)])
      .then(function (res) {
        var nodes = res[0].data || [];
        var traffic = (res[1].data && res[1].data.list) || [];
        render(
          header("节点管理", "节点库 CRUD · 落地页/用户中心实时读取 · 流量明细可从面板卡片录入") +
          card("节点列表",
            table(["ID", "名称", "区域", "状态", "延迟", "负载", "创建时间", "操作"],
              nodes.map(function (n) {
                return '<tr>' +
                  '<td>' + n.id + '</td>' +
                  '<td>' + sp.esc(n.name) + '</td>' +
                  '<td>' + sp.esc(n.code || "-") + ' <span class="badge">' + sp.esc(n.region || "-") + '</span></td>' +
                  '<td>' + (n.online ? sp.badge("online") : sp.badge("offline")) + '</td>' +
                  '<td>' + (n.latency || 0) + ' ms</td>' +
                  '<td>' + (n.load || 0) + '%</td>' +
                  '<td>' + sp.timeAgo(n.created_at) + '</td>' +
                  '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
                  '<button class="btn btn-ghost btn-sm" data-node-edit="' + n.id + '">编辑</button>' +
                  '<button class="btn btn-ghost btn-sm" data-node-toggle="' + n.id + '">' + (n.online ? "下线" : "上线") + '</button>' +
                  '<button class="btn btn-danger btn-sm" data-node-del="' + n.id + '">删除</button>' +
                  '</div></td></tr>';
              }).join(""),
              "暂无节点，点击下方「新增节点」添加"
            ) +
            '<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)">' +
            '<div class="card-title" style="margin-bottom:10px">新增节点</div>' +
            '<div class="form-row">' +
            '<input class="form-control" id="n-name" placeholder="节点名称(如 香港01)" />' +
            '<input class="form-control" id="n-addr" placeholder="主机 host" />' +
            '<input class="form-control" id="n-port" placeholder="端口" type="number" value="443" style="width:90px" />' +
            '<input class="form-control" id="n-nodeid" placeholder="UUID/密码" style="width:160px" />' +
            '<input class="form-control" id="n-code" placeholder="区域码(HK)" style="width:110px" />' +
            '<select class="form-control" id="n-region" style="width:120px"><option value="Asia">Asia</option><option value="NorthAm">NorthAm</option><option value="Europe">Europe</option><option value="Oceania">Oceania</option></select>' +
            '</div>' +
            '<div class="form-row" style="margin-top:10px">' +
            '<select class="form-control" id="n-protocol" style="width:110px"><option value="vless">vless</option><option value="trojan">trojan</option><option value="ss">ss</option></select>' +
            '<input class="form-control" id="n-latency" placeholder="延迟 ms" type="number" style="width:110px" />' +
            '<input class="form-control" id="n-load" placeholder="负载 %" type="number" style="width:110px" />' +
            '<input class="form-control" id="n-group" placeholder="分组(group_name)" style="width:180px" value="default" />' +
            '<label class="checkbox-wrap" style="align-self:center"><input type="checkbox" id="n-online" checked /> 在线</label>' +
            '</div>' +
            '<button class="btn btn-primary" id="n-add" style="margin-top:10px">新增节点</button>' +
            '</div>'
          ) +
          card("最近流量记录",
            table(["ID", "用户", "节点", "流量(GB)", "日期"], traffic.map(function (t) {
              return '<tr><td>' + t.id + '</td><td>' + sp.esc(t.email || t.user_id) + '</td><td>' + sp.esc(t.node_name || t.node_id) + '</td>' +
                '<td>' + gbOf(t) + '</td><td>' + sp.timeAgo(t.created_at) + '</td></tr>';
            }).join(""), "暂无流量记录") +
            '<div class="form-row" style="margin-top:12px">' +
            '<input class="form-control" id="t-user" placeholder="用户ID" type="number" style="width:120px" />' +
            '<input class="form-control" id="t-node" placeholder="节点ID" type="number" style="width:120px" />' +
            '<input class="form-control" id="t-gb" placeholder="流量(GB)" type="number" style="width:140px" />' +
            '<button class="btn btn-ghost" id="t-record">录入流量</button>' +
            '<button class="btn btn-ghost" id="t-logs">查看全部流量</button>' +
            '</div>'
          )
        );
        var add = document.getElementById("n-add");
        if (add) add.addEventListener("click", function () {
          var d = {
            name: document.getElementById("n-name").value.trim(),
            host: document.getElementById("n-addr").value.trim(),
            port: parseInt(document.getElementById("n-port").value, 10) || 443,
            node_id: document.getElementById("n-nodeid").value.trim(),
            code: document.getElementById("n-code").value.trim(),
            region: document.getElementById("n-region").value,
            protocol: document.getElementById("n-protocol").value,
            group_name: document.getElementById("n-group").value.trim() || "default",
            latency: parseInt(document.getElementById("n-latency").value, 10) || 0,
            load: parseInt(document.getElementById("n-load").value, 10) || 0,
            online: document.getElementById("n-online").checked,
          };
          if (!d.name || !d.host) return sp.toast("请填写节点名称与主机", "error");
          add.classList.add("loading"); add.disabled = true;
          api.adminCreateNode(d)
            .then(function () { sp.toast("节点已创建", "success"); pageNodesMgmt("/nodes-mgmt", {}, render); })
            .catch(function (e) { sp.toast(e.msg || e.message || "创建失败", "error"); })
            .finally(function () { add.classList.remove("loading"); add.disabled = false; });
        });
        document.querySelectorAll("[data-node-edit]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-node-edit"), 10);
            var n = nodes.find(function (x) { return x.id === id; });
            if (n) showNodeEdit(n, render);
          });
        });
        document.querySelectorAll("[data-node-toggle]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-node-toggle"), 10);
            var n = nodes.find(function (x) { return x.id === id; });
            if (!n) return;
            api.adminUpdateNode(id, { online: n.online ? 0 : 1 })
              .then(function () { sp.toast(n.online ? "已下线" : "已上线", "success"); pageNodesMgmt("/nodes-mgmt", {}, render); })
              .catch(function (e) { sp.toast(e.msg || "操作失败", "error"); });
          });
        });
        document.querySelectorAll("[data-node-del]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-node-del"), 10);
            sp.confirm({
              title: "删除节点",
              text: "删除后将不再展示，确认删除该节点？",
              okText: "确认删除", danger: true,
              onOk: function () {
                api.adminDeleteNode(id)
                  .then(function () { sp.toast("已删除", "success"); pageNodesMgmt("/nodes-mgmt", {}, render); })
                  .catch(function (e) { sp.toast(e.msg || "删除失败", "error"); });
              },
            });
          });
        });
        var rec = document.getElementById("t-record");
        if (rec) rec.addEventListener("click", function () {
          var uid = parseInt(document.getElementById("t-user").value, 10);
          var nid = parseInt(document.getElementById("t-node").value, 10);
          var gb = parseFloat(document.getElementById("t-gb").value);
          if (!uid || !nid || isNaN(gb)) return sp.toast("请填写用户ID/节点ID/流量", "error");
          api.adminRecordTraffic({ user_id: uid, node_id: nid, down: Math.round(gb * 1024 * 1024 * 1024) })
            .then(function () { sp.toast("已录入(" + (gb * 1024 * 1024 * 1024 / (1024 * 1024 * 1024)).toFixed(2) + "GB)", "success"); pageNodesMgmt("/nodes-mgmt", {}, render); })
            .catch(function (e) { sp.toast(e.msg || "失败", "error"); });
        });
        var logs = document.getElementById("t-logs");
        if (logs) logs.addEventListener("click", function () { renderTrafficLogs(render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---- 节点编辑弹窗 ----
  function showNodeEdit(n, render) {
    sp.showModal(
      '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>编辑节点 · ' + sp.esc(n.name) + '</h3></div>' +
      '<div class="field"><label>名称</label><input id="ne-name" class="form-control" value="' + sp.esc(n.name || "") + '" /></div>' +
      '<div class="field"><label>主机 host</label><input id="ne-addr" class="form-control" value="' + sp.esc(n.host || "") + '" /></div>' +
      '<div class="field"><label>端口</label><input id="ne-port" class="form-control" type="number" value="' + (n.port || 443) + '" /></div>' +
      '<div class="field"><label>UUID/密码 (node_id)</label><input id="ne-nodeid" class="form-control" value="' + sp.esc(n.node_id || "") + '" /></div>' +
      '<div class="field"><label>区域码</label><input id="ne-code" class="form-control" value="' + sp.esc(n.code || "") + '" /></div>' +
      '<div class="field"><label>大区</label><select id="ne-region" class="form-control">' +
      ["Asia", "NorthAm", "Europe", "Oceania"].map(function (r) { return '<option value="' + r + '"' + (n.region === r ? " selected" : "") + '>' + r + '</option>'; }).join("") +
      '</select></div>' +
      '<div class="field"><label>协议</label><select id="ne-protocol" class="form-control"><option value="vless"' + ((n.protocol || "vless") === "vless" ? " selected" : "") + '>vless</option><option value="trojan"' + (n.protocol === "trojan" ? " selected" : "") + '>trojan</option><option value="ss"' + (n.protocol === "ss" ? " selected" : "") + '>ss</option></select></div>' +
      '<div class="field"><label>分组 (group_name)</label><input id="ne-group" class="form-control" value="' + sp.esc(n.group_name || "default") + '" /></div>' +
      '<div class="field"><label>延迟 ms</label><input id="ne-latency" class="form-control" type="number" value="' + (n.latency || 0) + '" /></div>' +
      '<div class="field"><label>负载 %</label><input id="ne-load" class="form-control" type="number" value="' + (n.load || 0) + '" /></div>' +
      '<label class="checkbox-wrap" style="margin-top:6px"><input type="checkbox" id="ne-online"' + (n.online ? " checked" : "") + ' /> 在线</label>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-ne-cancel>取消</button><button class="btn btn-primary" id="ne-save">保存</button></div></div>'
    );
    var cancel = document.querySelector(".modal-overlay.open [data-ne-cancel]");
    if (cancel) cancel.addEventListener("click", function () { sp.closeModal(); });
    var save = document.getElementById("ne-save");
    if (save) save.addEventListener("click", function () {
      var body = {
        name: document.getElementById("ne-name").value.trim(),
        host: document.getElementById("ne-addr").value.trim(),
        port: parseInt(document.getElementById("ne-port").value, 10) || 443,
        node_id: document.getElementById("ne-nodeid").value.trim(),
        code: document.getElementById("ne-code").value.trim(),
        region: document.getElementById("ne-region").value,
        protocol: document.getElementById("ne-protocol").value,
        group_name: document.getElementById("ne-group").value.trim() || "default",
        latency: parseInt(document.getElementById("ne-latency").value, 10) || 0,
        load: parseInt(document.getElementById("ne-load").value, 10) || 0,
        online: document.getElementById("ne-online").checked,
      };
      if (!body.name) return sp.toast("请输入名称", "error");
      api.adminUpdateNode(n.id, body)
        .then(function () { sp.toast("已保存", "success"); sp.closeModal(); pageNodesMgmt("/nodes-mgmt", {}, render); })
        .catch(function (e) { sp.toast(e.msg || "保存失败", "error"); });
    });
  }

  // ---- 全部流量明细 ----
  var trafficPage = 1;
  function renderTrafficLogs(render) {
    render(sp.loading());
    api.adminTrafficLogs(trafficPage, 20)
      .then(function (res) {
        var d = res.data;
        render(
          header("流量明细", "节点使用流量记录") +
          card("流量记录",
            table(["ID", "用户", "节点", "流量(GB)", "时间"], (d.list || []).map(function (t) {
              return '<tr><td>' + t.id + '</td><td>' + sp.esc(t.email || t.user_id) + '</td><td>' + sp.esc(t.node_name || t.node_id) + '</td>' +
                '<td>' + gbOf(t) + '</td><td>' + sp.timeAgo(t.created_at) + '</td></tr>';
            }).join("")) +
            '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
            (trafficPage > 1 ? '<button class="btn btn-ghost btn-sm" id="tp-prev">上一页</button>' : '') +
            '<span style="padding:8px">' + trafficPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
            (d.list.length ? '<button class="btn btn-ghost btn-sm" id="tp-next">下一页</button>' : '') +
            '<button class="btn btn-ghost btn-sm" id="tp-back">← 返回节点管理</button>' +
            '</div>'
          )
        );
        var prev = document.getElementById("tp-prev");
        var next = document.getElementById("tp-next");
        var back = document.getElementById("tp-back");
        if (prev) prev.addEventListener("click", function () { trafficPage--; renderTrafficLogs(render); });
        if (next) next.addEventListener("click", function () { trafficPage++; renderTrafficLogs(render); });
        if (back) back.addEventListener("click", function () { pageNodesMgmt("/nodes-mgmt", {}, render); });
      })
      .catch(function () { render(sp.error("加载失败，请检查网络后重试", function () { renderTrafficLogs(render); })); });
  }

  // ============ 页面: 工单处理 (管理侧) ============
  var ticketPage = 1;
  function pageTickets(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    var st = qs.status || "";
    api.adminTickets(ticketPage, 20, st)
      .then(function (res) {
        var d = res.data || { list: [], total: 0, limit: 20 };
        var rows = d.list.map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.email || ("用户" + it.user_id)) + '</td>' +
            '<td>' + sp.badge(it.level) + '</td>' +
            '<td>' + sp.esc(it.subject) + '</td>' +
            '<td>' + sp.badge(it.status) + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '<td><a class="btn btn-ghost btn-sm" href="#/tickets/detail?&id=' + it.id + '">处理</a></td>' +
            '</tr>';
        }).join("");
        render(
          header("工单处理", "用户提交的工单队列") +
          '<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="card-title">筛选</div></div>' +
          '<div class="form-row"><select class="form-control" id="ticket-status">' +
          '<option value="">全部</option><option value="open"' + (st === "open" ? " selected" : "") + '>进行中</option>' +
          '<option value="closed"' + (st === "closed" ? " selected" : "") + '>已关闭</option></select>' +
          '<div><button class="btn btn-primary" id="ticket-search">筛选</button></div></div></div>' +
          table(["ID", "用户", "优先级", "主题", "状态", "时间", "操作"], rows) +
          '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
          (ticketPage > 1 ? '<button class="btn btn-ghost btn-sm" id="ticket-prev">上一页</button>' : '') +
          '<span style="padding:8px">' + ticketPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
          (d.list.length ? '<button class="btn btn-ghost btn-sm" id="ticket-next">下一页</button>' : '') +
          '</div>'
        );
        var s = document.getElementById("ticket-search");
        if (s) s.addEventListener("click", function () { ticketPage = 1; pageTickets("/tickets", { status: document.getElementById("ticket-status").value }, render); });
        var prev = document.getElementById("ticket-prev");
        var next = document.getElementById("ticket-next");
        if (prev) prev.addEventListener("click", function () { ticketPage--; pageTickets("/tickets", { status: st }, render); });
        if (next) next.addEventListener("click", function () { ticketPage++; pageTickets("/tickets", { status: st }, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---- 工单处理详情 ----
  function pageTicketDetail(path, qs, render) {
    var id = qs.id;
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminTicketDetail(id)
      .then(function (res) {
        var d = res.data;
        var t = d.ticket;
        var msgs = (d.messages || []).map(function (m) {
          return '<div class="ticket-msg' + (m.is_admin ? " ticket-msg-admin" : "") + '">' +
            '<div class="ticket-msg-head"><strong>' + sp.esc(m.is_admin ? "管理员" : (m.email || "用户")) + '</strong>' +
            '<span>' + sp.timeAgo(m.created_at) + '</span></div>' +
            '<div>' + sp.esc(m.content) + '</div></div>';
        }).join("");
        render(
          header("工单 #" + id, (t.email ? sp.esc(t.email) : "") + " · " + sp.badge(t.status)) +
          card("工单详情",
            '<div class="list-card"><div class="row"><span>主题</span><strong>' + sp.esc(t.subject) + '</strong></div>' +
            '<div class="row"><span>优先级</span><span>' + sp.badge(t.level) + '</span></div>' +
            '<div class="row"><span>状态</span><span>' + sp.badge(t.status) + '</span></div></div>'
          ) +
          card("对话记录", msgs || '<div style="color:var(--text-muted)">暂无消息</div>') +
          card("回复",
            '<textarea class="form-control" id="tk-reply" rows="3" placeholder="输入回复内容"></textarea>' +
            '<div style="margin-top:10px;display:flex;gap:8px">' +
            '<button class="btn btn-primary" id="tk-send">发送回复</button>' +
            (t.status === "open"
              ? '<button class="btn btn-ghost" id="tk-close">关闭工单</button>'
              : '<button class="btn btn-ghost" id="tk-reopen">重新打开</button>') +
            '<button class="btn btn-ghost" id="tk-back">← 返回列表</button></div>'
          )
        );
        var send = document.getElementById("tk-send");
        if (send) send.addEventListener("click", function () {
          var content = document.getElementById("tk-reply").value.trim();
          if (!content) return sp.toast("请输入回复内容", "error");
          send.classList.add("loading"); send.disabled = true;
          api.adminTicketReply(id, { content: content })
            .then(function () { sp.toast("已发送", "success"); pageTicketDetail("/tickets", { id: id }, render); })
            .catch(function (e) { sp.toast(e.msg || "发送失败", "error"); })
            .finally(function () { send.classList.remove("loading"); send.disabled = false; });
        });
        var close = document.getElementById("tk-close");
        if (close) close.addEventListener("click", function () {
          api.adminTicketStatus(id, { status: "closed" })
            .then(function () { sp.toast("已关闭", "success"); pageTicketDetail("/tickets", { id: id }, render); })
            .catch(function (e) { sp.toast(e.msg || "操作失败", "error"); });
        });
        var reopen = document.getElementById("tk-reopen");
        if (reopen) reopen.addEventListener("click", function () {
          api.adminTicketStatus(id, { status: "open" })
            .then(function () { sp.toast("已重开", "success"); pageTicketDetail("/tickets", { id: id }, render); })
            .catch(function (e) { sp.toast(e.msg || "操作失败", "error"); });
        });
        var back = document.getElementById("tk-back");
        if (back) back.addEventListener("click", function () { pageTickets("/tickets", {}, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 优惠码管理 ============
  function pageCoupons(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminCoupons()
      .then(function (res) {
        var list = res.data || [];
        var rows = list.map(function (c) {
          var expired = c.expired_at && c.expired_at < Math.floor(Date.now() / 1000);
          return '<tr>' +
            '<td>' + c.id + '</td>' +
            '<td><code>' + sp.esc(c.code) + '</code></td>' +
            '<td>' + (c.type === "fixed" ? "¥" + c.value : c.value + "% 折扣") + '</td>' +
            '<td>¥' + (c.min_amount || 0) + '</td>' +
            '<td>' + (c.used_times || 0) + (c.limit_times ? " / " + c.limit_times : "") + '</td>' +
            '<td>' + c.per_user + ' 次/人</td>' +
            '<td>' + (c.expired_at ? new Date(c.expired_at * 1000).toLocaleDateString() : "永久") + '</td>' +
            '<td>' + ((c.status === 1 || c.status === true) ? sp.badge("启用") : sp.badge("停用")) + '</td>' +
            '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<button class="btn btn-ghost btn-sm" data-coupon-edit="' + c.id + '">编辑</button>' +
            '<button class="btn btn-ghost btn-sm" data-coupon-toggle="' + c.id + '">' + ((c.status === 1 || c.status === true) ? "停用" : "启用") + '</button>' +
            '<button class="btn btn-danger btn-sm" data-coupon-del="' + c.id + '">删除</button>' +
            '</div></td></tr>';
        }).join("");
        render(
          header("优惠码管理", "共 " + list.length + " 个 · 支持立减/折扣、限时限量、指定套餐") +
          card("新建优惠码",
            '<div class="form-row">' +
            '<input class="form-control" id="co-code" placeholder="自定义码(留空自动生成)" style="width:200px" />' +
            '<select class="form-control" id="co-type" style="width:120px"><option value="percent">折扣%</option><option value="fixed">立减¥</option></select>' +
            '<input class="form-control" id="co-value" placeholder="值(10=9折 或 ¥金额)" type="number" style="width:110px" />' +
            '<input class="form-control" id="co-min" placeholder="满额(0=不限)" type="number" style="width:110px" />' +
            '<input class="form-control" id="co-limit" placeholder="总次数(0=不限)" type="number" style="width:110px" />' +
            '<input class="form-control" id="co-per" placeholder="每人限(默认1)" type="number" style="width:110px" />' +
            '<input class="form-control" id="co-expire" type="date" style="width:150px" />' +
            '</div>' +
            '<div class="form-row" style="margin-top:10px">' +
            '<input class="form-control" id="co-plans" placeholder="限定套餐ID,逗号分隔(留空=全部)" />' +
            '<button class="btn btn-primary" id="co-add">创建</button>' +
            '</div>'
          ) +
          card("批量生成",
            '<div class="form-row">' +
            '<input class="form-control" id="co-batch-count" placeholder="数量" type="number" value="20" style="width:100px" />' +
            '<select class="form-control" id="co-batch-type" style="width:120px"><option value="percent">折扣%</option><option value="fixed">立减¥</option></select>' +
            '<input class="form-control" id="co-batch-value" placeholder="值" type="number" value="10" style="width:100px" />' +
            '<input class="form-control" id="co-batch-min" placeholder="满额(0=不限)" type="number" style="width:110px" />' +
            '<input class="form-control" id="co-batch-prefix" placeholder="前缀(如 VIP)" style="width:120px" />' +
            '<button class="btn btn-ghost" id="co-batch">批量生成</button>' +
            '</div>' +
            '<div id="co-batch-out" style="margin-top:10px"></div>'
          ) +
          card("优惠码列表", table(["ID", "码", "优惠", "满额", "已用", "每人", "有效期", "状态", "操作"], rows))
        );
        document.querySelectorAll("[data-coupon-edit]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-coupon-edit"), 10);
            var c = list.find(function (x) { return x.id === id; });
            if (c) showCouponEdit(c, render);
          });
        });
        document.querySelectorAll("[data-coupon-toggle]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-coupon-toggle"), 10);
            var c = list.find(function (x) { return x.id === id; });
            if (!c) return;
            var on = c.status === 1 || c.status === true;
            api.adminUpdateCoupon(id, { status: on ? 0 : 1 })
              .then(function () { sp.toast(on ? "已停用" : "已启用", "success"); pageCoupons("/coupons", {}, render); })
              .catch(function (e) { sp.toast(e.msg || "操作失败", "error"); });
          });
        });
        document.querySelectorAll("[data-coupon-del]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-coupon-del"), 10);
            sp.confirm({
              title: "删除优惠码",
              text: "删除后用户无法再使用该码，确认删除？",
              okText: "确认删除", danger: true,
              onOk: function () {
                api.adminDeleteCoupon(id)
                  .then(function () { sp.toast("已删除", "success"); pageCoupons("/coupons", {}, render); })
                  .catch(function (e) { sp.toast(e.msg || "删除失败", "error"); });
              },
            });
          });
        });
        var add = document.getElementById("co-add");
        if (add) add.addEventListener("click", function () {
          var expireInput = document.getElementById("co-expire").value;
          var body = {
            code: document.getElementById("co-code").value.trim().toUpperCase(),
            type: document.getElementById("co-type").value,
            value: parseFloat(document.getElementById("co-value").value),
            min_amount: parseFloat(document.getElementById("co-min").value) || 0,
            limit_times: parseInt(document.getElementById("co-limit").value, 10) || 0,
            per_user: parseInt(document.getElementById("co-per").value, 10),
            plan_ids: document.getElementById("co-plans").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean).join(","),
            expired_at: expireInput ? Math.floor(new Date(expireInput + "T23:59:59").getTime() / 1000) : null,
          };
          if (!(body.value > 0)) return sp.toast("请填写优惠值", "error");
          add.classList.add("loading"); add.disabled = true;
          api.adminCreateCoupon(body)
            .then(function () { sp.toast("已创建", "success"); pageCoupons("/coupons", {}, render); })
            .catch(function (e) { sp.toast(e.msg || "创建失败", "error"); })
            .finally(function () { add.classList.remove("loading"); add.disabled = false; });
        });
        var batch = document.getElementById("co-batch");
        if (batch) batch.addEventListener("click", function () {
          var body = {
            count: parseInt(document.getElementById("co-batch-count").value, 10) || 20,
            type: document.getElementById("co-batch-type").value,
            value: parseFloat(document.getElementById("co-batch-value").value),
            min_amount: parseFloat(document.getElementById("co-batch-min").value) || 0,
            prefix: document.getElementById("co-batch-prefix").value.trim(),
          };
          if (!(body.value > 0)) return sp.toast("请填写优惠值", "error");
          batch.classList.add("loading"); batch.disabled = true;
          api.adminBatchCoupons(body)
            .then(function (r) {
              var out = document.getElementById("co-batch-out");
              if (out) out.innerHTML = '<div class="tip">' + sp.esc(r.msg || ("已生成 " + (r.data && r.data.codes ? r.data.codes.length : 0) + " 个")) + '</div>' +
                '<textarea class="form-control" rows="5" style="font-family:monospace">' + ((r.data && r.data.codes) || []).join("\n") + '</textarea>';
              sp.toast("批量生成完成", "success");
              pageCoupons("/coupons", {}, render);
            })
            .catch(function (e) { sp.toast(e.msg || "生成失败", "error"); })
            .finally(function () { batch.classList.remove("loading"); batch.disabled = false; });
        });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---- 优惠码编辑弹窗 ----
  function showCouponEdit(c, render) {
    var dateVal = c.expired_at ? new Date(c.expired_at * 1000).toISOString().slice(0, 10) : "";
    sp.showModal(
      '<div class="modal"><div class="modal-titlebar"><button class="modal-close">&times;</button><h3>编辑优惠码 · ' + sp.esc(c.code) + '</h3></div>' +
      '<div class="field"><label>类型</label><select id="ce-type" class="form-control"><option value="percent"' + (c.type === "percent" ? " selected" : "") + '>折扣%</option><option value="fixed"' + (c.type === "fixed" ? " selected" : "") + '>立减¥</option></select></div>' +
      '<div class="field"><label>值</label><input id="ce-value" class="form-control" type="number" value="' + c.value + '" /></div>' +
      '<div class="field"><label>满额(0=不限)</label><input id="ce-min" class="form-control" type="number" value="' + (c.min_amount || 0) + '" /></div>' +
      '<div class="field"><label>总次数(0=不限)</label><input id="ce-limit" class="form-control" type="number" value="' + (c.limit_times || 0) + '" /></div>' +
      '<div class="field"><label>每人限</label><input id="ce-per" class="form-control" type="number" value="' + (c.per_user || 1) + '" /></div>' +
      '<div class="field"><label>限定套餐ID(逗号分隔, 留空=全部)</label><input id="ce-plans" class="form-control" value="' + sp.esc(c.plan_ids || "") + '" /></div>' +
      '<div class="field"><label>有效期至(留空=永久)</label><input id="ce-expire" class="form-control" type="date" value="' + dateVal + '" /></div>' +
      '<label class="checkbox-wrap" style="margin-top:6px"><input type="checkbox" id="ce-status"' + ((c.status === 1 || c.status === true) ? " checked" : "") + ' /> 启用</label>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-ce-cancel>取消</button><button class="btn btn-primary" id="ce-save">保存</button></div></div>'
    );
    var cancel = document.querySelector(".modal-overlay.open [data-ce-cancel]");
    if (cancel) cancel.addEventListener("click", function () { sp.closeModal(); });
    var save = document.getElementById("ce-save");
    if (save) save.addEventListener("click", function () {
      var expireVal = document.getElementById("ce-expire").value;
      var body = {
        type: document.getElementById("ce-type").value,
        value: parseFloat(document.getElementById("ce-value").value),
        min_amount: parseFloat(document.getElementById("ce-min").value) || 0,
        limit_times: parseInt(document.getElementById("ce-limit").value, 10) || 0,
        per_user: parseInt(document.getElementById("ce-per").value, 10),
        plan_ids: document.getElementById("ce-plans").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean).join(","),
        expired_at: expireVal ? Math.floor(new Date(expireVal + "T23:59:59").getTime() / 1000) : null,
        status: document.getElementById("ce-status").checked ? 1 : 0,
      };
      if (!(body.value > 0)) return sp.toast("请填写优惠值", "error");
      api.adminUpdateCoupon(c.id, body)
        .then(function () { sp.toast("已保存", "success"); sp.closeModal(); pageCoupons("/coupons", {}, render); })
        .catch(function (e) { sp.toast(e.msg || "保存失败", "error"); });
    });
  }

  // ============ 页面: 卡密管理 ============
  var cardPage = 1;
  function pageCards(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    var st = qs.status || "";
    api.adminCards(cardPage, 20, st)
      .then(function (res) {
        var d = res.data || { list: [], total: 0, limit: 20, stat: { total: 0, unused: 0, used: 0 } };
        var rows = d.list.map(function (c) {
          return '<tr>' +
            '<td>' + c.id + '</td>' +
            '<td><code title="点击复制">' + sp.esc(c.code) + '</code></td>' +
            '<td>¥' + c.amount + '</td>' +
            '<td>' + sp.badge(c.status) + '</td>' +
            '<td>' + sp.esc(c.used_by_email || "-") + '</td>' +
            '<td>' + sp.esc(c.batch || "-") + '</td>' +
            '<td>' + sp.timeAgo(c.created_at) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-card-del="' + c.id + '">作废</button></td>' +
            '</tr>';
        }).join("");
        render(
          header("卡密管理", "总额度卡 · 可批量生成/导出/作废") +
          statCards([
            { ico: "🎟️", val: d.stat.total, label: "卡密总数" },
            { ico: "✅", val: d.stat.unused, label: "未使用" },
            { ico: "♻️", val: d.stat.used, label: "已使用" },
          ]) +
          card("批量生成",
            '<div class="form-row">' +
            '<input class="form-control" id="cd-count" placeholder="数量" type="number" value="50" style="width:100px" />' +
            '<input class="form-control" id="cd-amount" placeholder="面值(¥)" type="number" value="10" style="width:100px" />' +
            '<input class="form-control" id="cd-prefix" placeholder="前缀" value="JC" style="width:80px" />' +
            '<input class="form-control" id="cd-batch" placeholder="批次(留空=今日)" style="width:160px" />' +
            '<button class="btn btn-primary" id="cd-gen">生成</button>' +
            '<button class="btn btn-ghost" id="cd-export">导出未使用</button>' +
            '</div>' +
            '<div id="cd-out" style="margin-top:10px"></div>'
          ) +
          card("卡密列表",
            '<div class="form-row" style="margin-bottom:10px"><select class="form-control" id="cd-status" style="width:150px">' +
            '<option value="">全部状态</option><option value="unused"' + (st === "unused" ? " selected" : "") + '>未使用</option>' +
            '<option value="used"' + (st === "used" ? " selected" : "") + '>已使用</option></select>' +
            '<button class="btn btn-primary" id="cd-filter">筛选</button></div>' +
            table(["ID", "卡密", "面值", "状态", "使用者", "批次", "时间", "操作"], rows) +
            '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
            (cardPage > 1 ? '<button class="btn btn-ghost btn-sm" id="cd-prev">上一页</button>' : '') +
            '<span style="padding:8px">' + cardPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
            (d.list.length ? '<button class="btn btn-ghost btn-sm" id="cd-next">下一页</button>' : '') +
            '</div>'
          )
        );
        document.querySelectorAll("code[title]").forEach(function (el) {
          el.addEventListener("click", function () {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent);
            sp.toast("已复制", "success");
          });
        });
        document.querySelectorAll("[data-card-del]").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = parseInt(b.getAttribute("data-card-del"), 10);
            sp.confirm({
              title: "作废卡密",
              text: "作废后将无法使用，确认作废？",
              okText: "确认作废", danger: true,
              onOk: function () {
                api.adminDeleteCard(id)
                  .then(function () { sp.toast("已作废", "success"); pageCards("/cards", { status: st }, render); })
                  .catch(function (e) { sp.toast(e.msg || "操作失败", "error"); });
              },
            });
          });
        });
        var gen = document.getElementById("cd-gen");
        if (gen) gen.addEventListener("click", function () {
          var body = {
            count: parseInt(document.getElementById("cd-count").value, 10) || 50,
            amount: parseFloat(document.getElementById("cd-amount").value),
            prefix: document.getElementById("cd-prefix").value.trim() || "JC",
            batch: document.getElementById("cd-batch").value.trim(),
          };
          if (!(body.amount > 0)) return sp.toast("请填写有效面值", "error");
          gen.classList.add("loading"); gen.disabled = true;
          api.adminBatchCards(body)
            .then(function (r) {
              var out = document.getElementById("cd-out");
              if (out) out.innerHTML = '<div class="tip">' + sp.esc(r.msg || "生成完成") + '</div>' +
                '<textarea class="form-control" rows="6" style="font-family:monospace">' + ((r.data && r.data.codes) || []).join("\n") + '</textarea>';
              sp.toast("生成完成", "success");
              pageCards("/cards", { status: st }, render);
            })
            .catch(function (e) { sp.toast(e.msg || "生成失败", "error"); })
            .finally(function () { gen.classList.remove("loading"); gen.disabled = false; });
        });
        var ex = document.getElementById("cd-export");
        if (ex) ex.addEventListener("click", function () {
          fetch(api.base + "/api/cards/admin/export", { headers: { Authorization: "Bearer " + api.getToken() } })
            .then(function (r) { return r.text(); })
            .then(function (text) {
              var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              var a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "card_keys.txt";
              a.click();
              URL.revokeObjectURL(a.href);
              sp.toast("已导出", "success");
            })
            .catch(function () { sp.toast("导出失败", "error"); });
        });
        var f = document.getElementById("cd-filter");
        if (f) f.addEventListener("click", function () { cardPage = 1; pageCards("/cards", { status: document.getElementById("cd-status").value }, render); });
        var prev = document.getElementById("cd-prev");
        var next = document.getElementById("cd-next");
        if (prev) prev.addEventListener("click", function () { cardPage--; pageCards("/cards", { status: st }, render); });
        if (next) next.addEventListener("click", function () { cardPage++; pageCards("/cards", { status: st }, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 支付流水 ============
  var payPage = 1;
  function pagePayments(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    var provider = qs.provider || "";
    var pstatus = qs.pstatus || "";
    api.adminPayments(payPage, 50, provider, pstatus)
      .then(function (res) {
        var d = res.data || { list: [], total: 0, limit: 50 };
        var rows = d.list.map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.order_no) + '</td>' +
            '<td>' + sp.esc(it.provider) + '</td>' +
            '<td>¥' + it.amount + '</td>' +
            '<td>' + sp.badge(it.status) + '</td>' +
            '<td>' + (it.order_status ? sp.badge(it.order_status) : "-") + '</td>' +
            '<td>' + sp.badge(it.order_type) + '</td>' +
            '<td>' + sp.esc(it.email || "-") + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("支付流水", "支付渠道回调原始记录 · 用于对账与审计") +
          '<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="card-title">筛选</div></div>' +
          '<div class="form-row">' +
          '<input class="form-control" id="pf-provider" placeholder="渠道(epay/usdt/balance/alipay)" value="' + sp.esc(provider) + '" style="width:200px" />' +
          '<select class="form-control" id="pf-status" style="width:150px">' +
          '<option value="">全部状态</option><option value="success"' + (pstatus === "success" ? " selected" : "") + '>success</option>' +
          '<option value="pending"' + (pstatus === "pending" ? " selected" : "") + '>pending</option>' +
          '<option value="failed"' + (pstatus === "failed" ? " selected" : "") + '>failed</option></select>' +
          '<button class="btn btn-primary" id="pf-search">筛选</button></div></div>' +
          table(["ID", "订单号", "渠道", "金额", "支付状态", "订单状态", "类型", "用户", "时间"], rows) +
          '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
          (payPage > 1 ? '<button class="btn btn-ghost btn-sm" id="pf-prev">上一页</button>' : '') +
          '<span style="padding:8px">' + payPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
          (d.list.length ? '<button class="btn btn-ghost btn-sm" id="pf-next">下一页</button>' : '') +
          '</div>'
        );
        var s = document.getElementById("pf-search");
        if (s) s.addEventListener("click", function () { payPage = 1; pagePayments("/payments", { provider: document.getElementById("pf-provider").value.trim(), pstatus: document.getElementById("pf-status").value }, render); });
        var prev = document.getElementById("pf-prev");
        var next = document.getElementById("pf-next");
        if (prev) prev.addEventListener("click", function () { payPage--; pagePayments("/payments", { provider: provider, pstatus: pstatus }, render); });
        if (next) next.addEventListener("click", function () { payPage++; pagePayments("/payments", { provider: provider, pstatus: pstatus }, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 钱包流水 ============
  var walletPage = 1;
  function pageWalletRecords(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminWalletAll(walletPage, 50)
      .then(function (res) {
        var d = res.data || { list: [], total: 0, limit: 50 };
        var rows = (d.list || []).map(function (it) {
          return '<tr>' +
            '<td>' + it.id + '</td>' +
            '<td>' + sp.esc(it.email || it.user_id) + '</td>' +
            '<td><span class="badge ' + (it.amount < 0 ? 'badge-danger' : 'badge-success') + '">' + (it.amount < 0 ? "-" : "+") + '¥' + it.amount + '</span></td>' +
            '<td>' + sp.esc(it.type) + '</td>' +
            '<td>' + sp.esc(it.remark || "-") + '</td>' +
            '<td>' + sp.esc(it.balance_after != null ? it.balance_after : "-") + '</td>' +
            '<td>' + sp.timeAgo(it.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("钱包流水", "充值与赠送、奖励变动明细") +
          card("流水列表",
            table(["ID", "用户", "金额", "类型", "备注", "变动后余额", "时间"], rows) +
            '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
            (walletPage > 1 ? '<button class="btn btn-ghost btn-sm" id="wp-prev">上一页</button>' : '') +
            '<span style="padding:8px">' + walletPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
            (d.list.length ? '<button class="btn btn-ghost btn-sm" id="wp-next">下一页</button>' : '') +
            '</div>'
          )
        );
        var prev = document.getElementById("wp-prev");
        var next = document.getElementById("wp-next");
        if (prev) prev.addEventListener("click", function () { walletPage--; pageWalletRecords("/wallet-records", {}, render); });
        if (next) next.addEventListener("click", function () { walletPage++; pageWalletRecords("/wallet-records", {}, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ============ 页面: 返佣明细 ============
  var commPage = 1;
  function pageCommissions(path, qs, render) {
    render(sp.loading());
    if (!isAdmin()) { sp.navigate("/"); return; }
    api.adminCommissions(commPage, 50)
      .then(function (res) {
        var d = res.data || { list: [], total: 0, limit: 50 };
        var totalAmt = (d.list || []).reduce(function (s, c) { return s + (c.amount || 0); }, 0);
        var rows = (d.list || []).map(function (c) {
          return '<tr>' +
            '<td>' + c.id + '</td>' +
            '<td>' + sp.esc(c.user_email || c.user_id) + '</td>' +
            '<td>¥' + c.amount + '</td>' +
            '<td>' + sp.esc(c.from_email || c.from_user_id) + '</td>' +
            '<td>' + sp.esc(c.order_no || "-") + '</td>' +
            '<td>' + sp.badge(c.status) + '</td>' +
            '<td>' + sp.timeAgo(c.created_at) + '</td>' +
            '</tr>';
        }).join("");
        render(
          header("返佣明细", "邀请人获得佣金的发放记录") +
          card("佣金记录",
            '<div class="tip" style="margin-bottom:10px">本页合计 ¥' + totalAmt + '（每页 50 条）</div>' +
            table(["ID", "邀请人", "佣金", "被邀请人", "来源订单", "状态", "时间"], rows) +
            '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
            (commPage > 1 ? '<button class="btn btn-ghost btn-sm" id="cp-prev">上一页</button>' : '') +
            '<span style="padding:8px">' + commPage + ' / ' + Math.ceil(d.total / d.limit) + '</span>' +
            (d.list.length ? '<button class="btn btn-ghost btn-sm" id="cp-next">下一页</button>' : '') +
            '</div>'
          )
        );
        var prev = document.getElementById("cp-prev");
        var next = document.getElementById("cp-next");
        if (prev) prev.addEventListener("click", function () { commPage--; pageCommissions("/commissions", {}, render); });
        if (next) next.addEventListener("click", function () { commPage++; pageCommissions("/commissions", {}, render); });
      })
      .catch(function () { render(sp.error("数据加载失败，请检查网络后重试", function () { sp.onHashChange(); })); });
  }

  // ---------- 注册页面 ----------
  function registerPages() {
    sp.on("/stats", pageStats);
    sp.on("/users", pageUsers);
    sp.on("/users/detail", pageUserDetail);
    sp.on("/orders", pageOrders);
    sp.on("/plans", pagePlans);
    sp.on("/notices", pageNotices);
    sp.on("/settings", pageSettings);
    sp.on("/site", pageSite);
    sp.on("/nodes-mgmt", pageNodesMgmt);
    sp.on("/tickets", pageTickets);
    sp.on("/tickets/detail", pageTicketDetail);
    sp.on("/coupons", pageCoupons);
    sp.on("/cards", pageCards);
    sp.on("/finance/payments", pagePayments);
    sp.on("/finance/wallet", pageWalletRecords);
    sp.on("/finance/commissions", pageCommissions);
    sp.on("/perms", pagePerms);
  }

  // ---------- 认证守卫 ----------
  sp.guard(function (path) {
    if (path === "/" || path === "/dashboard" || path === "/traffic" || path === "/wallet" || path === "/invite") return true;
    // admin pages require login + admin
    if (!isLogged()) { sp.toast("请先登录", "error"); sp.navigate("/"); return false; }
    if (!isAdmin()) { sp.toast("无管理员权限", "error"); sp.navigate("/dashboard"); return false; }
    return true;
  });

  if (window.__SP__) {
    registerPages();
  }
})();
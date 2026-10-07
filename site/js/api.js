// ============================================================
//  机场落地页 · 后端 API 客户端
//  依赖后端: 见 ../.. /jichang/app (默认 http://localhost:3000)
//  通过 window.SITE.API_BASE 覆盖
// ============================================================
(function () {
  "use strict";

  const base = (window.SITE && window.SITE.API_BASE) || "http://localhost:3000";
  const TOKEN_KEY = "jc_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    const resp = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await resp.json();
    } catch (e) {
      /* ignore */
    }
    if (!resp.ok) {
      const err = new Error((json && json.msg) || ("请求失败 " + resp.status));
      err.status = resp.status;
      err.code = json && json.code;
      err.json = json;
      throw err;
    }
    return json;
  }

  const api = {
    base,
    getToken,
    setToken,
    isLoggedIn: () => !!getToken(),
    // auth
    register: (d) => request("POST", "/api/auth/register", d),
    login: (d) => request("POST", "/api/auth/login", d),
    me: () => request("GET", "/api/auth/me"),
    forgotPassword: (d) => request("POST", "/api/auth/forgot-password", d),
    resetPassword: (d) => request("POST", "/api/auth/reset-password", d),
    verifyEmail: (token) => request("GET", "/api/auth/verify-email?token=" + encodeURIComponent(token)),
    // shop
    plans: () => request("GET", "/api/public/plans"),
    publicNotices: () => request("GET", "/api/public/notices"),
    publicNodes: () => request("GET", "/api/public/nodes"),
    channels: () => request("GET", "/api/orders/channels"),
    createOrder: (d) => request("POST", "/api/orders/create", d),
    orderStatus: (no) => request("GET", "/api/orders/status/" + no),
    userOverview: () => request("GET", "/api/user/overview"),
    userSubscription: () => request("GET", "/api/user/subscription"),
    // user dashboard
    userTraffic: () => request("GET", "/api/user/traffic"),
    userWallet: (page, limit) => request("GET", "/api/user/wallet?page=" + (page||1) + "&limit=" + (limit||20)),
    walletRecent: () => request("GET", "/api/user/wallet?page=1&limit=5"),
    userInvite: () => request("GET", "/api/user/invite"),
    ordersList: () => request("GET", "/api/orders/list"),
    userUpdateProfile: (d) => request("PUT", "/api/user/profile", d),
    userChangePassword: (d) => request("PUT", "/api/user/password", d),
    // notifications (user center)
    userNotifications: (page, limit) => request("GET", "/api/user/notifications?page=" + (page||1) + "&limit=" + (limit||20)),
    notificationsRead: (d) => request("POST", "/api/user/notifications/read", d),
    myCommissions: (page, limit) => request("GET", "/api/user/commissions?page=" + (page||1) + "&limit=" + (limit||20)),
    // tickets
    ticketsList: () => request("GET", "/api/tickets/list"),
    ticketDetail: (id) => request("GET", "/api/tickets/" + id),
    ticketCreate: (d) => request("POST", "/api/tickets/create", d),
    ticketReply: (id, d) => request("POST", "/api/tickets/" + id + "/reply", d),
    ticketClose: (id) => request("POST", "/api/tickets/" + id + "/close", d),
    // coupons (user)
    couponValidate: (d) => request("POST", "/api/coupons/validate", d),
    couponActives: () => request("GET", "/api/coupons/active"),
    // cards (user)
    cardInfo: () => request("GET", "/api/cards/info"),
    cardRedeem: (d) => request("POST", "/api/cards/redeem", d),
    // admin: nodes
    adminNodes: () => request("GET", "/api/nodes"),
    adminCreateNode: (d) => request("POST", "/api/nodes", d),
    adminUpdateNode: (id, d) => request("PUT", "/api/nodes/" + id, d),
    adminDeleteNode: (id) => request("DELETE", "/api/nodes/" + id),
    adminTrafficLogs: (p, l, uid) => request("GET", "/api/nodes/traffic?page=" + (p||1) + "&limit=" + (l||20) + (uid ? "&user_id=" + uid : "")),
    adminRecordTraffic: (d) => request("POST", "/api/nodes/traffic", d),
    // admin: tickets
    adminTickets: (p, l, st) => request("GET", "/api/tickets/admin?page=" + (p||1) + "&limit=" + (l||20) + (st ? "&status=" + st : "")),
    adminTicketDetail: (id) => request("GET", "/api/tickets/admin/" + id),
    adminTicketReply: (id, d) => request("POST", "/api/tickets/admin/" + id + "/reply", d),
    adminTicketStatus: (id, d) => request("POST", "/api/tickets/admin/" + id + "/status", d),
    // admin: coupons
    adminCoupons: () => request("GET", "/api/coupons/admin"),
    adminCreateCoupon: (d) => request("POST", "/api/coupons/admin", d),
    adminBatchCoupons: (d) => request("POST", "/api/coupons/admin/batch", d),
    adminUpdateCoupon: (id, d) => request("PUT", "/api/coupons/admin/" + id, d),
    adminDeleteCoupon: (id) => request("DELETE", "/api/coupons/admin/" + id),
    // admin: cards
    adminCards: (p, l, st, batch) => request("GET", "/api/cards/admin?page=" + (p||1) + "&limit=" + (l||20) + (st ? "&status=" + st : "") + (batch ? "&batch=" + encodeURIComponent(batch) : "")),
    adminBatchCards: (d) => request("POST", "/api/cards/admin/batch", d),
    adminDeleteCard: (id) => request("DELETE", "/api/cards/admin/" + id),
    adminCardsExport: (batch) => request("GET", "/api/cards/admin/export" + (batch ? "?batch=" + encodeURIComponent(batch) : "")),
    // admin: finance
    adminTrend: (days) => request("GET", "/api/admin/stats/trend?days=" + (days || 7)),
    adminPayments: (p, l, provider, status) => request("GET", "/api/admin/payments?page=" + (p||1) + "&limit=" + (l||50) + (provider ? "&provider=" + provider : "") + (status ? "&status=" + status : "")),
    adminWalletAll: (p, l) => request("GET", "/api/admin/wallet?page=" + (p||1) + "&limit=" + (l||50)),
    adminCommissions: (p, l) => request("GET", "/api/admin/commissions?page=" + (p||1) + "&limit=" + (l||50)),
    // admin
    adminStats: () => request("GET", "/api/admin/stats"),
    adminUsers: (p, l, kw) => request("GET", "/api/admin/users?page=" + (p||1) + "&limit=" + (l||20) + "&keyword=" + encodeURIComponent(kw||"")),
    adminUser: (id) => request("GET", "/api/admin/users/" + id),
    adminUpdateUser: (id, d) => request("PUT", "/api/admin/users/" + id, d),
    adminWalletUser: (id, d) => request("POST", "/api/admin/users/" + id + "/wallet", d),
    adminOrders: (p, l, st) => request("GET", "/api/admin/orders?page=" + (p||1) + "&limit=" + (l||20) + (st ? "&status=" + st : "")),
    adminOrder: (id, d) => request("PUT", "/api/admin/orders/" + id, d),
    adminPlans: () => request("GET", "/api/admin/plans"),
    adminCreatePlan: (d) => request("POST", "/api/plans", d),
    adminUpdatePlan: (id, d) => request("PUT", "/api/plans/" + id, d),
    adminDeletePlan: (id) => request("DELETE", "/api/plans/" + id),
    adminNotices: () => request("GET", "/api/admin/notices"),
    adminCreateNotice: (d) => request("POST", "/api/admin/notices", d),
    adminUpdateNotice: (id, d) => request("PUT", "/api/admin/notices/" + id, d),
    adminDeleteNotice: (id) => request("DELETE", "/api/admin/notices/" + id),
    // settings
    settingsPublic: () => request("GET", "/api/settings/public"),
    settingsAdmin: () => request("GET", "/api/settings/admin"),
    settingsSave: (d) => request("PUT", "/api/settings/admin", d),
    settingsReset: (key) => request("DELETE", "/api/settings/admin/" + key),
    // perms
    permsCatalog: () => request("GET", "/api/settings/admin/perms/catalog"),
    permsOf: (uid) => request("GET", "/api/settings/admin/perms/" + uid),
    permsSet: (uid, d) => request("PUT", "/api/settings/admin/perms/" + uid, d),
  };

  window.JCAPI = api;
})();

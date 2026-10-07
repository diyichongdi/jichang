// ============================================================
//  统一主题模块 (落地页 / 用户中心 / 管理后台共用)
//  主题集: dark / light ; system = 跟随系统(自动映射到 dark/light)
//  存储键: jc_theme (值为 dark | light | system)
// ============================================================
(function () {
  "use strict";
  const KEY = "jc_theme";
  const SYSTEM_DEFAULT = "dark";
  const THEMES = [
    { id: "dark", label: "深色" },
    { id: "light", label: "浅色" },
    { id: "system", label: "自动" },
  ];

  // 系统偏好实际映射到的主题
  function systemResolved() {
    try {
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    } catch (e) {
      return SYSTEM_DEFAULT;
    }
  }

  // 计算最终应用到 <html> 的主题(解决 system 引用)
  function resolve(pref) {
    if (pref === "system") return systemResolved();
    if (pref === "light" || pref === "dark") return pref;
    return SYSTEM_DEFAULT;
  }

  // 应用主题: 设置 localStorage + <html data-theme>
  function apply(pref) {
    pref = pref || localStorage.getItem(KEY) || SYSTEM_DEFAULT;
    const el = document.documentElement;
    el.setAttribute("data-theme", resolve(pref));
    // 官方主题标记 (供 [data-theme="light"] 等正常生效)
    localStorage.setItem(KEY, pref);
    // 通知切换器同步高亮
    document.dispatchEvent(new CustomEvent("jc:theme", { detail: pref }));
    return pref;
  }

  // 初始化: 加载偏好并监听系统主题变化(跟随系统时实时刷新)
  function init(sel) {
    apply();
    const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    const onChange = function () {
      const pref = localStorage.getItem(KEY) || SYSTEM_DEFAULT;
      if (pref === "system") apply("system");
    };
    if (media && media.addEventListener) media.addEventListener("change", onChange);
    else if (media) media.addListener(onChange);

    const root = document.querySelector(sel || "#theme-switch");
    if (root) {
      root.innerHTML = ""; // 清空旧按钮
      THEMES.forEach(function (t) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = t.label;
        b.dataset.theme = t.id;
        b.setAttribute("aria-label", t.label);
        b.addEventListener("click", function () { apply(t.id); });
        root.appendChild(b);
      });
      function sync() {
        const pref = localStorage.getItem(KEY) || SYSTEM_DEFAULT;
        root.querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("active", b.dataset.theme === pref);
        });
      }
      document.addEventListener("jc:theme", sync);
      sync();
    }
    return { apply: apply, resolve: resolve };
  }

  window.SiteTheme = { init: init, apply: apply, resolve: resolve, THEMES: THEMES };
})();

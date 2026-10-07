// ============================================================
//  后台调度器
//  1) 套餐到期提醒  (expire_remind_sent)
//  2) 余额/流量用量提醒 (traffic_remind_sent)
//  发送按 notify.method (mail/tg)，同时落库站内通知
// ============================================================
const db = require("../db");
const config = require("../config");
const sendReminders = require("../services/notify.service").sendReminders;

let timer = null;
let running = false;

function schedule() {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    Promise.resolve(sendReminders(db, config.env === "test" ? false : true))
      .catch((e) => console.error("[scheduler]", e))
      .finally(() => (running = false));
  }, 60 * 1000);
}

function start() {
  if (config.env === "test") return; // 测试环境不跑调度
  schedule();
  console.log("[scheduler] 已启动 (到期/用量提醒)");
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop };
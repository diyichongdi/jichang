// ============================================================
//  数据库层 (sql.js 驱动)
//  - 纯 JS + WASM，无需本地编译，Windows/Linux 均可直接跑
//  - 自动持久化到本地文件 (data/app.db)，写入后落盘
//  - 对外暴露 prepared 查询接口；生产可换 MySQL/Postgres 驱动
//    (见 docs/DATABASE.md，本模块保持同一接口即可)
// ============================================================
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const { nanoid } = require("nanoid");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "app.db");

let db = null;          // sql.js Database 实例
let ready = null;
let inTx = false;       // 是否在事务内(避免 persist/export 破坏事务)
let lastRowId = 0;      // 最近一次 INSERT 生成的 rowid

/** sql.js 的 Database 实例，需异步初始化后使用 */
async function init() {
  if (ready) return ready;
  ready = (async () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const SQL = await initSqlJs({
      // 关键：让 sql.js 找到 wasm 文件
      locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file),
    });
    if (fs.existsSync(DB_FILE)) {
      db = new SQL.Database(fs.readFileSync(DB_FILE));
    } else {
      db = new SQL.Database();
    }
    // 开启外键
    db.run("PRAGMA foreign_keys = ON");
    // 应用 schema
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.run(schema);
    migrate();
    persist();
    return true;
  })();
  return ready;
}

/** 检查字段是否存在(用于迁移) */
function columnExists(table, col) {
  const cols = all("PRAGMA table_info(" + table + ")");
  return cols.some((c) => c.name === col);
}

/** 轻量迁移：给现有表补字段(Phase1/Phase2 演进) */
function migrate() {
  const alters = {
    plans: [
      ["price_q", "REAL"],
      ["price_y", "REAL"],
      ["desc", "TEXT"],
      ["featured", "INTEGER NOT NULL DEFAULT 0"],
      ["features", "TEXT"], // 卖点列表 JSON 数组字符串
    ],
    users: [
      ["expire_remind_sent", "INTEGER NOT NULL DEFAULT 0"],
      ["traffic_remind_sent", "INTEGER NOT NULL DEFAULT 0"],
    ],
    notices: [
      ["pinned", "INTEGER NOT NULL DEFAULT 0"],
      ["on_sale", "INTEGER NOT NULL DEFAULT 1"],
    ],
  };
  for (const [table, cols] of Object.entries(alters)) {
    if (!tableExists(table)) continue;
    for (const [col, type] of cols) {
      if (!columnExists(table, col)) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }
  }
}

/** 把内存库落盘 */
function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

/** 运行带参数语句(写操作)；返回 INSERT 生成的 rowid(无则0) */
function run(sql, params = []) {
  db.run(sql, params);
  // 记录 INSERT 生成的 rowid，须在 persist()/export() 之前读取
  if (/^\s*INSERT/i.test(sql)) {
    const s = db.prepare("SELECT last_insert_rowid() AS id");
    if (s.step()) lastRowId = s.getAsObject().id;
    s.free();
  }
  // 事务内不落盘(export 会打断事务)，由最外层 transaction 统一落盘
  if (!inTx) persist();
  return lastRowId;
}

/** 查询单行 */
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

/** 查询多行 */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

/** 事务 */
function transaction(fn) {
  if (inTx) return fn(); // 嵌套事务，合并到最外层
  inTx = true;
  db.run("BEGIN");
  try {
    const r = fn();
    db.run("COMMIT");
    persist();
    return r;
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch (e2) {
      console.error("[db] rollback 失败(可能已自动提交)", e2);
    }
    throw e;
  } finally {
    inTx = false;
    lastRowId = 0;
  }
}

/** 最近插入 ID（在事务内调用方先 run 后取此值） */
function lastInsertId() {
  return lastRowId;
}

function genId() {
  return nanoid(16);
}

/** 是否存在表/字段检查(用于迁移) */
function tableExists(name) {
  return !!get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
}

module.exports = {
  init,
  run,
  get,
  all,
  transaction,
  lastInsertId,
  genId,
  tableExists,
  persist,
  get db() {
    return db;
  },
};

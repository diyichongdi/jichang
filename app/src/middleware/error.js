// ============================================================
//  统一响应 + 错误处理
// ============================================================

/** 成功响应 */
function ok(res, data, msg = "ok") {
  return res.json({ code: 0, msg, data });
}

/** 业务错误类 */
class ApiError extends Error {
  constructor(code, msg, status = 400) {
    super(msg);
    this.code = code;
    this.status = status;
    this.msg = msg;
  }
}

/** 包装异步路由, 捕获异常统一处理 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 404 */
function notFound(req, res) {
  res.status(404).json({ code: 404, msg: "接口不存在" });
}

/** 全局错误 */
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ code: err.code, msg: err.msg });
  }
  console.error("[error]", err);
  res.status(500).json({ code: 500, msg: "服务器内部错误" });
}

module.exports = { ok, ApiError, wrap, notFound, errorHandler };

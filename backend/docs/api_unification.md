# API 统一规范（REST + SSE）

本文件描述前后端之间的统一数据合同，覆盖 REST 响应结构与 SSE 事件结构、错误处理与示例，确保最小依赖与一致化体验。

— 最重要的两条硬性要求 —

- SSE 流式通信：后端必须使用 sse_starlette.EventSourceResponse，前端使用原生 EventSource，无额外依赖。
- simple_cache：仅允许标准库 lru_cache 或 aioredis。

## 一、REST 响应合同

统一使用 ApiResponse<T> 与 ErrorResponse 两类结构：

- ApiResponse<T>
  - code: number（业务码，成功为 200 或 ErrorCode.SUCCESS）
  - message: string（简洁的状态信息）
  - data: T（数据载荷）
  - timestamp: string（ISO8601）
  - requestId?: string（请求追踪 ID，可由中间件注入）

- ErrorResponse
  - code: number（错误码，参见 ErrorCode 枚举）
  - message: string（简洁错误信息）
  - details?: string（可选详细信息）
  - timestamp: string（ISO8601）
  - requestId?: string
  - path?: string
  - method?: string

后端返回非标准结构时，前端会自动包装为标准 ApiResponse：

```json
{
  "code": 200,
  "message": "ok",
  "data": {"...": "原始返回体"},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

错误响应（HTTP 非 2xx）建议直接返回 ErrorResponse。前端会解析并抛出 ApiError。

字段命名统一采用 camelCase；后端如返回 `request_id` 将在前端被映射为 `requestId`。

## 二、SSE 事件合同

事件名统一、事件载荷必须为 JSON 字符串（后端统一 `json.dumps`；前端统一 `JSON.parse`）。关键字段采用 camelCase。

通用事件：

- connected
  - 示例载荷：
    ```json
    {"connectionId": "abc123", "pingInterval": 15, "timestamp": 1700000000.123}
    ```
- ping
  - 示例载荷：
    ```json
    {"connectionId": "abc123", "timestamp": 1700000015.456}
    ```
- error
  - 示例载荷：
    ```json
    {"code": 500, "message": "Internal error", "timestamp": "2024-01-01T00:00:00.000Z", "requestId": "req-xyz"}
    ```

领域事件（示例，按路由定义）：

- Story 生成：`step`、`append`、`complete`、`error`
- Books 导入：`parsed`、`split`、`classified`、`embedded`、`stored`、`complete`、`error`
- Workflows 执行：`connected`、`ping`（统一命名，替换历史 `heartbeat`）等领域事件

约定：

- Ping 间隔统一 15 秒（后端 `EventSourceResponse(..., ping=15)`）。
- 时间戳：推荐在事件载荷中包含 `timestamp`（数值或 ISO 字符串），用于前端显示与调试。
- 错误事件：一律使用 `event: error` + JSON 载荷（`{code, message, timestamp, requestId?}`）。

## 三、前端实现要点

- ApiClient（services/apiClient.ts）
  - 标准化所有 REST 响应为 `{code, message, data, timestamp, requestId}`。
  - 当 HTTP 非 2xx：读取响应体（JSON 或文本），构造并抛出 `ApiError`（携带 ErrorResponse）。
  - 将 `request_id` 自动映射为 `requestId`。

- SSE 客户端（services/sseService.ts）
  - 默认监听 `message` 与命名事件（`connected`、`ping`、`step`、`append`、`complete`、`error`）。
  - 对 `error` 事件做统一结构化封装：向上游传递 `{__event__: 'error', code, message, timestamp, raw}`。
  - 其余事件按原样透传，若载荷非 JSON 则以 `{raw: string}` 形式传递。

示例：

```ts
// 订阅 Workflows 流
const unsub = subscribeSSE(`/api/workflows/stream/${executionId}`, {
  onMessage: (msg) => {
    switch (msg.__event__) {
      case 'connected':
        console.log('connected', msg.executionId || msg.connectionId);
        break;
      case 'ping':
        break;
      case 'error':
        console.error('stream error', msg.code, msg.message);
        break;
      case 'complete':
        // ...
        break;
      default:
        // 领域事件
        break;
    }
  },
});
```

## 四、后端实现要点

- 使用 sse_starlette.EventSourceResponse，禁止其他 SSE 依赖。
- 事件载荷统一 `json.dumps`；命名统一 camelCase。
- 连接维持：`ping=15`；业务层可在生成器中追加自定义心跳或业务心跳。
- 错误事件：统一使用 `sse_error_event` 或服务封装函数发送 `event: error`。

## 五、错误码（示例）

错误码统一在 `shared/api/contracts.ts` 的 `ErrorCode` 枚举中维护，常见如：

- 200 SUCCESS
- 400 INVALID_REQUEST
- 401 UNAUTHORIZED
- 403 FORBIDDEN
- 404 NOT_FOUND
- 429 RATE_LIMITED
- 500 INTERNAL_ERROR

## 六、路由示例与当前状态

- /api/workflows/stream/{executionId}
  - 已统一：事件名 `connected`、`ping`；载荷 JSON；`executionId` 使用 camelCase；`ping=15`。
- /api/books/ingest/stream
  - 已统一：最终事件 `complete`（替换历史 `done`）；载荷 JSON；支持 `modelId`；`ping=15`。
- /api/sse/connect
  - 已统一：`connected` 事件载荷使用 `connectionId`、`pingInterval`；`ping` 载荷携带 `connectionId`。
- /api/story/generate/stream
  - 坚持使用 `step`、`append`、`complete`、`error`；载荷 JSON；`ping=15`（若需要）。

## 七、最佳实践与排错

- 保持事件数量适中，避免过度频繁小事件造成前端压力。
- 在错误事件中包含 `requestId` 便于日志关联。
- 如前端出现非 JSON 载荷解析失败，确保后端使用 `json.dumps` 并指定 `content-type: text/event-stream`。

## 八、规范演进

如需新增领域事件或扩展合同，请在本文件补充并在 PR 中进行评审。涉及安全/依赖/架构的更改需负责人批准。


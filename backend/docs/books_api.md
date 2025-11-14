# Books API 文档

本模块提供图书文件的上传与流式导入(解析/拆分/分类/向量化/入库)能力,遵循项目最小依赖与统一错误结构规范。

## 上传接口

- 方法: POST
- 路径: `/api/books/upload`
- Content-Type: `multipart/form-data`
- 字段: `file`(支持: .pdf, .epub, .txt, .md, .docx)

环境变量:
- `UPLOAD_DIR`: 上传目录(默认 `./uploads`)
- `MAX_FILE_SIZE`: 最大文件大小(字节,默认 `10485760` 即 10MB)

成功响应:
```
{
  "fileId": "<uuid>",
  "filename": "原始文件名",
  "path": "服务器保存路径",
  "size": 12345
}
```

错误响应(统一为 {code, message}):
- `UNSUPPORTED_TYPE`: 不支持的文件类型
- `FILE_TOO_LARGE`: 超过大小限制

示例(curl):
```
curl -F "file=@C:/path/to/book.epub" http://127.0.0.1:8001/api/books/upload
```

## 流式导入接口(SSE)

- 方法: GET
- 路径: `/api/books/ingest/stream`
- 参数:
  - `fileId`: 上传阶段返回的 `fileId`
  - `model_id`: 向量模型ID(默认 `text-embedding-3-small`)
- 返回: `text/event-stream` SSE 流
- 心跳: 由 `EventSourceResponse` 管理, `ping=15`

事件序列(典型):
- `parsed`: { path, meta }
- `split`: { count }
- `classified`: { count }
- `embedded`: { count }
- `stored`: { docId, paragraphCount }
- `done`: { docId }

错误事件(统一结构):
- 事件名: `error`
- 数据: `{ code, message }`
- 可能错误码:
  - `NOT_FOUND`: 文件不存在或尚未上传
  - `EMPTY_TEXT`: 无法从文件中提取文本
  - `NO_PARAGRAPHS`: 未能拆分得到有效段落
  - `INGEST_ERROR`: 流式导入过程中发生未捕获异常

示例(curl):
```
curl -N "http://127.0.0.1:8001/api/books/ingest/stream?fileId=<uuid>&model_id=text-embedding-3-small"
```

前端建议:
- 使用原生 `EventSource` 订阅 SSE,并处理 `error` 事件统一结构:
  - 当收到 `event: error` 时,解析 `data` 中的 `{code, message}` 显示到 UI。
- 普通 `message` 事件或自定义事件统一解析 JSON,并根据 `event` 字段进行分发。

注意:
- SSE 必须使用 `sse_starlette.EventSourceResponse`,禁止引入额外 SSE 依赖。
- 文件解析服务在 `backend/services/file_parser_service.py`,支持 PDF/EPUB/TXT/MD/DOCX,并统一输出 { text, meta }。
- 段落拆分/分类/向量化/入库流程由 `ingest/stream` 路由在服务端串联完成。


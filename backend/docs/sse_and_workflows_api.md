SSE and Workflows API

Overview
- All SSE streams now use a unified error event format: event: "error" with data: { code, message }.
- REST error responses use { code, message } and proper HTTP status codes.

Endpoints
1) GET /api/v1/sse/connect/{connection_id}
   - Opens an SSE stream.
   - Events:
     - connected: { connection_id, timestamp, status, ping_interval }
     - ping: { timestamp, connection_id }
     - error: { code, message }  // DomainError.SSE_STREAM_ERROR for stream issues

2) GET /api/v1/sse/connect
   - Opens an SSE stream with an auto-generated connection_id.
   - Same events as above.

3) POST /api/v1/sse/send/{connection_id}
   - Sends a named event to a specific connection.
   - Success: { code: 200, message: "event sent", data: { connection_id, event_type, timestamp } }
   - Errors:
     - { code: "CONNECTION_NOT_FOUND", message: "Connection <id> not found" } (HTTP 404)

4) POST /api/v1/sse/broadcast
   - Broadcasts an event to all connections, optionally excluding some.
   - Success: { code: 200, message: "broadcasted", data: { event_type, sent_count, total_connections, timestamp } }

5) GET /api/v1/sse/status
   - Returns status of the SSE service.
   - Success: { code: 200, message: "sse status", data: { active_connections, connection_ids, timestamp } }

6) DELETE /api/v1/sse/disconnect/{connection_id}
   - Disconnects a specific SSE connection.
   - Success: { code: 200, message: "disconnected", data: { connection_id, timestamp } }
   - Errors:
     - { code: "CONNECTION_NOT_FOUND", message: "Connection <id> not found" } (HTTP 404)

7) GET /api/v1/workflows/stream/{execution_id}
   - Streams workflow execution events.
   - Events:
     - connected: { execution_id, status: "connected" }
     - heartbeat: { timestamp }
     - step/append/complete/...: domain-specific events from workflow execution
     - error: { code, message }  // DomainError.WORKFLOW_ERROR for execution errors; DomainError.INTERNAL_ERROR for fatal stream errors
   - Early errors (before stream starts):
     - { code: "NOT_FOUND", message: "执行ID <id> 不存在" } (HTTP 404)

Frontend Handling Tips
- Use native EventSource.
- On onmessage:
  - Try JSON.parse(e.data); fallback to raw string if parsing fails.
  - If event name is "error" (or __event__ === "error" in your event processing utility), surface data.message and data.code to UI.
- For REST calls, expect { code, message } on errors; success responses may include data.


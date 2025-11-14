/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 统一的 SSE 客户端工具,用于订阅服务端的 Server-Sent Events.
 * @param url - SSE 端点的 URL.
 * @param handlers - 包含事件处理函数的对象.
 * @param handlers.onMessage - 处理通用 `message` 事件的回调函数.
 * @param handlers.onEvent - 处理所有事件(包括自定义事件)的回调函数.
 * @param handlers.onError - 处理错误事件的回调函数.
 * @returns 一个函数,调用该函数可以关闭 SSE 连接.
 */
export function subscribeSSE(url: string, handlers?: {
    onMessage?: (data: any) => void;
    onEvent?: (evt: MessageEvent) => void;
    onError?: (err: Event) => void;
}) {
    const es = new EventSource(url, { withCredentials: false });
    let stopped = false;

    es.onmessage = (e) => {
        if (stopped) return;
        try {
            const data = JSON.parse(e.data);
            handlers?.onMessage?.(data);
        } catch {
            handlers?.onMessage?.(e.data);
        }
        handlers?.onEvent?.(e);
    };

    es.onerror = (e) => {
        if (stopped) {
            // 已手动停止,忽略错误与重连日志
            return;
        }
        // 根据W3C规范,onerror事件在连接关闭时也会触发,这是正常行为
        // 我们需要区分真正的错误和正常的连接关闭
        
        if (es.readyState === EventSource.CLOSED) {
            // 连接已关闭,这可能是服务器主动关闭或正常结束
            console.log("SSE connection closed");
            return;
        }
        
        if (es.readyState === EventSource.CONNECTING) {
            // 连接失败或正在重连
            console.log("SSE reconnecting...");
            // 不调用错误处理器,因为这是自动重连机制
            return;
        }
        
        if (es.readyState === EventSource.OPEN) {
            // 连接打开时发生错误,这是真正的错误
            console.error("SSE Error during active connection:", e);
            handlers?.onError?.(e);
        }
    };

    // 监听常见的自定义事件,例如后端通过 EventSourceResponse 推送的 'ping'、'step'、'append'、'complete'、'error'
    // 常见的自定义事件,需与后端保持一致
    // 包含:连接确认(connected)、心跳(ping)、流程事件(step/append/complete)、错误(error)
    // 扩展：对齐后端工作流路由的事件命名，确保前端能收到与处理关键节点与流程事件
    const namedEvents = [
        'connected',
        'ping',
        'step',
        'append',
        'complete',
        'error',
        // 书籍入库与文本解析通用事件
        'parsed',
        'progress',
        'batch_error',
        // 后端 /api/v1/workflows/stream 推送的事件
        'workflow_started',
        'workflow_completed',
        'workflow_failed',
        'node_started',
        'node_completed',
        'node_failed',
    ];
    namedEvents.forEach((evtName) => {
        es.addEventListener(evtName, (evt) => {
            const msgEvt = evt as MessageEvent;
            let parsed: any = msgEvt.data;
            try {
                parsed = JSON.parse(msgEvt.data);
            } catch {
                // 保留原始字符串
            }
            handlers?.onEvent?.(msgEvt);

            // 对 error 事件做统一结构化封装
            if (evtName === 'error') {
                const code = (parsed && parsed.code) || undefined;
                const message = (parsed && parsed.message) || (typeof parsed === 'string' ? parsed : undefined);
                const timestamp = (parsed && parsed.timestamp) || undefined;
                handlers?.onMessage?.({ __event__: 'error', type: 'error', code, message, timestamp, raw: parsed });
                return;
            }

            // 其他事件正常透传，兼容现有组件中使用 data.type 的写法，补充 type 字段
            handlers?.onMessage?.({ __event__: evtName, type: evtName, ...(
                typeof parsed === 'object' && parsed !== null ? parsed : { raw: parsed }
            ) });
        });
    });

    // 返回一个清理函数,用于关闭连接
    return () => {
        stopped = true;
        es.close();
    };
}

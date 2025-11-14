// 前端 Story 服务层:统一管理智能拼接/拆书工具相关 API
// 规范:SSE 客户端使用原生 EventSource,通过 subscribeSSE 工具订阅

import { subscribeSSE } from './sseService';

function backendUrl() {
  // 优先使用环境变量配置,若未设置则回退到本地后端默认地址
  // 统一为 8000,与项目规范一致;如需切换,请通过 .env.local 的 VITE_BACKEND_URL 配置
  const base = (typeof window !== 'undefined' && (window as any).VITE_BACKEND_URL) || 'http://localhost:8000';
  const normalized = String(base).replace(/\/$/, '');
  // 轻量调试日志:帮助定位环境变量未生效导致的错误端口问题
  try { console.debug('[storyService] backendUrl =', normalized); } catch {}
  return normalized;
}

export type SSEHandlers = {
  onMessage?: (data: any) => void;
  onEvent?: (evt: MessageEvent) => void;
  onError?: (err: Event) => void;
};

// 智能拼接:流式输出
export function generateStoryStream(
  formula: string,
  prompt: string,
  handlers?: SSEHandlers
) {
  const url = `${backendUrl()}/api/v1/story/generate/stream?formula=${encodeURIComponent(
    formula
  )}&prompt=${encodeURIComponent(prompt || '')}`;
  return subscribeSSE(url, handlers);
}

// 通用 SSE 连通性测试:连接 /api/v1/sse/connect 并订阅心跳/connected 等事件
export function connectSseTest(handlers?: SSEHandlers) {
  const url = `${backendUrl()}/api/v1/sse/connect`;
  return subscribeSSE(url, handlers);
}

// 通用 SSE 事件发送:向指定连接ID发送模拟事件(step/append/complete/error 等)
export async function sendSseTestEvent(
  connectionId: string,
  eventType: string,
  eventData: any,
  eventId?: string
) {
  const url = new URL(`${backendUrl()}/api/v1/sse/send/${encodeURIComponent(connectionId)}`);
  if (eventType) url.searchParams.set('event_type', eventType);
  if (eventId) url.searchParams.set('event_id', eventId);
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 按后端FastAPI签名,仅有一个 body 参数(event_data),因此直接发送事件数据对象本身
    body: JSON.stringify(eventData)
  });
  if (!resp.ok) {
    throw new Error(`Send event failed: ${resp.status}`);
  }
  return await resp.json();
}

// 书籍文件入库(SSE):封装 /api/v1/books/ingest/stream,支持 encoding 覆盖
export function ingestBookStream(
  fileId: string,
  options?: {
    modelId?: string;
    format?: 'text' | 'markdown';
    encoding?: string | null;
  },
  handlers?: SSEHandlers
) {
  const modelId = options?.modelId || 'text-embedding-3-small';
  const format = options?.format || 'text';
  const url = new URL(`${backendUrl()}/api/v1/books/ingest/stream`);
  url.searchParams.set('fileId', fileId);
  url.searchParams.set('model_id', modelId);
  url.searchParams.set('format', format);
  if (options?.encoding && options.encoding !== 'auto') {
    url.searchParams.set('encoding', options.encoding);
  }
  return subscribeSSE(url.toString(), handlers);
}

// 书籍文件上传:封装 /api/v1/books/upload 接口,返回 fileId
export async function uploadBook(file: File): Promise<{ fileId: string; filename?: string; path?: string; size?: number; code?: number; message?: string; }>
{
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(`${backendUrl()}/api/v1/books/upload`, {
    method: 'POST',
    body: form,
  });
  let json: any;
  try {
    json = await resp.json();
  } catch {
    throw new Error(`Upload failed: invalid response (${resp.status})`);
  }
  if (!resp.ok) {
    const msg = json?.message || `Upload failed: ${resp.status}`;
    throw new Error(msg);
  }
  if (!json?.fileId) {
    throw new Error('Upload succeeded but fileId missing');
  }
  return json;
}

// 拆书入库
export async function ingestStoryText(params: {
  text: string;
  bookId?: string;
  chapterIndex?: number;
  sectionIndex?: number;
  embeddingModel?: string;
}) {
  const resp = await fetch(`${backendUrl()}/api/v1/story/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await resp.json();
}



// 文件上传 + 提取 + 拆分 + 入库(三件套集成)
export async function ingestFile(params: {
  file: File;
  detected_encoding?: string | null;
  preserve_structure?: boolean;
  book_id?: string;
  chapter_index?: number;
  section_index?: number;
}) {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.detected_encoding && params.detected_encoding !== 'auto') {
    formData.append('detected_encoding', params.detected_encoding);
  }
  if (params.preserve_structure !== undefined) {
    formData.append('preserve_structure', String(params.preserve_structure));
  }
  if (params.book_id) {
    formData.append('book_id', params.book_id);
  }
  if (params.chapter_index !== undefined) {
    formData.append('chapter_index', String(params.chapter_index));
  }
  if (params.section_index !== undefined) {
    formData.append('section_index', String(params.section_index));
  }
  
  const resp = await fetch(`${backendUrl()}/api/v1/story/ingest-file`, {
    method: 'POST',
    body: formData,
  });
  return await resp.json();
}

// 公式 CRUD
export async function upsertFormula(params: {
  id?: number | string;
  name: string;
  expression: string;
  category?: string;
  description?: string;
  parameters?: Record<string, any>;
}) {
  const resp = await fetch(`${backendUrl()}/api/v1/story/formulas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await resp.json();
}

export async function listFormulas(category?: string) {
  const url = new URL(`${backendUrl()}/api/v1/story/formulas`);
  if (category) url.searchParams.set('category', category);
  const resp = await fetch(url.toString());
  return await resp.json();
}

export async function getStoryCategories() {
  const resp = await fetch(`${backendUrl()}/api/v1/story/categories`);
  return await resp.json();
}

// 用户反馈提交
export async function submitSplicingFeedback(params: {
  splicingId: string;
  paragraphIds: string[];
  query: string;
  feedbackType: string;
  comment?: string;
}) {
  const resp = await fetch(`${backendUrl()}/api/v1/story/splicing/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await resp.json();
}


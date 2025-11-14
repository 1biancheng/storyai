/**
 * 段落处理服务 - 前端API调用
 */

const API_BASE_URL = 'http://localhost:8000';

export interface SplitConfig {
  method: 'chapter' | 'paragraph' | 'wordCount';
  min_length: number;
  max_length: number;
  preserve_structure?: boolean;
  clean_mode?: 'standard' | 'strict';
}

export interface ParagraphMeta {
  chapter?: string;
  is_dialogue?: boolean;
  semantic_tags?: string[];
  position?: number;
  cleaned?: boolean;
  original_line_count?: number;
  completeness_score?: number;
  cleaning_operations?: string[];
}

export interface Paragraph {
  index: number;
  content: string;
  length_bytes: number;
  length_chars: number;
  length_chinese: number;
  meta: ParagraphMeta;
}

export interface SplitParagraphsRequest {
  text: string;
  config: SplitConfig;
  metadata?: {
    file_id?: string;
    book_id?: string;
  };
}

export interface SplitParagraphsResponse {
  code: number;
  message: string;
  data: {
    paragraphs: Paragraph[];
    statistics: {
      total_count: number;
      avg_length_bytes: number;
      avg_length_chars: number;
      total_bytes: number;
      total_chars: number;
      total_chinese: number;
      min_bytes: number;
      max_bytes: number;
    };
    metadata?: any;
  };
}

/**
 * 拆分段落
 */
export async function splitParagraphs(
  request: SplitParagraphsRequest
): Promise<SplitParagraphsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/paragraph/split`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * 上传文件并提取文本
 */
export async function uploadAndExtractFile(
  file: File,
  encodingHint?: string,
  preserveStructure: boolean = false
): Promise<{
  code: number;
  message: string;
  data: {
    file_id: string;
    text: string;
    encoding: string;
    confidence: number;
    method: string;
    file_hash: string;
  };
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (encodingHint) {
    formData.append('encoding_hint', encodingHint);
  }
  formData.append('preserve_structure', preserveStructure.toString());

  const response = await fetch(`${API_BASE_URL}/api/v1/file/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
/**
 * 段落处理服务 - 前端API调用
 */

const API_BASE_URL = 'http://localhost:8000';

export interface SplitConfig {
  method: 'chapter' | 'paragraph' | 'wordCount';
  min_length: number;
  max_length: number;
  preserve_structure?: boolean;
  clean_mode?: 'standard' | 'strict';
}

export interface ParagraphMeta {
  chapter?: string;
  is_dialogue?: boolean;
  semantic_tags?: string[];
  position?: number;
  cleaned?: boolean;
  original_line_count?: number;
  completeness_score?: number;
  cleaning_operations?: string[];
}

export interface Paragraph {
  index: number;
  content: string;
  length_bytes: number;
  length_chars: number;
  length_chinese: number;
  meta: ParagraphMeta;
}

export interface SplitParagraphsRequest {
  text: string;
  config: SplitConfig;
  metadata?: {
    file_id?: string;
    book_id?: string;
  };
}

export interface SplitParagraphsResponse {
  code: number;
  message: string;
  data: {
    paragraphs: Paragraph[];
    statistics: {
      total_count: number;
      avg_length_bytes: number;
      avg_length_chars: number;
      total_bytes: number;
      total_chars: number;
      total_chinese: number;
      min_bytes: number;
      max_bytes: number;
    };
    metadata?: any;
  };
}

/**
 * 拆分段落
 */
export async function splitParagraphs(
  request: SplitParagraphsRequest
): Promise<SplitParagraphsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/paragraph/split`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * 上传文件并提取文本
 */
export async function uploadAndExtractFile(
  file: File,
  encodingHint?: string,
  preserveStructure: boolean = false
): Promise<{
  code: number;
  message: string;
  data: {
    file_id: string;
    text: string;
    encoding: string;
    confidence: number;
    method: string;
    file_hash: string;
  };
}> {
  const formData = new FormData();
  formData.append('file', file);
  if (encodingHint) {
    formData.append('encoding_hint', encodingHint);
  }
  formData.append('preserve_structure', preserveStructure.toString());

  const response = await fetch(`${API_BASE_URL}/api/v1/file/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

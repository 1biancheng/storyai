// types.ts
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  uploadFiles?: UploadFile[];
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  linkedContents?: LinkedContent[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
}

export interface PromptCard {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  projectId?: string;
}

export interface Conversation {
  id: string;
  projectId: string;
  chapterId: string;
  modelId: string;
  memoryMode: 'none' | 'short' | 'long';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface LinkedContent {
  type: 'chapter' | 'promptCard' | 'knowledgeBase';
  id: string;
  title: string;
  content?: string;
  timestamp?: string;
}

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  uploadedAt: string;
}

export interface WritingTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

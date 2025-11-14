/**
 * @license
 * SPDX-License-Identifier: Apache-2.0     
 */

// This file can be used to define shared types for the application.

export enum AgentRole {
  COORDINATOR = '协调器智能体',
  DATA_ANALYZER = '数据分析智能体',        
  OUTLINE_GENERATOR = '大纲智能体',        
  GENERATOR_AGENT = '生成器智能体',        
  CHAPTER_WRITER = '章节写作智能体',       
  SECTION_WRITER = '段落写作智能体',       
  REVIEWER = '审查智能体',
  EDITOR = '编辑智能体',
  QUALITY_EVALUATOR = '质量评估智能体',    
  SUMMARY_AGENT = '摘要生成智能体',        
  SYSTEM = '系统',
}

export interface AgentLog {
  id: string;
  agent: AgentRole;
  message: string;
  data?: any;
  isLoading?: boolean;
  groundingChunks?: any[]; // New: For search grounding URLs
}

export enum WritingProcessStatus {
  IDLE = '空闲',
  ANALYZING_REQUIREMENTS = '分析需求中',   
  GENERATING_OUTLINE = '生成大纲中',       
  PREPARING_NARRATIVE = '准备叙事元素中',  
  GENERATING_CHAPTERS = '生成章节中',      
  REVIEWING = '审查内容中',
  EDITING = '编辑终稿中',
  COMPLETE = '完成',
  ERROR = '错误',
}

export interface VersionHistory {
  id: string;
  timestamp: string; // ISO string
  content: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: 'active' | 'archived' | 'deleted';
  settings: {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface ParagraphCard {
  id: string;
  content: string;
  summary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectId: string;
  sceneCards?: string[]; // IDs of associated scene cards
  characterCards?: string[]; // IDs of associated character cards
  worldCards?: string[]; // IDs of associated world cards
  formulaId?: string; // ID of the formula used to generate this paragraph
}

export interface SceneCard {
  id: string;
  title: string;
  description: string;
  characters: string[];
  location: string;
  time: string;
  mood: string;
  conflict: string;
  resolution: string;
  notes: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterCard {
  id: string;
  name: string;
  age: number;
  gender: string;
  appearance: string;
  personality: string;
  background: string;
  motivations: string;
  relationships: string[];
  arc: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldCard {
  id: string;
  name: string;
  description: string;
  geography: string;
  climate: string;
  culture: string;
  history: string;
  magicSystem: string;
  rules: string;
  notes: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaCard {
  id: string;
  name: string;
  description: string;
  pattern: string;
  variables: {
    name: string;
    type: 'string' | 'number' | 'boolean';
    isDefault?: boolean;
  }[];
  isDefault?: boolean;
}

// Workflow Editor Types
// Fix: Changed AgentType to be AgentRole for type consistency across agents.
export interface LLMModel {
  id: string;
  name: string;
  modelId: string;
  type: 'openai' | 'anthropic' | string; // Allow custom types
}

export interface Tool {
  id: string;
  name: string;
  type: 'code' | 'image_gen' | 'tts' | 'data' | 'data_analysis';
  functionBody?: string;
  llm?: LLMModel;
  dataType?: 'raw_text' | 'scene_cards' | 'local_file';
  selectedSceneIds?: string[];
  selectedCardIds?: string[];
  fileContent?: string;
  fileName?: string;
  fileMimeType?: string;
}

export interface WorkflowNode {
    id: string;
    name: string;
    type: 'agent' | 'llm' | 'tool' | 'data'; // New: Node type can be agent, LLM, tool, or data
    position: { x: number, y: number };    
    // Agent-specific properties
    agentType?: AgentRole; // Use AgentRole directly
    promptCardId?: string | null;
    // LLM-specific properties
    llm?: LLMModel;
    // Tool-specific properties
    toolType?: 'code_interpreter' | 'image_generator' | 'tts_generator';
    functionBody?: string;
    prompt?: string;
    // Data-specific properties
    dataType?: 'raw_text' | 'scene_cards' | 'local_file';
    selectedSceneIds?: string[];
    selectedCardIds?: string[];
    fileContent?: string;
    fileName?: string;
    fileMimeType?: string;
    // Keep existing linkedResourceIds if still relevant, though 'data' nodes might supersede it
    linkedResourceIds?: {
        scenes: string[];
        cards: string[];
    };
}

export interface WorkflowEdge {
    id: string;
    source: string; // source node id      
    target: string; // target node id      
}

export interface AgentWorkflow {
    id: string;
    name: string;
    nodes: WorkflowNode[]; // Now uses the extended WorkflowNode
    edges: WorkflowEdge[];
    isDefault?: boolean; // To identify the non-editable default workflow
    // Add tools and LLMs directly to workflow definition if they are part of a saved workflow
    tools?: Tool[];
    llms?: LLMModel[];
}

// Chapter Management Types
export interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  content: string; // Markdown format      
  summary?: string; // AI-generated summary
  wordCount: number;
  tags?: string[];
  notes?: string;
  displayOrder?: number; // User-defined display order
  createdAt: number; // Unix timestamp     
  updatedAt: number; // Unix timestamp     
}

// Enhanced Writing Space Types
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  isDefault?: boolean;
}

export interface ContentLink {
  id: string;
  title: string;
  type: 'chapter' | 'section' | 'note';    
  targetId: string;
  projectId: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface ChapterCreationParams {   
  projectId: string;
  chapterNumber: number;
  chapterTitle: string;
  contentPrompt?: string;
  targetWordCount?: number;
  insertPosition?: 'before' | 'after' | 'replace';
}

export interface ChapterCreationResult {   
  success: boolean;
  chapterId?: string;
  message: string;
  generatedContent?: string;
}
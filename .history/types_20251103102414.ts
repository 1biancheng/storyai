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

export interface EmotionPoint {
  position: number;
  score: number;
  summary: string;
  keywords: string[];
}

export interface EmotionAnalysisData {
  emotionCurve: EmotionPoint[];
  overallSentiment: string;
}

export enum StoryContentType {
  OUTLINE = '大纲',
  CHAPTER = '章节',
  SUMMARY = '摘要',
}

export interface StoryContent {
  id: string;
  type: StoryContentType;
  title: string;
  content: string;

  timestamp: string;
}

export interface PreferenceItem {
  keyword: string;
  popularity: number; // A score from 1-10
  description: string;
}

export interface PreferenceData {
  character_emotions: PreferenceItem[];
  novel_genres: PreferenceItem[];
  timeline_clues: PreferenceItem[];
  narrative_perspectives: PreferenceItem[];
  main_plots: PreferenceItem[];
  character_traits: PreferenceItem[];
}


export interface ProjectData {
  id:string;
  projectName: string;
  projectGenre: string;
  projectRequirements: string;
  workflowId: string;
  styleSceneId?: string | null;
  finalText?: string;
  storyContent?: StoryContent[];
  history?: VersionHistory[];
  chapterCount?: number;
  wordsPerChapter?: number;
  totalWords?: number;
  // Fix: The emotion analysis should store the full BookAnalysisResult, not just EmotionAnalysisData.
  emotionAnalysis?: BookAnalysisResult;
  preferenceAnalysis?: PreferenceData;
  customFields?: Record<string, string | number | boolean>;
  enableThinkingMode?: boolean; // New: For advanced AI model thinking
  enableSearchGrounding?: boolean; // New: For AI model search grounding
  searchProvider?: 'openai' | 'bing' | 'baidu'; // Provider-agnostic search selection
  chapters?: Chapter[]; // New: Chapter management for writing space
}

export type NarrativeElement = Record<string, string>;

export interface BookAnalysisResult extends EmotionAnalysisData {
  characters: NarrativeElement[];
  plotPoints: NarrativeElement[];
  worldBuilding: NarrativeElement[];
}

export interface ModelConfig {
  id: string;
  name: string;
  modelId: string;
  apiKey: string;
  apiUrl?: string;
  isDefault?: boolean;
}

// Card Editor Types
export interface Scene {
  id: string;
  name: string;
  parentId: string | null;
}

export interface PromptCard {
  id:string;
  name: string;
  prompt: string;
  sceneId: string | null;
  linkedModelId: string | null;
  executionModelId?: string | null; // For the LLM model used for AI tools
  lastModified?: string; // ISO string for the editor toolbar
  isDefault?: boolean;
}

export interface FieldModel {
    id: string;
    name: string;
    fields: {
        id: string;
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
  type: 'openai' | 'anthropic' | string; // Allow custom types (gemini removed)
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
/**
 * Workspace文件系统服务
 * 提供统一的workspace访问接口,所有项目和章节数据都基于文件系统
 */

import type { ProjectData } from '../../types';

export interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  status: string;
  createdAt: number;
  updatedAt: number;
  displayOrder?: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  genre: string;
  requirements: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  // 扩展字段(兼容ProjectData)
  workflowId?: string;
  styleSceneId?: string | null;
  chapterCount?: number;
  wordsPerChapter?: number;
  totalWords?: number;
  emotionAnalysis?: any;
  customFields?: Record<string, any>;
  enableThinkingMode?: boolean;
  enableSearchGrounding?: boolean;
  searchProvider?: 'bing' | 'baidu';
}

/**
 * Workspace服务类
 */
class WorkspaceService {
  private static instance: WorkspaceService;
  private baseUrl: string;
  private projectsCache: Map<string, ProjectMetadata> = new Map();
  private chaptersCache: Map<string, Chapter[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5分钟缓存

  private constructor() {
    // 使用相对路径访问workspace
    this.baseUrl = window.location.origin;
  }

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  /**
   * 读取文件(通过后端API)
   */
  private async readFile(path: string): Promise<string> {
    try {
      const response = await fetch(`/api/workspace/read?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`文件不存在: ${path}`);
      }
      const data = await response.json();
      return data.data.content;
    } catch (error) {
      console.error(`读取文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 写入文件(通过API)
   */
  private async writeFile(path: string, content: string): Promise<void> {
    try {
      const response = await fetch('/api/workspace/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
      
      if (!response.ok) {
        throw new Error(`写入文件失败: ${path}`);
      }
    } catch (error) {
      console.error(`写入文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 删除文件(通过API)
   */
  private async deleteFile(path: string): Promise<void> {
    try {
      const response = await fetch(`/api/workspace/delete?path=${encodeURIComponent(path)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`删除文件失败: ${path}`);
      }
    } catch (error) {
      console.error(`删除文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 列出目录内容(通过API)
   */
  private async listDirectory(path: string): Promise<string[]> {
    try {
      const response = await fetch(`/api/workspace/list?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`列出目录失败: ${path}`);
      }
      const data = await response.json();
      return data.data.directories || [];
    } catch (error) {
      console.error(`列出目录失败: ${path}`, error);
      return [];
    }
  }

  /**
   * 获取所有项目
   */
  public async getProjects(useCache: boolean = true): Promise<ProjectMetadata[]> {
    try {
      // 尝试从缓存读取
      if (useCache && this.projectsCache.size > 0) {
        return Array.from(this.projectsCache.values());
      }

      const projectDirs = await this.listDirectory('projects');
      const projects: ProjectMetadata[] = [];

      for (const dirName of projectDirs) {
        try {
          const projectJson = await this.readFile(`projects/${dirName}/project.json`);
          const project = JSON.parse(projectJson) as ProjectMetadata;
          
          // 确保有ID字段
          if (!project.id) {
            project.id = dirName;
          }
          
          projects.push(project);
          this.projectsCache.set(project.id, project);
        } catch (error) {
          console.warn(`跳过无效项目目录: ${dirName}`, error);
        }
      }

      return projects;
    } catch (error) {
      console.error('获取项目列表失败:', error);
      return [];
    }
  }

  /**
   * 获取单个项目
   */
  public async getProject(projectId: string): Promise<ProjectMetadata | null> {
    try {
      // 先检查缓存
      if (this.projectsCache.has(projectId)) {
        return this.projectsCache.get(projectId)!;
      }

      const projectJson = await this.readFile(`projects/${projectId}/project.json`);
      const project = JSON.parse(projectJson) as ProjectMetadata;
      
      this.projectsCache.set(projectId, project);
      return project;
    } catch (error) {
      console.error(`获取项目失败: ${projectId}`, error);
      return null;
    }
  }

  /**
   * 创建项目
   */
  public async createProject(projectData: Omit<ProjectMetadata, 'created_at' | 'updated_at'>): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const project: ProjectMetadata = {
      ...projectData,
      created_at: now,
      updated_at: now
    };

    try {
      // 创建项目目录和project.json
      const projectPath = `projects/${project.id}/project.json`;
      await this.writeFile(projectPath, JSON.stringify(project, null, 2));
      
      // 更新缓存
      this.projectsCache.set(project.id, project);
      
      return project;
    } catch (error) {
      console.error('创建项目失败:', error);
      throw error;
    }
  }

  /**
   * 更新项目
   */
  public async updateProject(projectId: string, updates: Partial<ProjectMetadata>): Promise<ProjectMetadata> {
    try {
      const existing = await this.getProject(projectId);
      if (!existing) {
        throw new Error(`项目不存在: ${projectId}`);
      }

      const updated: ProjectMetadata = {
        ...existing,
        ...updates,
        id: projectId, // 确保ID不被修改
        updated_at: new Date().toISOString()
      };

      const projectPath = `projects/${projectId}/project.json`;
      await this.writeFile(projectPath, JSON.stringify(updated, null, 2));
      
      // 更新缓存
      this.projectsCache.set(projectId, updated);
      
      return updated;
    } catch (error) {
      console.error('更新项目失败:', error);
      throw error;
    }
  }

  /**
   * 删除项目
   */
  public async deleteProject(projectId: string): Promise<void> {
    try {
      // 删除项目目录
      await this.deleteFile(`projects/${projectId}`);
      
      // 删除章节目录
      await this.deleteFile(`chapters/${projectId}`);
      
      // 清除缓存
      this.projectsCache.delete(projectId);
      this.chaptersCache.delete(projectId);
    } catch (error) {
      console.error('删除项目失败:', error);
      throw error;
    }
  }

  /**
   * 获取项目的所有章节
   */
  public async getChapters(projectId: string, useCache: boolean = true): Promise<Chapter[]> {
    try {
      // 检查缓存
      if (useCache && this.chaptersCache.has(projectId)) {
        return this.chaptersCache.get(projectId)!;
      }

      const chapterFiles = await this.listDirectory(`chapters/${projectId}`);
      const chapters: Chapter[] = [];

      for (const fileName of chapterFiles) {
        if (!fileName.endsWith('.json')) continue;
        
        try {
          const chapterJson = await this.readFile(`chapters/${projectId}/${fileName}`);
          const chapter = JSON.parse(chapterJson) as Chapter;
          chapters.push(chapter);
        } catch (error) {
          console.warn(`跳过无效章节文件: ${fileName}`, error);
        }
      }

      // 按章节号排序
      chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
      
      // 更新缓存
      this.chaptersCache.set(projectId, chapters);
      
      return chapters;
    } catch (error) {
      console.error(`获取章节列表失败: ${projectId}`, error);
      return [];
    }
  }

  /**
   * 创建章节
   */
  public async createChapter(chapter: Chapter): Promise<Chapter> {
    try {
      const chapterPath = `chapters/${chapter.projectId}/chapter-${chapter.chapterNumber}.json`;
      await this.writeFile(chapterPath, JSON.stringify(chapter, null, 2));
      
      // 清除缓存,强制重新加载
      this.chaptersCache.delete(chapter.projectId);
      
      return chapter;
    } catch (error) {
      console.error('创建章节失败:', error);
      throw error;
    }
  }

  /**
   * 更新章节
   */
  public async updateChapter(chapter: Chapter): Promise<Chapter> {
    try {
      const updated = {
        ...chapter,
        updatedAt: Date.now()
      };
      
      const chapterPath = `chapters/${chapter.projectId}/chapter-${chapter.chapterNumber}.json`;
      await this.writeFile(chapterPath, JSON.stringify(updated, null, 2));
      
      // 清除缓存
      this.chaptersCache.delete(chapter.projectId);
      
      return updated;
    } catch (error) {
      console.error('更新章节失败:', error);
      throw error;
    }
  }

  /**
   * 删除章节
   */
  public async deleteChapter(projectId: string, chapterNumber: number): Promise<void> {
    try {
      const chapterPath = `chapters/${projectId}/chapter-${chapterNumber}.json`;
      await this.deleteFile(chapterPath);
      
      // 清除缓存
      this.chaptersCache.delete(projectId);
    } catch (error) {
      console.error('删除章节失败:', error);
      throw error;
    }
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.projectsCache.clear();
    this.chaptersCache.clear();
  }

  /**
   * 将ProjectData转换为ProjectMetadata
   */
  public projectDataToMetadata(projectData: ProjectData): ProjectMetadata {
    return {
      id: projectData.id,
      name: projectData.projectName,
      genre: projectData.projectGenre,
      requirements: projectData.projectRequirements || '',
      settings: projectData.customFields || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      workflowId: projectData.workflowId,
      styleSceneId: projectData.styleSceneId,
      chapterCount: projectData.chapterCount,
      wordsPerChapter: projectData.wordsPerChapter,
      totalWords: projectData.totalWords,
      emotionAnalysis: projectData.emotionAnalysis,
      customFields: projectData.customFields,
      enableThinkingMode: projectData.enableThinkingMode,
      enableSearchGrounding: projectData.enableSearchGrounding,
      searchProvider: projectData.searchProvider === 'openai' ? 'bing' : projectData.searchProvider
    };
  }

  /**
   * 将ProjectMetadata转换为ProjectData
   */
  public metadataToProjectData(metadata: ProjectMetadata): ProjectData {
    return {
      id: metadata.id,
      projectName: metadata.name,
      projectGenre: metadata.genre,
      projectRequirements: metadata.requirements,
      workflowId: metadata.workflowId || '',
      styleSceneId: metadata.styleSceneId || null,
      chapterCount: metadata.chapterCount,
      wordsPerChapter: metadata.wordsPerChapter,
      totalWords: metadata.totalWords,
      emotionAnalysis: metadata.emotionAnalysis,
      customFields: metadata.customFields || {},
      enableThinkingMode: metadata.enableThinkingMode || false,
      enableSearchGrounding: metadata.enableSearchGrounding || false,
      searchProvider: metadata.searchProvider || 'bing'
    };
  }
}

// 导出单例
export const workspaceService = WorkspaceService.getInstance();

/**
 * 项目数据同步服务
 * 提供统一的项目数据管理,主要负责workspace到后端数据库的同步
 * 注意:workspace文件系统是唯一数据源,本服务仅用于同步到后端
 */

import { apiClient } from './apiClient';
import type { ProjectData } from '../../types';

const API_BASE = '/api/v1/projects';

/**
 * 项目API响应类型
 */
interface ProjectApiResponse {
  code: number;
  message: string;
  data: ProjectData[] | ProjectData | null;
  timestamp: string;
}

/**
 * 项目同步统计类型
 */
interface ProjectSyncStats {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * 手动触发项目级文件系统→数据库同步
 * 
 * @param projectId 项目ID
 * @returns 同步统计结果
 */
export async function syncProject(projectId: string): Promise<ProjectSyncStats> {
  try {
    const response = await apiClient.post<{
      code: number;
      message: string;
      data: ProjectSyncStats;
      timestamp: string;
    }>(`${API_BASE}/sync/${projectId}`);
    
    if (response.data?.data) {
      return response.data.data;
    }
    
    throw new Error('同步结果格式错误');
  } catch (error) {
    console.error(`项目 ${projectId} 同步失败:`, error);
    throw error;
  }
}

/**
 * 从后端API获取所有项目 - 已废弃
 * @deprecated 请使用workspaceService.getProjects代替
 */
export async function fetchProjects(): Promise<ProjectData[]> {
  console.warn('fetchProjects已废弃，请使用workspaceService.getProjects');
  try {
    const response = await apiClient.get<ProjectApiResponse>(API_BASE);
    if (response.data?.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error('从后端获取项目数据失败:', error);
    return [];
  }
}

/**
 * 创建新项目 - 已废弃
 * @deprecated 请使用workspaceService.createProject代替
 */
export async function createProject(projectData: Omit<ProjectData, 'id'>): Promise<ProjectData | null> {
  console.warn('createProject已废弃，请使用workspaceService.createProject');
  try {
    const response = await apiClient.post<ProjectApiResponse>(API_BASE, projectData);
    if (response.data?.data && !Array.isArray(response.data.data)) {
      return response.data.data as ProjectData;
    }
    return null;
  } catch (error) {
    console.error('创建项目失败:', error);
    return createLocalProject(projectData);
  }
}

/**
 * 更新项目 - 已废弃
 * @deprecated 请使用workspaceService.updateProject代替
 */
export async function updateProject(projectId: string, updates: Partial<ProjectData>): Promise<ProjectData | null> {
  console.warn('updateProject已废弃，请使用workspaceService.updateProject');
  try {
    const response = await apiClient.put<ProjectApiResponse>(`${API_BASE}/${projectId}`, updates);
    if (response.data?.data && !Array.isArray(response.data.data)) {
      return response.data.data as ProjectData;
    }
    return null;
  } catch (error) {
    console.error('更新项目失败:', error);
    return null;
  }
}

/**
 * 删除项目 - 已废弃
 * @deprecated 请使用workspaceService.deleteProject代替
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  console.warn('deleteProject已废弃，请使用workspaceService.deleteProject');
  try {
    await apiClient.delete(`${API_BASE}/${projectId}`);
    return true;
  } catch (error) {
    console.error('删除项目失败:', error);
    return false;
  }
}

/**
 * 以下函数已废弃，仅保留以保证向后兼容
 * @deprecated
 */

/**
 * 获取本地缓存的项目数据 - 已废弃
 */
export function getCachedProjects(): ProjectData[] {
  return [];
}

/**
 * 更新本地缓存 - 已废弃
 */
function updateProjectCache(project: ProjectData): void {
  // 不再使用localStorage
}

/**
 * 从缓存中删除项目 - 已废弃
 */
function removeProjectFromCache(projectId: string): void {
  // 不再使用localStorage
}

/**
 * 更新本地项目(离线模式) - 已废弃
 */
async function updateLocalProject(projectId: string, updates: Partial<ProjectData>): Promise<ProjectData | null> {
  return null;
}

/**
 * 创建本地项目(离线模式) - 已废弃，请使用workspaceService
 * @deprecated 使用workspaceService.createProject代替
 */
function createLocalProject(projectData: Omit<ProjectData, 'id'>): ProjectData {
  const localProject: ProjectData = {
    ...projectData,
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  return localProject;
}

/**
 * 启动自动同步 - 已禁用，改用手动同步
 * @deprecated 不再支持自动同步，请使用syncProject手动同步
 */
export function startAutoSync(): () => void {
  // 返回空清理函数
  return () => {
    // 无需清理
  };
}

/**
 * 检查缓存是否过期 - 已废弃
 * @deprecated
 */
export function isCacheExpired(): boolean {
  return true;
}

/**
 * 强制刷新缓存 - 已废弃
 * @deprecated 请使用workspaceService.getProjects(false)
 */
export async function forceRefreshCache(): Promise<ProjectData[]> {
  console.warn('forceRefreshCache已废弃，请使用workspaceService.getProjects(false)');
  return [];
}
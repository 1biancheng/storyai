/**
 * 章节管理API服务
 * 提供与后端章节管理相关的API调用
 */

import { apiClient } from './apiClient';
import type { Chapter } from '../../types';

const API_BASE = '/api/v1/chapters';

/**
 * 获取项目的章节列表
 */
export async function getChaptersByProjectId(projectId: string): Promise<Chapter[]> {
  try {
    const response = await apiClient.get<Chapter[]>(`${API_BASE}/project/${projectId}`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('获取章节列表失败:', error);
    throw error;
  }
}

/**
 * 创建新章节
 */
export async function createChapter(data: {
  projectId: string;
  chapterNumber: number;
  title: string;
  content?: string;
  tags?: string[];
  notes?: string;
}): Promise<Chapter> {
  try {
    const response = await apiClient.post<Chapter>(API_BASE, data);
    return response.data;
  } catch (error) {
    console.error('创建章节失败:', error);
    throw error;
  }
}

/**
 * 更新章节
 */
export async function updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<Chapter> {
  try {
    const response = await apiClient.put<Chapter>(`${API_BASE}/${chapterId}`, updates);
    return response.data;
  } catch (error) {
    console.error('更新章节失败:', error);
    throw error;
  }
}

/**
 * 删除章节
 */
export async function deleteChapter(chapterId: string): Promise<void> {
  try {
    await apiClient.delete(`${API_BASE}/${chapterId}`);
  } catch (error) {
    console.error('删除章节失败:', error);
    throw error;
  }
}

/**
 * 重新排序章节
 */
export async function reorderChapters(projectId: string, chapterIds: string[]): Promise<void> {
  try {
    await apiClient.post(`${API_BASE}/project/${projectId}/reorder`, { chapter_ids: chapterIds });
  } catch (error) {
    console.error('重新排序章节失败:', error);
    throw error;
  }
}

/**
 * 验证章节数据
 */
export async function validateChapters(projectId: string): Promise<boolean> {
  try {
    const response = await apiClient.post<{ valid: boolean }>(`${API_BASE}/project/${projectId}/validate`);
    return response.data.valid;
  } catch (error) {
    console.error('验证章节数据失败:', error);
    throw error;
  }
}

/**
 * 修复章节编号
 */
export async function fixChapterNumbers(projectId: string): Promise<void> {
  try {
    await apiClient.post(`${API_BASE}/project/${projectId}/fix_numbers`);
  } catch (error) {
    console.error('修复章节编号失败:', error);
    throw error;
  }
}

export async function syncChapters(projectId: string): Promise<{ ok: boolean; inserts: number; updates: number; missing: number } > {
  try {
    const response = await apiClient.post<{ ok: boolean; inserts: number; updates: number; missing: number }>(`${API_BASE}/sync/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('章节同步失败:', error);
    throw error;
  }
}

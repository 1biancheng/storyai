/**
 * Chapter Store - State management for chapter data
 * Uses Zustand for lightweight state management
 * Optimized to prevent unnecessary rerenders
 */

import { create } from 'zustand';
import type { Chapter } from '../types';
import { apiClient } from '../services/apiClient';
import { getCurrentTimestamp } from '../utils/timeUtils.ts';

interface ChapterStore {
  // State
  chapters: Chapter[];
  currentChapterId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setChapters: (chapters: Chapter[]) => void;
  setCurrentChapter: (chapterId: string | null) => void;
  addChapter: (chapter: Chapter) => void;
  updateChapter: (chapterId: string, updates: Partial<Chapter>) => void;
  updateChapterTitleAndNumber: (chapterId: string, title: string, chapterNumber: number) => Promise<void>;
  deleteChapter: (chapterId: string) => void;
  reorderChapters: (chapterIds: string[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API Actions
  fetchChapters: (projectId: string) => Promise<void>;
  createChapter: (data: {
    projectId: string;
    chapterNumber: number;
    title: string;
    content?: string;
  }) => Promise<Chapter | null>;
  saveChapter: (chapterId: string, updates: Partial<Chapter>) => Promise<void>;
  removeChapter: (chapterId: string) => Promise<void>;
  reorderChaptersAPI: (projectId: string, chapterIds: string[]) => Promise<void>;
  validateChapters: (projectId: string) => Promise<boolean>;
  fixChapterNumbers: (projectId: string) => Promise<boolean>;
}

const API_BASE = '/api/v1/chapters';

export const useChapterStore = create<ChapterStore>((set, get) => {
  // Store last fetch project ID to prevent duplicate fetches
  let lastFetchedProjectId: string | null = null;
  
  return {
  // Initial state
  chapters: [],
  currentChapterId: null,
  isLoading: false,
  error: null,
  
  // Sync actions
  setChapters: (chapters) => set({ chapters }),
  
  setCurrentChapter: (chapterId) => set({ currentChapterId: chapterId }),
  
  addChapter: (chapter) => set((state) => ({
    chapters: [...state.chapters, chapter].sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : a.chapterNumber;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : b.chapterNumber;
      return orderA - orderB;
    })
  })),
  
  updateChapter: (chapterId, updates) => set((state) => ({
    chapters: state.chapters.map((ch) =>
      ch.id === chapterId ? { ...ch, ...updates, updatedAt: getCurrentTimestamp() } : ch
    )
  })),
  
  updateChapterTitleAndNumber: async (chapterId, title, chapterNumber) => {
    try {
      await get().saveChapter(chapterId, { title, chapterNumber });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },
  
  deleteChapter: (chapterId) => set((state) => ({
    chapters: state.chapters.filter((ch) => ch.id !== chapterId),
    currentChapterId: state.currentChapterId === chapterId ? null : state.currentChapterId
  })),
  
  reorderChapters: (chapterIds) => set((state) => {
    const chapterMap = new Map(state.chapters.map(ch => [ch.id, ch]));
    return {
      chapters: chapterIds.map((id, index) => {
        const chapter = chapterMap.get(id);
        if (chapter) {
          // Update displayOrder based on new position, keep chapterNumber unchanged
          return { ...chapter, displayOrder: index + 1 };
        }
        return chapter;
      }).filter(Boolean) as Chapter[]
    };
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  // Async API actions
  fetchChapters: async (projectId) => {
    // Prevent duplicate fetches for the same project
    if (lastFetchedProjectId === projectId && get().chapters.length > 0) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const resp = await apiClient.get<Chapter[]>(`${API_BASE}/project/${projectId}`);
      const chapters: Chapter[] = Array.isArray(resp.data) ? resp.data : [];
      set({ chapters, isLoading: false });
      lastFetchedProjectId = projectId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },
  
  createChapter: async (data) => {
    // Don't set loading state to prevent UI flicker
    try {
      const resp = await apiClient.post<Chapter>(API_BASE, {
        project_id: data.projectId,
        chapter_number: data.chapterNumber,
        title: data.title,
        content: data.content || ''
      });
      const chapter: Chapter = (resp.data as Chapter);
      
      // Optimistically update state without triggering loading
      set((state) => ({
        chapters: [...state.chapters, chapter].sort((a, b) => {
          const orderA = a.displayOrder !== undefined ? a.displayOrder : a.chapterNumber;
          const orderB = b.displayOrder !== undefined ? b.displayOrder : b.chapterNumber;
          return orderA - orderB;
        })
      }));
      
      return chapter;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    }
  },
  
  saveChapter: async (chapterId, updates) => {
    // Don't set loading state to prevent UI flicker during auto-save
    try {
      const resp = await apiClient.put<Chapter>(`${API_BASE}/${chapterId}`, updates);
      const updatedChapter: Chapter = (resp.data as Chapter);
      
      // Optimistically update state
      set((state) => ({
        chapters: state.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, ...updatedChapter, updatedAt: getCurrentTimestamp() } : ch
        )
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },
  
  removeChapter: async (chapterId) => {
    // Optimistically remove from UI first
    const previousChapters = get().chapters;
    const previousCurrentId = get().currentChapterId;
    
    // Update UI immediately
    set((state) => ({
      chapters: state.chapters.filter((ch) => ch.id !== chapterId),
      currentChapterId: state.currentChapterId === chapterId ? null : state.currentChapterId
    }));
    
    try {
      await apiClient.delete<void>(`${API_BASE}/${chapterId}`);
    } catch (error) {
      // Rollback on error
      set({ chapters: previousChapters, currentChapterId: previousCurrentId });
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },
  
  // New method for reordering chapters via API
  reorderChaptersAPI: async (projectId: string, chapterIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      // Send chapter IDs wrapped in an object to match backend's embed=True parameter
      await apiClient.post<void>(`${API_BASE}/project/${projectId}/reorder`, { chapter_ids: chapterIds });
      
      // Update local state after successful API call
      set((state) => {
        const chapterMap = new Map(state.chapters.map(ch => [ch.id, ch]));
        return {
          chapters: chapterIds.map((id, index) => {
            const chapter = chapterMap.get(id);
            if (chapter) {
              // Update displayOrder based on new position, keep chapterNumber unchanged
              return { ...chapter, displayOrder: index + 1, updatedAt: Date.now() };
            }
            return chapter;
          }).filter(Boolean) as Chapter[]
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // New method for validating chapter numbers
  validateChapters: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await apiClient.post<{valid: boolean}>(`${API_BASE}/project/${projectId}/validate`);
      return resp.data.valid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // New method for fixing chapter numbers
  fixChapterNumbers: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.post<void>(`${API_BASE}/project/${projectId}/fix_numbers`);
      
      // Refresh chapters after fixing
      await get().fetchChapters(projectId);
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return false;
    } finally {
      set({ isLoading: false });
    }
  }
};
});
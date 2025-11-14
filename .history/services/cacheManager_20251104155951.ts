/**
 * 缓存管理器 - 协调浏览器端缓存和服务端缓存
 * 
 * 缓存策略:
 * 1. 浏览器端: LocalStorage/SessionStorage 存储用户偏好、临时数据
 * 2. HTTP层: 所有 API 响应禁用浏览器缓存 (Cache-Control: no-store)
 * 3. 服务端: Redis 作为唯一业务数据缓存层
 */

import { getCurrentTimestamp } from '../utils/timeUtils.ts';

// 浏览器端缓存键前缀
const BROWSER_CACHE_PREFIX = 'storyai_cache_';

// 缓存类型枚举
export enum CacheType {
  USER_PREFERENCES = 'user_preferences',
  TEMP_DATA = 'temp_data',
  FORM_DATA = 'form_data',
  RECENT_PROJECTS = 'recent_projects'
}

/**
 * 浏览器端缓存管理器
 */
export class BrowserCacheManager {
  /**
   * 设置浏览器端缓存
   * @param type 缓存类型
   * @param key 缓存键
   * @param value 缓存值
   * @param useSession 是否使用 sessionStorage (默认 localStorage)
   */
  static set(type: CacheType, key: string, value: any, useSession: boolean = false): void {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const cacheKey = `${BROWSER_CACHE_PREFIX}${type}_${key}`;
      storage.setItem(cacheKey, JSON.stringify({
        data: value,
        timestamp: Date.now(),
        type: type
      }));
    } catch (error) {
      console.warn('Failed to set browser cache:', error);
    }
  }

  /**
   * 获取浏览器端缓存
   * @param type 缓存类型
   * @param key 缓存键
   * @param ttl 过期时间(毫秒)，默认不过期
   * @param useSession 是否使用 sessionStorage
   */
  static get(type: CacheType, key: string, ttl?: number, useSession: boolean = false): any {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const cacheKey = `${BROWSER_CACHE_PREFIX}${type}_${key}`;
      const cached = storage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      
      // 检查是否过期
      if (ttl && parsed.timestamp) {
        const age = Date.now() - parsed.timestamp;
        if (age > ttl) {
          storage.removeItem(cacheKey);
          return null;
        }
      }
      
      return parsed.data;
    } catch (error) {
      console.warn('Failed to get browser cache:', error);
      return null;
    }
  }

  /**
   * 删除浏览器端缓存
   * @param type 缓存类型
   * @param key 缓存键
   * @param useSession 是否使用 sessionStorage
   */
  static remove(type: CacheType, key: string, useSession: boolean = false): void {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const cacheKey = `${BROWSER_CACHE_PREFIX}${type}_${key}`;
      storage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Failed to remove browser cache:', error);
    }
  }

  /**
   * 清除指定类型的缓存
   * @param type 缓存类型
   * @param useSession 是否使用 sessionStorage
   */
  static clearType(type: CacheType, useSession: boolean = false): void {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(`${BROWSER_CACHE_PREFIX}${type}_`)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => storage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear browser cache type:', error);
    }
  }

  /**
   * 清除所有浏览器端缓存
   * @param useSession 是否清除 sessionStorage
   */
  static clearAll(useSession: boolean = false): void {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(BROWSER_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => storage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear all browser cache:', error);
    }
  }
}

/**
 * 服务端缓存管理器 (通过 API 客户端)
 */
export class ServerCacheManager {
  private static readonly CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  /**
   * 获取缓存数据 (实际通过后端 Redis)
   * @param key 缓存键
   */
  static async get(key: string): Promise<any> {
    // 实际调用后端 API，后端会从 Redis 获取
    // 这里只是示例，实际应该调用具体的 API
    try {
      // 示例: 调用后端获取缓存数据
      // const response = await fetch(`/api/v1/cache/${key}`, {
      //   headers: this.CACHE_HEADERS
      // });
      // return await response.json();
      return null;
    } catch (error) {
      console.warn('Failed to get server cache:', error);
      return null;
    }
  }

  /**
   * 设置缓存数据 (实际存储到后端 Redis)
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间(秒)
   */
  static async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      // 示例: 调用后端设置缓存数据
      // const response = await fetch(`/api/v1/cache/${key}`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...this.CACHE_HEADERS
      //   },
      //   body: JSON.stringify({ value, ttl })
      // });
      // return response.ok;
      return true;
    } catch (error) {
      console.warn('Failed to set server cache:', error);
      return false;
    }
  }

  /**
   * 删除缓存数据
   * @param key 缓存键
   */
  static async remove(key: string): Promise<boolean> {
    try {
      // 示例: 调用后端删除缓存数据
      // const response = await fetch(`/api/v1/cache/${key}`, {
      //   method: 'DELETE',
      //   headers: this.CACHE_HEADERS
      // });
      // return response.ok;
      return true;
    } catch (error) {
      console.warn('Failed to remove server cache:', error);
      return false;
    }
  }
}

/**
 * 统一缓存管理器 - 协调浏览器端和服务端缓存
 */
export class UnifiedCacheManager {
  /**
   * 获取缓存数据 (优先浏览器端，然后服务端)
   * @param key 缓存键
   * @param browserCacheType 浏览器缓存类型
   * @param ttl 浏览器缓存过期时间
   */
  static async get(key: string, browserCacheType?: CacheType, ttl?: number): Promise<any> {
    // 首先尝试从浏览器端获取
    if (browserCacheType) {
      const browserData = BrowserCacheManager.get(browserCacheType, key, ttl);
      if (browserData !== null) {
        return browserData;
      }
    }

    // 浏览器端没有，从服务端获取
    const serverData = await ServerCacheManager.get(key);
    return serverData;
  }

  /**
   * 设置缓存数据 (同时设置浏览器端和服务端)
   * @param key 缓存键
   * @param value 缓存值
   * @param browserCacheType 浏览器缓存类型
   * @param serverTtl 服务端缓存过期时间(秒)
   * @param browserTtl 浏览器缓存过期时间(毫秒)
   */
  static async set(
    key: string, 
    value: any, 
    browserCacheType?: CacheType,
    serverTtl?: number,
    browserTtl?: number
  ): Promise<void> {
    // 设置浏览器端缓存
    if (browserCacheType) {
      BrowserCacheManager.set(browserCacheType, key, value, false);
    }

    // 设置服务端缓存
    await ServerCacheManager.set(key, value, serverTtl);
  }

  /**
   * 删除缓存数据
   * @param key 缓存键
   * @param browserCacheType 浏览器缓存类型
   */
  static async remove(key: string, browserCacheType?: CacheType): Promise<void> {
    // 删除浏览器端缓存
    if (browserCacheType) {
      BrowserCacheManager.remove(browserCacheType, key);
    }

    // 删除服务端缓存
    await ServerCacheManager.remove(key);
  }
}

// 导出默认实例
export const cacheManager = new UnifiedCacheManager();

// 导出类型和枚举
export default {
  BrowserCacheManager,
  ServerCacheManager,
  UnifiedCacheManager,
  CacheType,
  cacheManager
};
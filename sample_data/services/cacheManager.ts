/**
 * 浏览器缓存管理器 - 简化版前端缓存实现
 * 
 * 缓存策略:
 * 1. 浏览器端: LocalStorage/SessionStorage 存储用户偏好、临时数据
 * 2. HTTP层: 所有 API 响应禁用浏览器缓存 (Cache-Control: no-store)
 * 3. 服务端: Redis 作为业务数据缓存层,前端通过API访问
 */

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
 * 浏览器端缓存管理器 - 统一的前端缓存实现
 */
export class CacheManager {
  /**
   * 获取缓存数据
   * @param cacheType 缓存类型 (localStorage 或 sessionStorage)
   * @param key 缓存键
   * @param ttl 过期时间(毫秒),可选,如果不提供则使用默认值
   */
  static get(cacheType: CacheType, key: string, ttl?: number): any {
    try {
      const storage = cacheType === 'localStorage' ? localStorage : sessionStorage;
      const item = storage.getItem(key);
      
      if (!item) return null;

      const data = JSON.parse(item);
      
      // 如果没有过期时间字段,直接返回数据(兼容旧数据)
      if (!data.expireAt) return data.value;
      
      // 检查是否过期
      if (Date.now() > data.expireAt) {
        storage.removeItem(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * 设置缓存数据
   * @param cacheType 缓存类型 (localStorage 或 sessionStorage)
   * @param key 缓存键
   * @param value 缓存值
   * @param useDefaultTTL 是否使用默认过期时间(7天)
   */
  static set(cacheType: CacheType, key: string, value: any, useDefaultTTL: boolean = true): void {
    try {
      const storage = cacheType === 'localStorage' ? localStorage : sessionStorage;
      const expireAt = useDefaultTTL ? Date.now() + DEFAULT_TTL : null;
      
      const data = {
        value,
        expireAt
      };

      storage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  /**
   * 删除缓存数据
   * @param cacheType 缓存类型 (localStorage 或 sessionStorage)
   * @param key 缓存键
   */
  static remove(cacheType: CacheType, key: string): void {
    try {
      const storage = cacheType === 'localStorage' ? localStorage : sessionStorage;
      storage.removeItem(key);
    } catch (error) {
      console.warn('Cache remove error:', error);
    }
  }

  /**
   * 清除指定类型的所有缓存数据
   * @param cacheType 缓存类型 (localStorage 或 sessionStorage)
   */
  static clearType(cacheType: CacheType): void {
    try {
      const storage = cacheType === 'localStorage' ? localStorage : sessionStorage;
      storage.clear();
    } catch (error) {
      console.warn('Cache clear type error:', error);
    }
  }

  /**
   * 清除所有缓存数据
   */
  static clearAll(): void {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.warn('Cache clear all error:', error);
    }
  }
}

// 简化后的缓存管理器 - 仅保留浏览器端缓存
// 服务端缓存通过API访问,前端不直接操作Redis
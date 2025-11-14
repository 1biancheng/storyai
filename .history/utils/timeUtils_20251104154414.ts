/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * 时间工具函数模块
 * 提供统一的时间处理功能，用于项目和章节创建时间的生成和格式化
 */

// 获取当前时间戳（毫秒）
export const getCurrentTimestamp = (): number => {
  return Date.now();
};

// 获取当前ISO格式时间字符串
export const getCurrentISOTime = (): string => {
  return new Date().toISOString();
};

// 获取当前UTC时间戳（毫秒）
export const getCurrentUTCTimestamp = (): number => {
  return Date.now();
};

// 获取当前UTC ISO格式时间字符串
export const getCurrentUTCISOTime = (): string => {
  return new Date().toISOString();
};

// 格式化时间戳为可读字符串
export const formatTimestamp = (timestamp: number, format: 'full' | 'date' | 'time' = 'full'): string => {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'date':
      return date.toLocaleDateString('zh-CN');
    case 'time':
      return date.toLocaleTimeString('zh-CN');
    case 'full':
    default:
      return date.toLocaleString('zh-CN');
  }
};

// 格式化ISO时间为可读字符串
export const formatISOTime = (isoTime: string, format: 'full' | 'date' | 'time' = 'full'): string => {
  const date = new Date(isoTime);
  
  switch (format) {
    case 'date':
      return date.toLocaleDateString('zh-CN');
    case 'time':
      return date.toLocaleTimeString('zh-CN');
    case 'full':
    default:
      return date.toLocaleString('zh-CN');
  }
};

// 生成项目创建时间数据
export const generateProjectTimeData = () => {
  const now = getCurrentUTCISOTime();
  return {
    created_at: now,
    updated_at: now
  };
};

// 生成章节创建时间数据
export const generateChapterTimeData = () => {
  const now = getCurrentTimestamp();
  return {
    createdAt: now,
    updatedAt: now
  };
};

// 更新时间戳
export const updateTimestamp = (timestamp: number): number => {
  return getCurrentTimestamp();
};

// 更新ISO时间
export const updateISOTime = (isoTime: string): string => {
  return getCurrentUTCISOTime();
};

// 计算时间差（毫秒）
export const getTimeDifference = (time1: number | string, time2: number | string): number => {
  const t1 = typeof time1 === 'string' ? new Date(time1).getTime() : time1;
  const t2 = typeof time2 === 'string' ? new Date(time2).getTime() : time2;
  return Math.abs(t2 - t1);
};

// 计算时间差（可读格式）
export const getTimeDifferenceReadable = (time1: number | string, time2: number | string): string => {
  const diffMs = getTimeDifference(time1, time2);
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}天`;
  if (diffHours > 0) return `${diffHours}小时`;
  if (diffMinutes > 0) return `${diffMinutes}分钟`;
  return `${diffSeconds}秒`;
};
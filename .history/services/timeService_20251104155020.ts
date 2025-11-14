import { apiClient } from './apiClient';

/**
 * 获取服务器时间
 * @returns Promise<{server_time: string, timezone: string, unix_timestamp: number}>
 */
export async function getServerTime(): Promise<{server_time: string, timezone: string, unix_timestamp: number}> {
  try {
    const response = await apiClient.get('/system/time');
    return response.data.data;
  } catch (error) {
    console.error('Failed to get server time:', error);
    // 如果服务器时间获取失败，回退到本地时间
    const now = new Date();
    return {
      server_time: now.toISOString(),
      timezone: 'Local',
      unix_timestamp: Math.floor(now.getTime() / 1000)
    };
  }
}

/**
 * 获取服务器时间戳（毫秒）
 * @returns Promise<number>
 */
export async function getServerTimestampMs(): Promise<number> {
  const timeData = await getServerTime();
  return timeData.unix_timestamp * 1000;
}

/**
 * 获取服务器ISO格式时间字符串
 * @returns Promise<string>
 */
export async function getServerIsoString(): Promise<string> {
  const timeData = await getServerTime();
  return timeData.server_time;
}
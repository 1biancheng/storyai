/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeDisplayProps {
  className?: string;
  format?: '12h' | '24h';
  showSeconds?: boolean;
  showDate?: boolean;
  useServerTime?: boolean;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({
  className = '',
  format = '24h',
  showSeconds = true,
  showDate = false,
  useServerTime = false
}) => {
  const [time, setTime] = useState<Date>(new Date());
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(useServerTime);

  // 获取服务器时间
  const fetchServerTime = async () => {
    try {
      const response = await fetch('/api/v1/system/time');
      if (response.ok) {
        const data = await response.json();
        setServerTime(new Date(data.data.server_time));
      }
    } catch (error) {
      console.error('Failed to fetch server time:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (useServerTime) {
      fetchServerTime();
      // 每分钟同步一次服务器时间
      const interval = setInterval(fetchServerTime, 60000);
      return () => clearInterval(interval);
    }
  }, [useServerTime]);

  useEffect(() => {
    // 每秒更新时间
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 格式化时间
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    let period = '';

    if (format === '12h') {
      period = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12 || 12;
    }

    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');

    let timeString = `${hoursStr}:${minutesStr}`;
    if (showSeconds) {
      timeString += `:${secondsStr}`;
    }
    timeString += period;

    return timeString;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    return date.toLocaleDateString('zh-CN', options);
  };

  // 使用服务器时间或本地时间
  const displayTime = useServerTime && serverTime ? serverTime : time;

  if (loading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Clock size={16} />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Clock size={16} />
      <span className="text-sm font-medium">
        {formatTime(displayTime)}
      </span>
      {showDate && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          {formatDate(displayTime)}
        </span>
      )}
    </div>
  );
};

export default TimeDisplay;
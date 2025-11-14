import React, { useState, useEffect } from 'react';

interface TimeDisplayProps {
    className?: string;
    format?: 'full' | 'time' | 'date';
    timezone?: string;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ 
    className = '', 
    format = 'full',
    timezone = 'local'
}) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        // 每秒更新时间
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

    // 格式化时间显示
    const formatTime = (date: Date) => {
        try {
            let displayDate = date;
            
            // 如果指定了时区，进行转换
            if (timezone !== 'local') {
                try {
                    // 使用toLocaleString进行时区转换
                    const options: Intl.DateTimeFormatOptions = {
                        timeZone: timezone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    };
                    
                    const parts = new Intl.DateTimeFormat('zh-CN', options).formatToParts(date);
                    const year = parts.find(p => p.type === 'year')?.value || '';
                    const month = parts.find(p => p.type === 'month')?.value || '';
                    const day = parts.find(p => p.type === 'day')?.value || '';
                    const hour = parts.find(p => p.type === 'hour')?.value || '';
                    const minute = parts.find(p => p.type === 'minute')?.value || '';
                    const second = parts.find(p => p.type === 'second')?.value || '';
                    
                    displayDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                } catch (error) {
                    console.error('时区转换失败:', error);
                    // 如果时区转换失败，使用本地时间
                }
            }
            
            switch (format) {
                case 'time':
                    return displayDate.toLocaleTimeString('zh-CN', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                case 'date':
                    return displayDate.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                case 'full':
                default:
                    return displayDate.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
            }
        } catch (error) {
            console.error('时间格式化失败:', error);
            return date.toLocaleString('zh-CN');
        }
    };

    // 避免服务端渲染和客户端渲染不匹配
    if (!mounted) {
        return <div className={`text-gray-500 dark:text-gray-400 ${className}`}>加载中...</div>;
    }

    return (
        <div className={`text-gray-700 dark:text-gray-300 ${className}`}>
            {formatTime(currentTime)}
        </div>
    );
};

export default TimeDisplay;
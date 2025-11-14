/**
 * 虚拟滚动段落列表组件
 * 
 * 功能:
 * - 虚拟滚动优化大列表性能
 * - 仅渲染可见区域的项目
 * - 支持平滑滚动
 * - 过度扫描(overscan)以减少白屏
 */

import React, { useState, useRef, useCallback } from 'react';
import ParagraphCard from './ParagraphCard';

interface Paragraph {
  index: number;
  content: string;
  length_bytes: number;
  length_chars: number;
  length_chinese: number;
  meta: any;
}

interface VirtualListProps {
  paragraphs: Paragraph[];
  itemHeight?: number;  // 预估项高度
  overscan?: number;     // 额外渲染的项数
}

const VirtualParagraphList: React.FC<VirtualListProps> = ({
  paragraphs,
  itemHeight = 200,
  overscan = 5
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 计算可见范围
  const containerHeight = containerRef.current?.clientHeight || 600;
  const totalHeight = paragraphs.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    paragraphs.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleParagraphs = paragraphs.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
      style={{ position: 'relative' }}
    >
      {/* 占位元素,确保滚动条正确 */}
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {/* 可见项 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`
          }}
        >
          <div className="space-y-4">
            {visibleParagraphs.map((para) => (
              <ParagraphCard key={para.index} {...para} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualParagraphList;
/**
 * 虚拟滚动段落列表组件
 * 
 * 功能:
 * - 虚拟滚动优化大列表性能
 * - 仅渲染可见区域的项目
 * - 支持平滑滚动
 * - 过度扫描(overscan)以减少白屏
 */

import React, { useState, useRef, useCallback } from 'react';
import ParagraphCard from './ParagraphCard';

interface Paragraph {
  index: number;
  content: string;
  length_bytes: number;
  length_chars: number;
  length_chinese: number;
  meta: any;
}

interface VirtualListProps {
  paragraphs: Paragraph[];
  itemHeight?: number;  // 预估项高度
  overscan?: number;     // 额外渲染的项数
}

const VirtualParagraphList: React.FC<VirtualListProps> = ({
  paragraphs,
  itemHeight = 200,
  overscan = 5
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 计算可见范围
  const containerHeight = containerRef.current?.clientHeight || 600;
  const totalHeight = paragraphs.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    paragraphs.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleParagraphs = paragraphs.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto"
      style={{ position: 'relative' }}
    >
      {/* 占位元素,确保滚动条正确 */}
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        {/* 可见项 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`
          }}
        >
          <div className="space-y-4">
            {visibleParagraphs.map((para) => (
              <ParagraphCard key={para.index} {...para} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualParagraphList;

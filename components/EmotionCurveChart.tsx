/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EmotionPoint } from '../types.ts';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const EmotionCurveChart: React.FC<{ points: EmotionPoint[] }> = ({ points }) => {
  if (!points || points.length === 0) return null;

  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, xDomain: [0, 0] });
  
  const originalMaxPosition = useMemo(() => Math.max(...points.map(p => p.position), 1), [points]);
  const minPossiblePosition = useMemo(() => Math.min(...points.map(p => p.position), 1), [points]);

  const [xDomain, setXDomain] = useState([minPossiblePosition, originalMaxPosition]);

  useEffect(() => {
      setXDomain([minPossiblePosition, originalMaxPosition]);
  }, [originalMaxPosition, minPossiblePosition]);

  const getX = (position: number) => ((position - xDomain[0]) / (xDomain[1] - xDomain[0])) * chartWidth;
  const getY = (score: number) => chartHeight - ((score - -1.1) / (1.1 - -1.1)) * chartHeight;

  const pathData = points
    .map((p, i) => {
      const x = getX(p.position);
      const y = getY(p.score);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPathData = `${pathData} L ${getX(points[points.length-1].position).toFixed(2)},${getY(0).toFixed(2)} L ${getX(points[0].position).toFixed(2)},${getY(0).toFixed(2)} Z`;
  
  const visiblePoints = useMemo(() => points.filter(p => p.position >= xDomain[0] && p.position <= xDomain[1]), [points, xDomain]);


  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - padding.left;
      
      const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
      const currentXRange = xDomain[1] - xDomain[0];
      const newXRange = currentXRange * zoomFactor;

      if(newXRange > (originalMaxPosition - minPossiblePosition) * 5 || newXRange < 1) return; // Zoom limits

      const mouseXData = xDomain[0] + (mouseX / chartWidth) * currentXRange;
      
      let newMinX = mouseXData - (mouseX / chartWidth) * newXRange;
      let newMaxX = newMinX + newXRange;

      if (newMinX < minPossiblePosition) {
          newMinX = minPossiblePosition;
          newMaxX = newMinX + newXRange;
      }
      if (newMaxX > originalMaxPosition) {
          newMaxX = originalMaxPosition;
          newMinX = newMaxX - newXRange;
      }

      setXDomain([newMinX, newMaxX]);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = {
          x: e.clientX,
          xDomain: [...xDomain],
      };
      if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning.current) return;
      e.preventDefault();
      
      const dx = e.clientX - panStart.current.x;
      const xRange = panStart.current.xDomain[1] - panStart.current.xDomain[0];
      const xDelta = (dx / chartWidth) * xRange;

      let newMinX = panStart.current.xDomain[0] - xDelta;
      let newMaxX = panStart.current.xDomain[1] - xDelta;
      
      if (newMinX < minPossiblePosition) {
          newMinX = minPossiblePosition;
          newMaxX = newMinX + xRange;
      }
      if (newMaxX > originalMaxPosition) {
          newMaxX = originalMaxPosition;
          newMinX = newMaxX - xRange;
      }
      if (newMinX < minPossiblePosition) newMinX = minPossiblePosition;


      setXDomain([newMinX, newMaxX]);
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<SVGSVGElement>) => {
      if(isPanning.current) {
        isPanning.current = false;
        if (svgRef.current) svgRef.current.style.cursor = 'grab';
      }
  };

  const zoom = (factor: number) => {
      const currentXRange = xDomain[1] - xDomain[0];
      const newXRange = currentXRange * factor;
      const midPoint = xDomain[0] + currentXRange / 2;

      let newMinX = midPoint - newXRange / 2;
      let newMaxX = midPoint + newXRange / 2;
      
      if(newXRange > (originalMaxPosition - minPossiblePosition) || newXRange < 1) return;

      if (newMinX < minPossiblePosition) newMinX = minPossiblePosition;
      if (newMaxX > originalMaxPosition) newMaxX = originalMaxPosition;

      setXDomain([newMinX, newMaxX]);
  };
  
  const resetZoom = () => {
      setXDomain([minPossiblePosition, originalMaxPosition]);
  };
  
  return (
    <div className="bg-white dark:bg-[#2C2C2C] p-4 rounded-lg border border-gray-200 dark:border-white/10 relative group/chart">
        <div className="flex justify-between items-center mb-4">
           <h4 className="text-sm font-bold text-gray-900 dark:text-white">情绪曲线</h4>
           <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-200 dark:bg-black/30 p-1 rounded-md opacity-0 group-hover/chart:opacity-100 transition-opacity">
              <button onClick={() => zoom(0.8)} title="放大" className="p-1 hover:bg-gray-300 dark:hover:bg-white/10 rounded"><ZoomIn size={16}/></button>
              <button onClick={() => zoom(1.25)} title="缩小" className="p-1 hover:bg-gray-300 dark:hover:bg-white/10 rounded"><ZoomOut size={16}/></button>
              <button onClick={resetZoom} title="重置视图" className="p-1 hover:bg-gray-300 dark:hover:bg-white/10 rounded"><Maximize size={16}/></button>
           </div>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-grab"
          aria-labelledby="chart-title"
          role="img"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
            <title id="chart-title">小说情绪推进梯度曲线</title>
            <g transform={`translate(${padding.left}, ${padding.top})`}>
                <defs>
                    <clipPath id="chart-area-clip">
                        <rect x="0" y="-5" width={chartWidth} height={chartHeight + 10} />
                    </clipPath>
                    <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#a8b1ff" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                    </linearGradient>
                </defs>

                {/* Axes and Labels */}
                <line x1="0" y1={getY(0)} x2={chartWidth} y2={getY(0)} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeDasharray="2,2" />
                <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="currentColor" className="text-gray-300 dark:text-gray-600" />
                <text x="-10" y="5" textAnchor="end" className="text-xs fill-current text-green-500">积极</text>
                <text x="-10" y={chartHeight} textAnchor="end" className="text-xs fill-current text-red-500">消极</text>
                <text x="0" y={chartHeight + 15} textAnchor="start" className="text-xs fill-current text-gray-500 dark:text-gray-400">章节 {Math.round(xDomain[0])}</text>
                <text x={chartWidth} y={chartHeight + 15} textAnchor="end" className="text-xs fill-current text-gray-500 dark:text-gray-400">章节 {Math.round(xDomain[1])}</text>

                <g clipPath="url(#chart-area-clip)">
                    {/* Area path */}
                    <path d={areaPathData} fill="url(#emotionGradient)" />

                    {/* Line path */}
                    <path d={pathData} fill="none" stroke="#4f46e5" strokeWidth="2" />

                    {/* Points and Tooltips */}
                    {visiblePoints.map((p, i) => (
                        <g key={i} transform={`translate(${getX(p.position)}, ${getY(p.score)})`} className="group/point" role="tooltip" tabIndex={0} aria-label={`章节 ${p.position}: 得分 ${p.score.toFixed(2)}`}>
                            <circle r="4" fill="#4f46e5" className="cursor-pointer transition-transform group-hover/point:scale-150 group-focus/point:scale-150 outline-none" />
                            <foreignObject x="10" y="-20" width="200" height="150" className="opacity-0 group-hover/point:opacity-100 group-focus/point:opacity-100 transition-opacity pointer-events-none z-10 overflow-visible">
                                <div className="p-2 text-xs bg-gray-800 dark:bg-[#121212] border border-gray-700 dark:border-white/10 text-white rounded-md shadow-lg">
                                    <strong>章节 {p.position}: 得分 {p.score.toFixed(2)}</strong>
                                    <p className="mt-1 font-sans">{p.summary}</p>
                                    <p className="mt-1 font-semibold text-cyan-300 truncate">关键词: {p.keywords.join(', ')}</p>
                                </div>
                            </foreignObject>
                        </g>
                    ))}
                </g>
            </g>
        </svg>
    </div>
  );
};

export default EmotionCurveChart;
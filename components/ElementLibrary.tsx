/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo } from 'react';
import { ProjectData, PreferenceData, PreferenceItem } from '../types.ts';
import { X, Library, Star } from 'lucide-react';

// 元素库沿用偏好库的数据结构,显示默认元素并在有数据分析结果时按热度排序
const defaultElements: PreferenceData = {
    character_emotions: [
        { keyword: '耽美', popularity: 0, description: '男性间的恋爱关系.' },
        { keyword: '言情', popularity: 0, description: '异性间的恋爱关系.' },
        { keyword: '百合', popularity: 0, description: '女性间的恋爱关系.' },
        { keyword: '无cp', popularity: 0, description: '无恋爱关系,专注事业或友情.' },
        { keyword: '多元', popularity: 0, description: '包含多种形式的情感关系.' },
        { keyword: '群像', popularity: 0, description: '描绘众多角色的情感纠葛.' },
    ],
    novel_genres: [
        { keyword: '奇幻', popularity: 0, description: '包含魔法、神话等超自然元素.' },
        { keyword: '都市', popularity: 0, description: '故事背景为现代城市.' },
        { keyword: '历史', popularity: 0, description: '基于真实历史事件或时期.' },
        { keyword: '科幻', popularity: 0, description: '基于科学构想的未来世界.' },
        { keyword: '悬疑', popularity: 0, description: '充满谜团,引导读者解密.' },
        { keyword: '武侠', popularity: 0, description: '中国古代的侠客与江湖.' },
        { keyword: '童话', popularity: 0, description: '面向儿童的幻想故事.' },
    ],
    timeline_clues: [
        { keyword: '近现代', popularity: 0, description: '故事发生在近代或现代.' },
        { keyword: '古代', popularity: 0, description: '故事背景为古代社会.' },
        { keyword: '架空', popularity: 0, description: '虚构的历史或世界背景.' },
        { keyword: '未来', popularity: 0, description: '故事发生在未来.' },
    ],
    narrative_perspectives: [
        { keyword: '第一人称', popularity: 0, description: '以"我"的视角叙述.' },
        { keyword: '第二人称', popularity: 0, description: '以"你"的视角叙述.' },
        { keyword: '第三人称', popularity: 0, description: '以"他/她"的视角叙述.' },
        { keyword: '双视角', popularity: 0, description: '在两个主要角色视角间切换.' },
        { keyword: '多视角', popularity: 0, description: '在多个角色视角间切换.' },
    ],
    main_plots: [
        { keyword: '先婚后爱', popularity: 0, description: '' }, { keyword: '破镜重圆', popularity: 0, description: '' },
        { keyword: '青梅竹马', popularity: 0, description: '' }, { keyword: '相爱相杀', popularity: 0, description: '' },
        { keyword: '失忆重逢', popularity: 0, description: '' }, { keyword: '互换人生', popularity: 0, description: '' },
        { keyword: '时代叙事', popularity: 0, description: '' }, { keyword: '闯关流', popularity: 0, description: '' },
        { keyword: '满级大佬重回新手村', popularity: 0, description: '' }, { keyword: '废柴觉醒', popularity: 0, description: '' },
        { keyword: '重生复仇', popularity: 0, description: '' }, { keyword: '系统空间', popularity: 0, description: '' },
        { keyword: '异世界召唤', popularity: 0, description: '' }, { keyword: '乡土生活', popularity: 0, description: '' },
        { keyword: '权力斗争', popularity: 0, description: '' }, { keyword: '穿越', popularity: 0, description: '' },
        { keyword: '灵异鬼怪', popularity: 0, description: '' }, { keyword: '赛博朋克', popularity: 0, description: '' },
        { keyword: '种田基建', popularity: 0, description: '' },
    ],
    character_traits: [
        { keyword: '万人迷', popularity: 0, description: '' }, { keyword: '温柔', popularity: 0, description: '' },
        { keyword: '高富帅/白富美', popularity: 0, description: '' }, { keyword: '美强惨', popularity: 0, description: '' },
        { keyword: '小人物', popularity: 0, description: '' }, { keyword: '利己', popularity: 0, description: '' },
        { keyword: '学神', popularity: 0, description: '' }, { keyword: '疯批', popularity: 0, description: '' },
        { keyword: '接班人', popularity: 0, description: '' }, { keyword: '迷茫者', popularity: 0, description: '' },
        { keyword: '侠气', popularity: 0, description: '' }, { keyword: '救世主', popularity: 0, description: '' },
        { keyword: '少年意气', popularity: 0, description: '' }, { keyword: '智者', popularity: 0, description: '' },
        { keyword: '掌权人', popularity: 0, description: '' }, { keyword: '隐士', popularity: 0, description: '' },
        { keyword: '冷酷', popularity: 0, description: '' }, { keyword: '反差萌', popularity: 0, description: '' },
        { keyword: '白切黑', popularity: 0, description: '' }, { keyword: '市侩', popularity: 0, description: '' },
    ]
};

const categoryTitles: Record<keyof PreferenceData, string> = {
    character_emotions: '人物情感元素',
    novel_genres: '小说类型元素',
    timeline_clues: '时代线索元素',
    narrative_perspectives: '叙述视角元素',
    main_plots: '主要情节元素',
    character_traits: '角色特点元素',
};

interface ElementLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
}

const PopularityStars: React.FC<{ score: number }> = ({ score }) => {
    const fullStars = Math.floor(score / 2);
    const halfStar = score % 2 >= 1;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return (
        <div className="flex text-yellow-400" title={`热度: ${score}/10`}>
            {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} size={14} fill="currentColor" />)}
            {halfStar && <Star key="half" size={14} fill="currentColor" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0% 100%)' }} />}
            {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} size={14} />)}
        </div>
    );
};

const ElementCategory: React.FC<{ title: string; items: PreferenceItem[]; hasData: boolean }> = ({ title, items, hasData }) => {
    const sortedItems = useMemo(() => {
        if (hasData) {
            return [...items].sort((a, b) => b.popularity - a.popularity);
        }
        return items;
    }, [items, hasData]);
    
    return (
        <div>
            <h3 className="text-md font-semibold mb-2 text-gray-800 dark:text-white">{title}</h3>
            <div className="flex flex-wrap gap-2">
                {sortedItems.map(item => (
                    <div key={item.keyword} title={item.description || '暂无描述'} className="bg-gray-100 dark:bg-black/30 p-2 rounded-lg border border-gray-200 dark:border-white/10 flex items-center gap-2">
                        <span className="text-sm font-medium">{item.keyword}</span>
                        {hasData && <PopularityStars score={item.popularity} />}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ElementLibrary: React.FC<ElementLibraryProps> = ({ isOpen, onClose, project }) => {
  if (!isOpen) return null;

  const elementData = project.preferenceAnalysis || defaultElements;
  const hasAnalysisData = !!project.preferenceAnalysis;

  return (
    <div className="fixed inset-0 modal-overlay bg-black/60 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="element-library-title">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex-shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Library size={20} className="text-indigo-400" />
            <h2 id="element-library-title" className="text-lg font-semibold text-gray-900 dark:text-[#E2E2E2]">
              元素库: {project.projectName}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg白/10" aria-label="关闭元素库">
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
            {!hasAnalysisData && (
                <div className="p-3 text-sm rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/20">
                    注意:当前显示的是默认元素关键词.运行包含"数据分析"节点的工作流后,将显示基于联网分析的热度与推荐.
                </div>
            )}
            {(Object.keys(elementData) as Array<keyof PreferenceData>).map(categoryKey => (
                 <ElementCategory 
                    key={categoryKey}
                    title={categoryTitles[categoryKey]} 
                    items={elementData[categoryKey]}
                    hasData={hasAnalysisData}
                 />
            ))}
        </div>
      </div>
    </div>
  );
};

export default ElementLibrary;
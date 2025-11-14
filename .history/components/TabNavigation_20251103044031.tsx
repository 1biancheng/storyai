/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Folder, PenSquare, FileText, Puzzle, Bot, BookOpen, Settings } from 'lucide-react';

interface TabNavigationProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const NavTab: React.FC<{ icon: React.ElementType, label: string, isActive: boolean, onClick: () => void }> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px ${
      isActive
        ? 'border-blue-500 text-blue-600 dark:text-blue-300 dark:border-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'
    }`}
    aria-current={isActive ? 'page' : undefined}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

const TabNavigation: React.FC<TabNavigationProps> = ({ activeView, setActiveView }) => {
  const allTools = [
    { id: 'project', label: '项目管理', icon: Folder, group: 'creation' },
    { id: 'space', label: '创作空间', icon: PenSquare, group: 'creation' },
    { id: 'space-enhanced', label: '增强创作', icon: Zap, group: 'creation' },
    { id: 'cards', label: '卡片编辑', icon: FileText, group: 'creation' },
    { id: 'splicing', label: '智能拼接', icon: Puzzle, group: 'creation' },
    { id: 'workflow', label: '智能体工作流', icon: Bot, group: 'ai' },
    { id: 'deconstruction', label: '拆书工具', icon: BookOpen, group: 'ai' },
    { id: 'settings', label: '设置', icon: Settings, group: 'system' },
  ];

  const creationTools = allTools.filter(t => t.group === 'creation');
  const aiTools = allTools.filter(t => t.group === 'ai');
  const systemTools = allTools.filter(t => t.group === 'system');

  return (
    <nav className="flex items-center border-b border-gray-200 dark:border-white/10 px-4" role="navigation" aria-label="Main navigation">
        <div className="flex items-center gap-2">
            {creationTools.map(item => (
                <NavTab
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeView === item.id}
                    onClick={() => setActiveView(item.id)}
                />
            ))}
        </div>
        <div className="mx-2 h-6 w-px bg-gray-200 dark:bg-white/10"></div>
        <div className="flex items-center gap-2">
            {aiTools.map(item => (
                <NavTab
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeView === item.id}
                    onClick={() => setActiveView(item.id)}
                />
            ))}
        </div>
        <div className="flex-grow"></div>
        <div className="flex items-center gap-2">
             {systemTools.map(item => (
                <NavTab
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeView === item.id}
                    onClick={() => setActiveView(item.id)}
                />
            ))}
        </div>
    </nav>
  );
};

export default TabNavigation;

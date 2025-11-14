/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import TabNavigation from './components/TabNavigation.tsx';
import DeconstructionTool from './components/DeconstructionTool.tsx';
import WritingSpaceV2 from './components/WritingSpaceV2.tsx';
import ProjectManager from './components/ProjectManager.tsx';
import Settings from './components/Settings.tsx';
import { CardEditor } from './components/CardEditor.tsx';
import AgentWorkflowEditor from './components/AgentWorkflowEditor.tsx';
import StorySplicing from './components/StorySplicing.tsx';
import TimeDisplay from './components/TimeDisplay.tsx';
import * as cardEditorService from './services/cardEditorService';
import AIAssistant from './components/AIAssistant.tsx';
import type { ProjectData } from './types';

// Placeholder component for other views that are not yet implemented
const PlaceholderView: React.FC<{ title: string }> = ({ title }) => (
    <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
        <h2 className="text-2xl font-bold">{title} - Coming Soon</h2>
    </div>
);


const App: React.FC = () => {
    const [activeView, setActiveView] = useState('project');
    const [selectedProject, setSelectedProject] = useState<ProjectData | undefined>(undefined);
    
    useEffect(() => {
        // Initialize default data stores on app load to prevent race conditions.
        cardEditorService.initializeCardEditorData();

        const theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const renderActiveView = () => {
        switch (activeView) {
            case 'splicing':
                return <StorySplicing />;
            case 'project':
                return <ProjectManager onProjectSelect={(project) => {
                    setSelectedProject(project);
                    setActiveView('space');
                }} />;
            case 'space':
                return <WritingSpaceV2 project={selectedProject} />;
            case 'cards':
                return <CardEditor />;
            case 'workflow':
                return <AgentWorkflowEditor />;
            case 'deconstruction':
                return <DeconstructionTool />;
            case 'settings':
                return <Settings />;
            default:
                return <ProjectManager onProjectSelect={(project) => {
                    setSelectedProject(project);
                    setActiveView('space');
                }} />;
        }
    };

    return (
        <div className="h-screen max-h-screen antialiased overflow-hidden bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-[#E2E2E2] flex flex-col">
            <AIAssistant />
            <header className="flex-shrink-0 bg-white dark:bg-[#1E1E1E] z-10 shadow-sm">
                <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                   <h1 className="text-xl font-bold text-gray-900 dark:text-white">小说创作系统</h1>
                   <TimeDisplay className="text-gray-600 dark:text-gray-300" />
                </div>
                <TabNavigation activeView={activeView} setActiveView={setActiveView} />
            </header>

            <main className="flex-grow p-4 overflow-auto min-h-0">
                {renderActiveView()}
            </main>
        </div>
    );
};

export default App;

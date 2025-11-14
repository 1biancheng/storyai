/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Trash2, Sun, Moon, Plus, Save, Info, CheckCircle, Edit, X, Upload, Download, Eraser, TestTube, Loader, AlertCircle, Clock } from 'lucide-react';
import * as modelManager from '../sample_data/services/modelManager.ts';
import * as dataService from '../sample_data/services/dataService.ts'; // Import the new data service
import * as agentService from '../sample_data/services/agentService.ts';
import * as openAIService from '../services/openAIService.ts';
import * as anthropicService from '../services/anthropicService.ts';
import { ModelConfig } from '../types.ts';

const emptyFormState: Omit<ModelConfig, 'id' | 'isDefault'> = {
    name: '',
    modelId: '',
    apiKey: '',
    apiUrl: '',
};

type TestStatus = 'idle' | 'testing' | 'success' | 'error';


const SettingsComponent: React.FC = () => {
    // Determine the initial theme state from localStorage or system preference
    const getInitialTheme = (): 'light' | 'dark' => {
        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme === 'light' || storedTheme === 'dark') {
                return storedTheme;
            }
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        }
        return 'light';
    };

    // 时间设置相关状态
    const getTimeSettings = () => {
        const savedSettings = localStorage.getItem('timeSettings');
        if (savedSettings) {
            return JSON.parse(savedSettings);
        }
        return {
            format: '24h',
            showSeconds: true,
            showDate: false,
            useServerTime: false
        };
    };

    const [theme, setThemeState] = useState<'light' | 'dark'>(getInitialTheme());
    const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
    const [formState, setFormState] = useState(emptyFormState);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [testStatuses, setTestStatuses] = useState<Record<string, { status: TestStatus, message?: string }>>({});
    const [timeSettings, setTimeSettings] = useState(getTimeSettings());
    const importFileRef = useRef<HTMLInputElement>(null);

    const loadModels = () => {
        setModelConfigs(modelManager.getModelConfigs());
    };

    useEffect(() => {
        loadModels();
        window.addEventListener('storage', loadModels);
        return () => window.removeEventListener('storage', loadModels);
    }, []);

    const setTheme = (selectedTheme: 'light' | 'dark') => {
        setThemeState(selectedTheme);
        localStorage.setItem('theme', selectedTheme);
        document.documentElement.classList.toggle('dark', selectedTheme === 'dark');
    };
    
    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) throw new Error("File is empty or could not be read.");
                await dataService.importAllData(text);
                // The import service will alert and reload.
            } catch (error: any) {
                // Don't show an alert if the user simply cancelled the confirmation dialog.
                if (error.message !== 'User cancelled the import.') {
                    alert(`Failed to import data: ${error.message}`);
                }
                console.error("Import error:", error);
            } finally {
                if(importFileRef.current) {
                    importFileRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveModel = () => {
        if (!formState.name || !formState.modelId) {
            alert('模型名称和模型ID是必填项.');
            return;
        }

        let updatedConfigs: ModelConfig[];
        if (editingId) {
            updatedConfigs = modelConfigs.map(config =>
                config.id === editingId ? { ...config, ...formState } : config
            );
        } else {
            const newConfig: ModelConfig = { ...formState, id: crypto.randomUUID(), isDefault: modelConfigs.length === 0 };
            updatedConfigs = [...modelConfigs, newConfig];
        }
        
        modelManager.saveModelConfigs(updatedConfigs);
        loadModels();
        setFormState(emptyFormState);
        setEditingId(null);
    };
    
    const handleEditModel = (config: ModelConfig) => {
        setEditingId(config.id);
        setFormState({
            name: config.name,
            modelId: config.modelId,
            apiKey: config.apiKey,
            apiUrl: config.apiUrl || '',
        });
    };

    const handleDeleteModel = (id: string) => {
        if (window.confirm('您确定要删除此模型配置吗?')) {
            const updatedConfigs = modelConfigs.filter(config => config.id !== id);
            modelManager.saveModelConfigs(updatedConfigs);
            loadModels();
        }
    };

    const handleSetDefault = (id: string) => {
        const updatedConfigs = modelConfigs.map(config => ({
            ...config,
            isDefault: config.id === id
        }));
        modelManager.saveModelConfigs(updatedConfigs);
        loadModels();
    };

    const handleTestModel = async (config: ModelConfig) => {
        setTestStatuses(prev => ({ ...prev, [config.id]: { status: 'testing' } }));
        try {
            const result = config.apiUrl?.includes('anthropic.com')
                ? await anthropicService.testAnthropicModel(config)
                : await openAIService.testOpenAIModel(config);
            
            if (result.success) {
                setTestStatuses(prev => ({ ...prev, [config.id]: { status: 'success' } }));
            } else {
                setTestStatuses(prev => ({ ...prev, [config.id]: { status: 'error', message: result.error } }));
            }
        } catch (e: any) {
            setTestStatuses(prev => ({ ...prev, [config.id]: { status: 'error', message: e.message } }));
        }

        setTimeout(() => {
            setTestStatuses(prev => ({ ...prev, [config.id]: { status: 'idle' } }));
        }, 4000);
    };

    const handleClearCache = () => {
        agentService.clearCache();
        alert('AI 响应缓存已被清除.');
    };

    // 时间设置处理函数
    const handleTimeSettingChange = (key: string, value: any) => {
        const newSettings = { ...timeSettings, [key]: value };
        setTimeSettings(newSettings);
        localStorage.setItem('timeSettings', JSON.stringify(newSettings));
    };
    
    const renderTestButton = (config: ModelConfig) => {
        const status = testStatuses[config.id]?.status || 'idle';
        const message = testStatuses[config.id]?.message;

        const buttonContent: Record<TestStatus, React.ReactNode> = {
            idle: <><TestTube size={14} /><span>测试</span></>,
            testing: <><Loader size={14} className="animate-spin" /><span>测试中</span></>,
            success: <><CheckCircle size={14} /><span>成功</span></>,
            error: <><AlertCircle size={14} /><span>失败</span></>
        };

        const buttonClasses: Record<TestStatus, string> = {
            idle: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
            testing: "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white",
            success: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300",
            error: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
        };

        return (
             <button
                onClick={() => handleTestModel(config)}
                disabled={status === 'testing'}
                title={message}
                className={`flex w-20 items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors ${buttonClasses[status]}`}
            >
                {buttonContent[status]}
            </button>
        );
    };

    return (
        <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full overflow-y-auto text-gray-900 dark:text-[#E2E2E2] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3 mb-6">
                <Settings size={28} className="text-gray-500 dark:text-gray-400" />
                <div>
                    <h2 className="text-2xl font-bold">设置</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">管理应用配置和数据</p>
                </div>
            </div>

            <div className="max-w-2xl space-y-6">
                 <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">外观</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTheme('light')}
                            aria-pressed={theme === 'light'}
                            className={`flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 font-semibold rounded-lg transition-colors ${
                                theme === 'light'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Sun size={16} />
                            <span>浅色</span>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            aria-pressed={theme === 'dark'}
                            className={`flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 font-semibold rounded-lg transition-colors ${
                                theme === 'dark'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Moon size={16} />
                            <span>深色</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Clock size={18} />
                        时间显示设置
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">时间格式</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleTimeSettingChange('format', '12h')}
                                    aria-pressed={timeSettings.format === '12h'}
                                    className={`flex-1 h-10 px-4 py-2 font-medium rounded-lg transition-colors ${
                                        timeSettings.format === '12h'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    12小时制
                                </button>
                                <button
                                    onClick={() => handleTimeSettingChange('format', '24h')}
                                    aria-pressed={timeSettings.format === '24h'}
                                    className={`flex-1 h-10 px-4 py-2 font-medium rounded-lg transition-colors ${
                                        timeSettings.format === '24h'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    24小时制
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={timeSettings.showSeconds}
                                    onChange={(e) => handleTimeSettingChange('showSeconds', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">显示秒数</span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={timeSettings.showDate}
                                    onChange={(e) => handleTimeSettingChange('showDate', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">显示日期</span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={timeSettings.useServerTime}
                                    onChange={(e) => handleTimeSettingChange('useServerTime', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">使用服务器时间</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">模型配置</h3>
                    <div className="space-y-2 mb-4">
                        {modelConfigs.map(config => (
                            <div key={config.id} className="p-3 bg-white dark:bg-[#2C2C2C] rounded-lg border border-gray-200 dark:border-white/5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => handleSetDefault(config.id)} className="flex-shrink-0" aria-label={`Set ${config.name} as default`}>
                                            {config.isDefault ? 
                                                <CheckCircle size={20} className="text-green-500 dark:text-green-400" /> :
                                                <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded-full hover:border-green-400 transition-colors"></div>
                                            }
                                        </button>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{config.name} {config.isDefault && <span className="text-xs text-green-500 dark:text-green-400">(默认)</span>}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{config.modelId}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {renderTestButton(config)}
                                        <button onClick={() => handleEditModel(config)} className="p-1.5 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-white/10" aria-label={`Edit ${config.name}`}><Edit size={14}/></button>
                                        <button onClick={() => handleDeleteModel(config.id)} className="p-1.5 text-red-500 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-500/10" aria-label={`Delete ${config.name}`}><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/20 rounded-b-lg">
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">{editingId ? '编辑模型' : '添加新模型'}</h4>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="model-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型名称 (例如, Claude Sonnet 3.5)</label>
                                <input id="model-name" name="name" value={formState.name} onChange={handleInputChange} placeholder="一个易于识别的名称" className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-white rounded-lg text-sm" />
                            </div>
                             <div>
                                <label htmlFor="model-id" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型 ID (例如, claude-3-5-sonnet-20240620)</label>
                                <input id="model-id" name="modelId" value={formState.modelId} onChange={handleInputChange} placeholder="服务商提供的模型标识符" className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-white rounded-lg text-sm" />
                            </div>
                             <div>
                                <label htmlFor="api-key" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API 密钥</label>
                                <input id="api-key" type="password" name="apiKey" value={formState.apiKey} onChange={handleInputChange} placeholder="您的 API 密钥" className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-white rounded-lg text-sm" />
                            </div>
                             <div>
                                <label htmlFor="api-url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API 地址 (可选)</label>
                                <input id="api-url" name="apiUrl" value={formState.apiUrl} onChange={handleInputChange} placeholder="用于代理或兼容 OpenAI 的服务" className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-white rounded-lg text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleSaveModel} className="flex items-center justify-center gap-2 h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors">
                                <Save size={14} />
                                <span>{editingId ? '更新模型' : '添加模型'}</span>
                            </button>
                            {editingId && (
                                <button onClick={() => { setEditingId(null); setFormState(emptyFormState); }} className="flex items-center justify-center gap-2 h-9 px-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold rounded-lg text-sm transition-colors">
                                  <X size={14} />
                                  <span>取消</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">数据管理</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                       所有项目、卡片和设置数据都存储在您的浏览器本地.您可以将所有数据导出到一个备份文件,或从备份文件中导入数据.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                            onClick={dataService.exportAllData}
                            className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-semibold rounded-lg transition-colors"
                        >
                            <Download size={16} />
                            <span>导出所有数据</span>
                        </button>
                        
                        <label htmlFor="import-data-input" className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 font-semibold rounded-lg transition-colors cursor-pointer">
                            <Upload size={16} />
                            <span>导入所有数据</span>
                        </label>
                        <input id="import-data-input" type="file" accept=".json" className="hidden" onChange={handleImportData} ref={importFileRef} />
                        
                        <button
                            onClick={handleClearCache}
                            className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-300 font-semibold rounded-lg transition-colors"
                        >
                            <Eraser size={16} />
                            <span>清除 AI 缓存</span>
                        </button>
                         <button
                            onClick={dataService.clearAllData}
                            className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 font-semibold rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                            <span>清除所有数据</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsComponent;
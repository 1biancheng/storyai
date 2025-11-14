/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Folder,
    FileText,
    Database,
    Plus,
    Trash2,
    Edit,
    Link2,
    X,
    Lock,
    Search,
    Upload,
    Pencil,
    ChevronRight,
    FolderPlus,
    Download,
    FilePlus2,
    Eye,
    Box,
    Save,
    Loader,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { marked } from 'marked';

import * as cardEditorService from '../sample_data/services/cardEditorService.ts';
import { autoFormatChineseText } from "../sample_data/services/textFormattingService.ts";
import { Scene, PromptCard, FieldModel } from '../types.ts';

// -----------------------------------------------------------------------------
// 公共组件
// -----------------------------------------------------------------------------

const ColumnHeader: React.FC<{
    icon: React.ElementType;
    title: string;
    count?: number;
    onAdd?: () => void;
    addTooltip?: string;
}> = ({ icon: Icon, title, count, onAdd, addTooltip }) => (
    <div className="flex justify-between items-center p-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
            <Icon size={18} className="text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                {title}
                {count !== undefined && ` (${count})`}
            </h3>
        </div>
        {onAdd && (
            <button
                onClick={onAdd}
                title={addTooltip}
                className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
                <Plus size={16} />
            </button>
        )}
    </div>
);

// -----------------------------------------------------------------------------
// 提示词视图
// -----------------------------------------------------------------------------

const CardListColumn: React.FC<{
    className?: string;
    scenes: Scene[];
    cards: PromptCard[];
    selectedCardId: string | null;
    onSelectCard: (id: string | null) => void;
    onAddCard: () => void;
    onDeleteCard: (id: string) => void;
}> = ({ className, scenes, cards, selectedCardId, onSelectCard, onAddCard, onDeleteCard }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const sceneMap = useMemo(() => new Map(scenes.map(scene => [scene.id, scene.name])), [scenes]);

    const filteredCards = useMemo(() => {
        if (!searchQuery) {
            return cards;
        }
        const lower = searchQuery.toLowerCase();
        return cards.filter(card => {
            const sceneName = card.sceneId ? sceneMap.get(card.sceneId) : '未分类';
            return card.name.toLowerCase().includes(lower)
                || (sceneName && sceneName.toLowerCase().includes(lower))
                || card.prompt.toLowerCase().includes(lower);
        });
    }, [cards, sceneMap, searchQuery]);

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredCards.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 58,
        overscan: 6,
    });

    return (
        <div className={`${className} bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-white/10 flex flex-col`}>
            <ColumnHeader icon={FileText} title="提示词卡片" count={cards.length} onAdd={onAddCard} addTooltip="添加新卡片" />
            <div className="px-2 pb-2 flex-shrink-0">
                <div className="relative">
                    <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder="搜索卡片或场景..."
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        className="w-full h-8 pl-8 pr-2 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg text-sm"
                    />
                </div>
            </div>
            <div ref={parentRef} className="flex-grow overflow-y-auto pr-1">
                {filteredCards.length === 0 ? (
                    <p className="p-2 text-sm text-center text-gray-400">
                        {searchQuery ? '无匹配卡片' : '无卡片'}
                    </p>
                ) : (
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map(virtualItem => {
                            const card = filteredCards[virtualItem.index];
                            if (!card) {
                                return null;
                            }
                            const cardSceneName = card.sceneId ? sceneMap.get(card.sceneId) : '未分类';
                            return (
                                <div
                                    key={card.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                        paddingBottom: '6px',
                                    }}
                                >
                                    <div
                                        onClick={() => onSelectCard(card.id)}
                                        className={`group flex items-start justify-between p-2 rounded-md cursor-pointer h-full ${selectedCardId === card.id ? 'bg-blue-100 dark:bg-black/30' : 'hover:bg-gray-200 dark:hover:bg-white/10'}`}
                                    >
                                        <div className="flex-grow truncate">
                                            <div className="flex items-center gap-1.5" title={card.name}>
                                                {card.isDefault && (
                                                    <Lock size={12} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                                )}
                                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{card.name}</p>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1 truncate" title={cardSceneName}>
                                                {cardSceneName}
                                            </p>
                                        </div>
                                        {!card.isDefault && (
                                            <button
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    onDeleteCard(card.id);
                                                }}
                                                title="删除卡片"
                                                className="p-1 rounded text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const SceneOption: React.FC<{ scene: Scene; allScenes: Scene[]; level: number }> = ({ scene, allScenes, level }) => {
    const children = useMemo(() => allScenes.filter(candidate => candidate.parentId === scene.id), [allScenes, scene.id]);
    const prefix = '\u00A0\u00A0\u00A0'.repeat(level);

    return (
        <>
            <option value={scene.id}>{prefix}{scene.name}</option>
            {children.map(child => (
                <SceneOption key={child.id} scene={child} allScenes={allScenes} level={level + 1} />
            ))}
        </>
    );
};

const CardEditorColumn: React.FC<{
    className?: string;
    selectedCard: PromptCard | null;
    scenes: Scene[];
    models: FieldModel[];
    onUpdateCard: (id: string, updates: Partial<PromptCard>) => void;
}> = ({ className, selectedCard, scenes, models, onUpdateCard }) => {
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [cursorPosition, setCursorPosition] = useState<number | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [isFormatting, setIsFormatting] = useState(false);

    const linkedModel = useMemo(() => models.find(model => model.id === selectedCard?.linkedModelId), [models, selectedCard]);
    const topLevelScenes = useMemo(() => scenes.filter(scene => scene.parentId === null), [scenes]);

    useEffect(() => {
        if (cursorPosition !== null && promptTextareaRef.current) {
            promptTextareaRef.current.focus();
            promptTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
            setCursorPosition(null);
        }
    }, [cursorPosition, selectedCard?.prompt]);

    if (!selectedCard) {
        return (
            <div className={`${className} col-span-7 flex items-center justify-center text-gray-400`}>
                选择要编辑的卡片
            </div>
        );
    }

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = loadEvent => onUpdateCard(selectedCard.id, { prompt: (loadEvent.target?.result as string) ?? '' });
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleInsertField = (fieldName: string) => {
        const textarea = promptTextareaRef.current;
        if (!textarea) {
            return;
        }
        const token = `{{${fieldName}}}`;
        const { selectionStart, selectionEnd, value } = textarea;
        onUpdateCard(selectedCard.id, {
            prompt: `${value.substring(0, selectionStart)}${token}${value.substring(selectionEnd)}`,
        });
        setCursorPosition(selectionStart + token.length);
    };

    const handleFormat = () => {
        if (isFormatting) {
            return;
        }
        setIsFormatting(true);
        try {
            const formatted = autoFormatChineseText(selectedCard.prompt);
            onUpdateCard(selectedCard.id, { prompt: formatted, lastModified: new Date().toISOString() });
        } finally {
            setIsFormatting(false);
        }
    };

    return (
        <div className={`${className} p-2 flex flex-col`}>
            <div className="bg-white dark:bg-[#2C2C2C] rounded-md border border-gray-200 dark:border-white/10 p-3 flex flex-col h-full">
                <input
                    type="text"
                    value={selectedCard.name}
                    onChange={event => onUpdateCard(selectedCard.id, { name: event.target.value, lastModified: new Date().toISOString() })}
                    className="w-full text-lg font-semibold bg-transparent border-none focus:ring-0 p-0 mb-2"
                />
                <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                        <Folder size={14} className="text-gray-500 flex-shrink-0" />
                        <select
                            value={selectedCard.sceneId ?? ''}
                            onChange={event => onUpdateCard(selectedCard.id, { sceneId: event.target.value || null, lastModified: new Date().toISOString() })}
                            className="flex-grow py-1 text-sm bg-transparent border-none focus:ring-0 p-0 w-full"
                        >
                            <option value="">未分类</option>
                            {topLevelScenes.map(scene => (
                                <SceneOption key={scene.id} scene={scene} allScenes={scenes} level={0} />
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link2 size={14} className="text-gray-500 flex-shrink-0" />
                        <select
                            value={selectedCard.linkedModelId ?? ''}
                            onChange={event => onUpdateCard(selectedCard.id, { linkedModelId: event.target.value || null, lastModified: new Date().toISOString() })}
                            className="flex-grow py-1 text-sm bg-transparent border-none focus:ring-0 p-0 w-full"
                        >
                            <option value="">链接到模型...</option>
                            {models.map(model => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {linkedModel && (
                    <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1">模型字段</p>
                        <div className="flex flex-wrap gap-1">
                            {linkedModel.fields.map(field => (
                                <button
                                    key={field.id}
                                    onClick={() => handleInsertField(field.name)}
                                    className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 text-xs rounded-full hover:bg-blue-200"
                                >
                                    {field.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <textarea
                    ref={promptTextareaRef}
                    value={selectedCard.prompt}
                    onChange={event => onUpdateCard(selectedCard.id, { prompt: event.target.value, lastModified: new Date().toISOString() })}
                    className="flex-grow w-full bg-gray-100 dark:bg-[#121212] p-2 rounded-md text-sm resize-none border-none focus:ring-1 focus:ring-blue-400"
                    placeholder="在此处输入提示词..."
                />
                <div className="mt-2 flex flex-wrap gap-2">
                    <button
                        onClick={handleFormat}
                        disabled={isFormatting}
                        className="flex-1 min-w-[120px] px-2 py-1 text-xs font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isFormatting ? <Loader size={12} className="animate-spin" /> : '格式化'}
                    </button>
                    <button
                        onClick={() => importFileRef.current?.click()}
                        className="flex-1 min-w-[120px] px-2 py-1 text-xs font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center gap-1"
                    >
                        <Upload size={12} />
                        导入文件
                    </button>
                    <input
                        ref={importFileRef}
                        type="file"
                        accept=".txt,.md"
                        onChange={handleFileImport}
                        className="hidden"
                    />
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// 主组件
// -----------------------------------------------------------------------------

export const CardEditor: React.FC = () => {
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [cards, setCards] = useState<PromptCard[]>([]);
    const [models, setModels] = useState<FieldModel[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

    const selectedCard = useMemo(() => cards.find(card => card.id === selectedCardId) ?? null, [cards, selectedCardId]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [scenesData, cardsData, modelsData] = await Promise.all([
                    cardEditorService.getScenes(),
                    cardEditorService.getPromptCards(),
                    cardEditorService.getFieldModels(),
                ]);
                setScenes(scenesData);
                setCards(cardsData);
                setModels(modelsData);
            } catch (error) {
                console.error('加载数据失败:', error);
            }
        };
        loadData();
    }, []);

    const handleAddCard = async () => {
        try {
            const newCard = await cardEditorService.createPromptCard({
                name: '新卡片',
                prompt: '',
                sceneId: null,
                linkedModelId: null,
                isDefault: false,
            });
            setCards(prev => [...prev, newCard]);
            setSelectedCardId(newCard.id);
        } catch (error) {
            console.error('创建卡片失败:', error);
        }
    };

    const handleUpdateCard = async (id: string, updates: Partial<PromptCard>) => {
        try {
            const updatedCard = await cardEditorService.updatePromptCard(id, updates);
            setCards(prev => prev.map(card => card.id === id ? updatedCard : card));
        } catch (error) {
            console.error('更新卡片失败:', error);
        }
    };

    const handleDeleteCard = async (id: string) => {
        try {
            await cardEditorService.deletePromptCard(id);
            setCards(prev => prev.filter(card => card.id !== id));
            if (selectedCardId === id) {
                setSelectedCardId(null);
            }
        } catch (error) {
            console.error('删除卡片失败:', error);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100 dark:bg-black">
            <div className="flex-grow grid grid-cols-12 gap-4 p-4">
                <CardListColumn
                    className="col-span-5"
                    scenes={scenes}
                    cards={cards}
                    selectedCardId={selectedCardId}
                    onSelectCard={setSelectedCardId}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                />
                <CardEditorColumn
                    className="col-span-7"
                    selectedCard={selectedCard}
                    scenes={scenes}
                    models={models}
                    onUpdateCard={handleUpdateCard}
                />
            </div>
        </div>
    );
};
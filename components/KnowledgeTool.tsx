import React, { useState } from 'react';
import { Search, Plus, Folder, FileText, BookOpen, Users, MapPin, Star, ChevronRight, ChevronDown, Edit, Trash2, Eye, Download, Upload, Filter, Grid, List } from 'lucide-react';

// 知识库项目接口
interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'chapter' | 'character' | 'plot' | 'custom';
  tags: string[];
  content?: string;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  metadata?: Record<string, any>;
}

// 知识库分类接口
interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  itemCount: number;
}

interface KnowledgeToolProps {
  onKnowledgeSelect?: (item: KnowledgeItem) => void;
  onKnowledgeEdit?: (item: KnowledgeItem) => void;
  className?: string;
}

// 预定义知识库分类
const knowledgeCategories: KnowledgeCategory[] = [
  {
    id: 'chapter',
    name: '章节知识',
    description: '小说章节相关知识和参考',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'blue',
    itemCount: 24
  },
  {
    id: 'character',
    name: '角色知识',
    description: '角色设定和相关信息',
    icon: <Users className="w-5 h-5" />,
    color: 'green',
    itemCount: 18
  },
  {
    id: 'plot',
    name: '情节知识',
    description: '情节构思和参考案例',
    icon: <FileText className="w-5 h-5" />,
    color: 'purple',
    itemCount: 32
  },
  {
    id: 'worldview',
    name: '世界观',
    description: '世界背景和设定资料',
    icon: <MapPin className="w-5 h-5" />,
    color: 'orange',
    itemCount: 15
  },
  {
    id: 'custom',
    name: '自建资料',
    description: '个人创作资料库',
    icon: <Folder className="w-5 h-5" />,
    color: 'gray',
    itemCount: 0
  }
];

// 模拟知识库数据
const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: '1',
    title: '小说开篇写作技巧',
    description: '如何写出引人入胜的小说开篇',
    category: 'chapter',
    type: 'chapter',
    tags: ['写作技巧', '开篇', '小说'],
    content: '小说开篇是吸引读者的关键...',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
    isFavorite: true
  },
  {
    id: '2',
    title: '主角性格设定模板',
    description: '完整的主角性格设定参考模板',
    category: 'character',
    type: 'character',
    tags: ['角色', '主角', '性格'],
    content: '主角性格设定应该包含以下几个方面...',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 1,
    isFavorite: false
  },
  {
    id: '3',
    title: '经典情节结构分析',
    description: '分析经典小说的情节结构',
    category: 'plot',
    type: 'plot',
    tags: ['情节', '结构', '分析'],
    content: '经典情节结构通常包含以下几个部分...',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 4,
    isFavorite: true
  }
];

const KnowledgeTool: React.FC<KnowledgeToolProps> = ({
  onKnowledgeSelect,
  onKnowledgeEdit,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(mockKnowledgeItems);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  // 切换分类展开状态
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // 选择分类
  const selectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedItem(null);
  };

  // 选择知识项
  const selectKnowledgeItem = (item: KnowledgeItem) => {
    setSelectedItem(item);
    if (onKnowledgeSelect) {
      onKnowledgeSelect(item);
    }
  };

  // 编辑知识项
  const editKnowledgeItem = (item: KnowledgeItem) => {
    setEditingItem(item);
    setIsCreatingItem(false);
  };

  // 创建新知识项
  const createKnowledgeItem = () => {
    const newItem: KnowledgeItem = {
      id: Date.now().toString(),
      title: '新知识项',
      description: '',
      category: selectedCategory || 'custom',
      type: 'custom',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false
    };
    
    setEditingItem(newItem);
    setIsCreatingItem(true);
  };

  // 保存知识项
  const saveKnowledgeItem = () => {
    if (!editingItem) return;
    
    if (isCreatingItem) {
      setKnowledgeItems(prev => [...prev, editingItem]);
    } else {
      setKnowledgeItems(prev => 
        prev.map(item => 
          item.id === editingItem.id 
            ? { ...editingItem, updatedAt: Date.now() }
            : item
        )
      );
    }
    
    if (onKnowledgeEdit) {
      onKnowledgeEdit(editingItem);
    }
    
    setEditingItem(null);
    setIsCreatingItem(false);
  };

  // 删除知识项
  const deleteKnowledgeItem = (itemId: string) => {
    setKnowledgeItems(prev => prev.filter(item => item.id !== itemId));
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  // 切换收藏状态
  const toggleFavorite = (itemId: string) => {
    setKnowledgeItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, isFavorite: !item.isFavorite }
          : item
      )
    );
  };

  // 过滤知识项
  const filteredKnowledgeItems = knowledgeItems.filter(item => {
    // 按分类过滤
    if (selectedCategory && item.category !== selectedCategory) {
      return false;
    }
    
    // 按搜索查询过滤
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }
    
    // 按收藏状态过滤
    if (showFavoritesOnly && !item.isFavorite) {
      return false;
    }
    
    return true;
  });

  // 获取分类颜色
  const getCategoryColor = (categoryId: string) => {
    const category = knowledgeCategories.find(c => c.id === categoryId);
    return category ? category.color : 'gray';
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <BookOpen className="w-4 h-4 mr-2" />
          知识库工具
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          查找和管理创作资料和参考内容
        </p>
      </div>
      
      <div className="flex flex-col h-96">
        {/* 搜索和筛选栏 */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索知识库..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`p-1.5 rounded-md ${
                showFavoritesOnly 
                  ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' 
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={showFavoritesOnly ? "显示全部" : "只显示收藏"}
            >
              <Star className="w-4 h-4" fill={showFavoritesOnly ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              title={viewMode === 'grid' ? "列表视图" : "网格视图"}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 分类列表 */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">分类</h4>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`text-xs px-2 py-1 rounded ${
                    selectedCategory === null 
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  全部
                </button>
              </div>
              
              <div className="space-y-1">
                {knowledgeCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => selectCategory(category.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors flex items-center justify-between ${
                      selectedCategory === category.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`mr-2 text-${category.color}-500`}>
                        {category.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{category.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {category.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                      {category.itemCount}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 知识项列表 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedCategory 
                  ? `${knowledgeCategories.find(c => c.id === selectedCategory)?.name} (${filteredKnowledgeItems.length})`
                  : `全部知识 (${filteredKnowledgeItems.length})`
                }
              </h4>
              <button
                onClick={createKnowledgeItem}
                className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                title="新建知识项"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3">
              {editingItem ? (
                // 编辑模式
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      标题
                    </label>
                    <input
                      type="text"
                      value={editingItem.title}
                      onChange={(e) => setEditingItem({...editingItem, title: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      描述
                    </label>
                    <textarea
                      value={editingItem.description}
                      onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      分类
                    </label>
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {knowledgeCategories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      标签 (用逗号分隔)
                    </label>
                    <input
                      type="text"
                      value={editingItem.tags.join(', ')}
                      onChange={(e) => setEditingItem({
                        ...editingItem, 
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setIsCreatingItem(false);
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveKnowledgeItem}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : selectedItem ? (
                // 详情模式
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                      {selectedItem.title}
                    </h3>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => toggleFavorite(selectedItem.id)}
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={selectedItem.isFavorite ? "取消收藏" : "添加收藏"}
                      >
                        <Star className="w-4 h-4" fill={selectedItem.isFavorite ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => editKnowledgeItem(selectedItem)}
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteKnowledgeItem(selectedItem.id)}
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`px-2 py-0.5 rounded-full bg-${getCategoryColor(selectedItem.category)}-100 text-${getCategoryColor(selectedItem.category)}-600 dark:bg-${getCategoryColor(selectedItem.category)}-900/30 dark:text-${getCategoryColor(selectedItem.category)}-400`}>
                      {knowledgeCategories.find(c => c.id === selectedItem.category)?.name}
                    </span>
                    <span>创建于 {formatDate(selectedItem.createdAt)}</span>
                    {selectedItem.updatedAt !== selectedItem.createdAt && (
                      <span>更新于 {formatDate(selectedItem.updatedAt)}</span>
                    )}
                  </div>
                  
                  {selectedItem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedItem.description}
                  </p>
                  
                  {selectedItem.content && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {selectedItem.content}
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="w-full py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    返回列表
                  </button>
                </div>
              ) : (
                // 列表模式
                <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-2"}>
                  {filteredKnowledgeItems.length > 0 ? (
                    filteredKnowledgeItems.map(item => (
                      <div
                        key={item.id}
                        onClick={() => selectKnowledgeItem(item)}
                        className={`p-3 border border-gray-200 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          viewMode === 'list' ? 'flex items-center justify-between' : ''
                        }`}
                      >
                        <div className={viewMode === 'list' ? 'flex-1' : ''}>
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {item.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              className="ml-2 p-0.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                              title={item.isFavorite ? "取消收藏" : "添加收藏"}
                            >
                              <Star className="w-3 h-3" fill={item.isFavorite ? "currentColor" : "none"} />
                            </button>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full bg-${getCategoryColor(item.category)}-100 text-${getCategoryColor(item.category)}-600 dark:bg-${getCategoryColor(item.category)}-900/30 dark:text-${getCategoryColor(item.category)}-400`}>
                              {knowledgeCategories.find(c => c.id === item.category)?.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(item.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8">
                      <div className="text-gray-400 dark:text-gray-500 mb-2">
                        <BookOpen className="w-8 h-8 mx-auto" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {searchQuery || showFavoritesOnly || selectedCategory
                          ? '没有找到匹配的知识项'
                          : '暂无知识项,点击右上角的 + 按钮创建'
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeTool;
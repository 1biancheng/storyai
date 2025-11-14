import React, { useState } from 'react';
import { Search, Globe, Clock, TrendingUp, ExternalLink, Loader2, X } from 'lucide-react';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  publishedTime?: string;
  relevanceScore?: number;
}

interface WebSearchToolProps {
  onSearchResultSelect?: (result: SearchResult) => void;
  onQuerySubmit?: (query: string) => void;
  className?: string;
  currentProject?: {
    projectName?: string;
    projectGenre?: string;
    id?: string;
  } | null;
  currentChapterId?: string | null;
}

const WebSearchTool: React.FC<WebSearchToolProps> = ({ 
  onSearchResultSelect, 
  onQuerySubmit,
  className = '',
  currentProject = null,
  currentChapterId = null
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);

  // 真实的网络搜索功能
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setShowHistory(false);
    
    // 添加到搜索历史
    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(item => item !== query)];
      return newHistory.slice(0, 5); // 只保留最近5次搜索
    });
    
    // 直接使用AI增强搜索(Moonshot API内置搜索工具)
    await handleKimiSearch();
  };
  
  // Kimi AI智能搜索(优先使用Moonshot API的内置搜索工具获取最新信息)
  const handleKimiSearch = async () => {
    try {
      // 使用Moonshot API的内置网络搜索工具(优先级最高)
      // 构建搜索上下文
      let searchContext = '';
      if (currentProject?.projectGenre) {
        searchContext = `当前创作的小说类型是:${currentProject.projectGenre}.`;
        if (currentProject.projectName) {
          searchContext += `项目名称:${currentProject.projectName}.`;
        }
      }
      
      // 获取章节内容作为AI可以直接访问的信息源
      let chapterInfo = '';
      if (currentProject?.id && currentChapterId) {
        try {
          const chapterResponse = await axios.get(`/api/v1/chapters/${currentChapterId}`);
          if (chapterResponse.data) {
            const chapter = chapterResponse.data;
            chapterInfo = `当前章节信息:\n标题: ${chapter.title}\n内容: ${chapter.content || ''}`;
          }
        } catch (chapterError) {
          console.warn('获取章节内容失败:', chapterError);
        }
      }
            
      // 将章节信息作为AI可以直接访问的信息源，而不是仅仅作为搜索上下文
      const enhancedQuery = searchContext ? 
        `${searchContext}

${chapterInfo}

请基于以上项目和章节信息，帮我搜索:${query}` : 
        `${chapterInfo}\n\n请基于以上章节信息，帮我搜索:${query}`;
            
      const response = await axios.post('/api/ai/chat', {
        message: enhancedQuery,
        enable_search: true,
        model: 'moonshot-v1-8k',
        system_prompt: '你是一个专业的小说创作素材搜索助手。请使用网络搜索工具帮助用户查找小说创作相关的资料，包括：情节设定、人物原型、世界观参考、专业知识、历史背景、文化习俗、场景描写素材、网文常见套路等。搜索结果应该对小说创作有实用价值，可以包含经典作品参考、真实案例、专业资料等。如果用户提供了小说类型，请结合该类型的特点和常见元素进行搜索，例如：仙侠小说关注修炼体系、武功招式、丹药法宝；现代言情关注职场设定、情感档案；科幻关注科技设定、未来社会等。请基于搜索结果提供详细、有创作参考价值的回答，并在适当时标注信息来源。不要包含任何新闻类内容，专注于小说创作元素。你可以直接访问用户提供的项目信息和当前章节内容，将这些信息作为搜索和分析的基础。'
      });
      
      if (response.data.success) {
        const aiResponse = response.data.data?.response || '';
        
        // 将AI回答转换为搜索结果格式
        const aiResult: SearchResult = {
          id: 'ai-1',
          title: `小说素材搜索: ${query}`,
          url: '#',
          snippet: aiResponse,
          domain: 'AI创作助手 (Moonshot)',
          publishedTime: new Date().toISOString().split('T')[0],
          relevanceScore: 98
        };
        
        setSearchResults([aiResult]);
        
        // 通知父组件搜索完成
        if (onQuerySubmit) {
          onQuerySubmit(`AI搜索完成: ${query}`);
        }
      }
    } catch (error) {
      console.error('Kimi搜索失败:', error);
      // 如果AI搜索也失败了,显示友好的错误信息
      const errorResult: SearchResult = {
        id: 'error-1',
        title: '搜索服务暂时不可用',
        url: '#',
        snippet: '抱歉,搜索服务暂时不可用.请稍后再试,或者尝试使用其他工具.',
        domain: '系统提示',
        relevanceScore: 0
      };
      setSearchResults([errorResult]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result.id);
    if (onSearchResultSelect) {
      onSearchResultSelect(result);
    }
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    handleSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <Globe className="w-4 h-4 mr-2" />
          小说创作素材搜索
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          专为小说创作设计的AI智能搜索工具
        </p>
        {currentProject?.projectGenre && (
          <div className="mt-2 flex items-center">
            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              {currentProject.projectGenre}
            </span>
            {currentProject.projectName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 truncate">
                {currentProject.projectName}
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        {/* 搜索输入框 */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
            onKeyDown={handleKeyPress}
            placeholder="搜索小说素材、情节参考、人物设定..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {/* 搜索历史下拉框 */}
          {showHistory && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
              <div className="p-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  最近搜索
                </div>
                {searchHistory.map((historyQuery, index) => (
                  <button
                    key={index}
                    onClick={() => handleHistoryClick(historyQuery)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    {historyQuery}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              搜索中...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              AI智能搜索
            </>
          )}
        </button>
        
        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              搜索结果 ({searchResults.length})
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedResult === result.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {result.title}
                      </h4>
                      <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="truncate">{result.domain}</span>
                        {result.publishedTime && (
                          <>
                            <span className="mx-1">•</span>
                            <span>{result.publishedTime}</span>
                          </>
                        )}
                        {result.relevanceScore && (
                          <>
                            <span className="mx-1">•</span>
                            <span>相关度: {result.relevanceScore}%</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {result.id.startsWith('ai-') ? (
                          <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        marked.parse(result.snippet, { breaks: true }) as string
                      )
                    }}
                  />
                        ) : (
                          <p className="line-clamp-2">{result.snippet}</p>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 无搜索结果提示 */}
        {!isSearching && query && searchResults.length === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">未找到与 "{query}" 相关的结果</p>
            <p className="text-xs mt-1">请尝试使用不同的关键词</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebSearchTool;
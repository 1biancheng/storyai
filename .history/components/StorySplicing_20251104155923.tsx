import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, StopCircle, List, Save, Loader2, Puzzle, BookOpen, Trash2, Filter } from 'lucide-react';
import { generateStoryStream, listFormulas, upsertFormula, ingestStoryText, getStoryCategories, submitSplicingFeedback } from '../services/storyService.ts';
import { FeedbackPanel } from './StorySplicing/FeedbackPanel.tsx';
import { RLConfigCard } from './StorySplicing/RLConfigCard.tsx';
import { getCurrentTimestamp } from '../utils/timeUtils.ts';

type FormulaItem = {
  id?: number | string;
  name: string;
  expression: string;
  category?: string;
  description?: string;
  parameters?: Record<string, any>;
};

const StorySplicing: React.FC = () => {
  const [availableFormulas, setAvailableFormulas] = useState<FormulaItem[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | number | undefined>(undefined);
  const [formulaText, setFormulaText] = useState<string>('');
  const [promptText, setPromptText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('idle');
  const [errorText, setErrorText] = useState<string>('');
  const [eventLog, setEventLog] = useState<Array<{ event: string; data?: any; ts: number }>>([]);
  const [appendCount, setAppendCount] = useState<number>(0);
  const [formulaCategory, setFormulaCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const closeRef = useRef<() => void>();

  // 结构化公式字段
  const [query, setQuery] = useState<string>('');
  const [topK, setTopK] = useState<number>(10);
  const [threshold, setThreshold] = useState<number>(0.7);
  const [order, setOrder] = useState<string>('similarity_desc');
  const [bookId, setBookId] = useState<string>('');
  const [metaFilters, setMetaFilters] = useState<Array<{ key: string; values: string }>>([]);
  
  // ComRAG 质心式记忆机制字段
  const [comragMode, setComragMode] = useState<string>('retrieve_high');
  const [updateMemory, setUpdateMemory] = useState<boolean>(true);
  const [qualityThreshold, setQualityThreshold] = useState<number>(0.7);
  const [staticKb, setStaticKb] = useState<boolean>(true);
  
  // ComRAG 上下文统计
  const [comragContext, setComragContext] = useState<{mode: string; high_count: number; static_count: number; low_count: number; total_count: number} | null>(null);
  const [scoreResult, setScoreResult] = useState<{score: number; threshold: number; quality?: string; success?: boolean} | null>(null);
  
  // 段落来源统计
  const [sourceStats, setSourceStats] = useState<{book_id: string; count: number; percentage: number}[]>([]);
  
  // RL强化学习配置
  const [rlEnabled, setRlEnabled] = useState<boolean>(false);
  const [explorationRate, setExplorationRate] = useState<number>(0.1);
  const [learningRate, setLearningRate] = useState<number>(0.1);
  const [qStats, setQStats] = useState<{avgQValue: number; qVariance: number; updateCount: number} | undefined>(undefined);
  
  // 用户反馈
  const [splicingId, setSplicingId] = useState<string>('');
  const [paragraphIds, setParagraphIds] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  
  // 模板列表
  const [templates, setTemplates] = useState<Array<{name: string; description: string; query: string}>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // 测试运行模式
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // 加载文学类别列表
  useEffect(() => {
    (async () => {
      try {
        const resp = await getStoryCategories();
        const cats: string[] = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setAvailableCategories(cats);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    })();
  }, []);
  
  // 加载公式模板列表
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/v1/story/templates');
        const data = await resp.json();
        if (data.code === 0 && Array.isArray(data.data)) {
          setTemplates(data.data);
        }
      } catch (err) {
        console.error('Failed to load templates', err);
      }
    })();
  }, []);

  // 加载公式列表
  useEffect(() => {
    (async () => {
      try {
        const resp = await listFormulas(formulaCategory || undefined);
        const items: FormulaItem[] = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setAvailableFormulas(items);
      } catch (err) {
        console.error('Failed to load formulas', err);
      }
    })();
  }, [formulaCategory]);

  // 根据选择填充公式文本
  const handleSelectFormula = useCallback((idOrName: string) => {
    setSelectedFormulaId(idOrName);
    const found = availableFormulas.find(f => String(f.id ?? f.name) === idOrName);
    if (found) {
      setFormulaText(found.expression || '');
    }
  }, [availableFormulas]);

  const startStreaming = useCallback(() => {
    setOutputText('');
    setErrorText('');
    setAppendCount(0);
    setEventLog([]);
    setComragContext(null);  // 清空ComRAG上下文
    setScoreResult(null);  // 清空评分结果
    setSourceStats([]);  // 清空来源统计
    setIsRunning(true);
    setStatusText('connecting');
    
    // 段落来源跟踪
    const sourceMap = new Map<string, number>();
    
    // 通过 GET /api/story/generate/stream?formula=...&prompt=... 启动流
    closeRef.current = generateStoryStream(formulaText, promptText, {
      onMessage: (data: any) => {
        const evt = (data && data.__event__) || 'message';
        setEventLog((prev) => [...prev, { event: evt, data, ts: Date.now() }]);
        if (evt === 'step') {
          const msg = data?.msg || data?.step;
          setStatusText(msg ? `step: ${msg}` : 'step');
        } else if (evt === 'ctx') {
          // ComRAG 上下文事件
          setComragContext({
            mode: data?.mode || 'retrieve_high',
            high_count: data?.high_count || 0,
            static_count: data?.static_count || 0,
            low_count: data?.low_count || 0,
            total_count: data?.total_count || 0
          });
          setStatusText(`ComRAG: ${data?.mode} | 高质:${data?.high_count} 静态:${data?.static_count} 低质:${data?.low_count}`);
        } else if (evt === 'scored') {
          // LLM评分事件
          setScoreResult({
            score: data?.score || 0,
            threshold: data?.threshold || 0.7
          });
          setStatusText(`评分: ${(data?.score || 0).toFixed(2)} / 阈值: ${data?.threshold}`);
        } else if (evt === 'store_update') {
          // 记忆更新事件
          setScoreResult(prev => prev ? {
            ...prev,
            quality: data?.quality || 'unknown',
            success: data?.success || false
          } : null);
          const status = data?.success ? '✅ 更新成功' : '❌ 更新失败';
          setStatusText(`记忆更新: ${data?.quality} ${status}`);
        } else if (evt === 'append') {
          // 后端 /api/story/generate/stream 的 append 事件载荷为 { paragraph, similarity, quality, book_id }
          const chunk = data?.paragraph ?? data?.text ?? data?.content ?? data?.delta ?? data?.chunk ?? '';
          if (chunk) {
            setOutputText(prev => prev + String(chunk));
            setAppendCount((c) => c + 1);
            
            // 统计段落来源
            const bookId = data?.book_id || data?.source || '未知来源';
            const paragraphId = data?.paragraph_id || data?.id;
            if (paragraphId) {
              setParagraphIds(prev => [...prev, paragraphId]);
            }
            sourceMap.set(bookId, (sourceMap.get(bookId) || 0) + 1);
            
            // 更新来源统计
            const total = Array.from(sourceMap.values()).reduce((a, b) => a + b, 0);
            const stats = Array.from(sourceMap.entries()).map(([book_id, count]) => ({
              book_id,
              count,
              percentage: Math.round((count / total) * 100)
            }));
            stats.sort((a, b) => b.count - a.count);
            setSourceStats(stats);
          }
        } else if (evt === 'complete') {
          setStatusText('complete');
          setIsRunning(false);
          setShowFeedback(true);  // 显示反馈面板
          // 主动关闭连接
          closeRef.current?.();
        } else if (evt === 'error') {
          const msg = data?.message || data?.error || '未知错误';
          setErrorText(String(msg));
          setIsRunning(false);
          closeRef.current?.();
        } else if (evt === 'ping') {
          setStatusText('streaming');
        } else {
          // 默认 message 或未标注事件
          const chunk = typeof data === 'string' ? data : data?.text || data?.content || '';
          if (chunk) setOutputText(prev => prev + String(chunk));
        }
      },
      onError: (e: Event) => {
        console.error('SSE error', e);
        setErrorText('SSE 连接错误');
        setIsRunning(false);
      }
    });
  }, [formulaText, promptText]);

  const stopStreaming = useCallback(() => {
    closeRef.current?.();
    setIsRunning(false);
    setStatusText('stopped');
    setShowFeedback(false);
  }, []);



  const handleSaveFormula = useCallback(async () => {
    try {
      const name = typeof selectedFormulaId === 'string' ? selectedFormulaId : `formula_${Date.now()}`;
      const resp = await upsertFormula({ name: String(name), expression: formulaText, category: formulaCategory || undefined });
      // 简单刷新列表
      const list = await listFormulas(formulaCategory || undefined);
      const items: FormulaItem[] = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
      setAvailableFormulas(items);
    } catch (err) {
      console.error('Failed to save formula', err);
    }
  }, [selectedFormulaId, formulaText, formulaCategory]);

  // 从结构化字段生成JSON公式
  const buildFormulaFromFields = useCallback(() => {
    const mf: Record<string, string[]> = {};
    metaFilters.forEach(f => {
      const vals = f.values.split(',').map(v => v.trim()).filter(Boolean);
      if (f.key && vals.length > 0) mf[f.key] = vals;
    });
    const obj: any = {
      query,
      top_k: topK,
      threshold,
      order,
      meta_filters: Object.keys(mf).length > 0 ? mf : undefined,
      book_id: bookId || undefined,
      // ComRAG扩展字段
      comrag_mode: comragMode,
      update_memory: updateMemory,
      quality_threshold: qualityThreshold,
      static_kb: staticKb,
      debug_mode: debugMode,  // 测试运行模式
      // RL强化学习字段
      rl_enabled: rlEnabled,
      exploration_rate: rlEnabled ? explorationRate : undefined,
      learning_rate: rlEnabled ? learningRate : undefined
    };
    // 移除undefined字段
    Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; });
    setFormulaText(JSON.stringify(obj, null, 2));
  }, [query, topK, threshold, order, bookId, metaFilters, comragMode, updateMemory, qualityThreshold, staticKb, debugMode, rlEnabled, explorationRate, learningRate]);
  
  // 应用模板
  const applyTemplate = useCallback((templateName: string) => {
    const template = templates.find(t => t.name === templateName);
    if (!template) return;
    
    setSelectedTemplate(templateName);
    setQuery(template.query || '');
    
    // 直接生成JSON公式
    setFormulaText(`template:${templateName}`);
  }, [templates]);

  const addMetaFilter = useCallback(() => {
    setMetaFilters(prev => [...prev, { key: '', values: '' }]);
  }, []);

  const removeMetaFilter = useCallback((idx: number) => {
    setMetaFilters(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateMetaFilter = useCallback((idx: number, field: 'key' | 'values', val: string) => {
    setMetaFilters(prev => prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  }, []);

  const canStart = useMemo(() => formulaText.trim().length > 0, [formulaText]);
  
  // 处理用户反馈提交
  const handleFeedbackSubmit = useCallback(async (type: string, comment?: string) => {
    try {
      await submitSplicingFeedback({
        splicingId: splicingId || `splicing_${Date.now()}`,
        paragraphIds,
        query: query || promptText,
        feedbackType: type,
        comment
      });
      // 如果反馈成功,可以更新Q值统计(模拟)
      if (rlEnabled && type !== 'store') {
        setQStats(prev => prev ? {
          ...prev,
          updateCount: prev.updateCount + 1
        } : undefined);
      }
    } catch (e) {
      console.error('Failed to submit feedback:', e);
      throw e;
    }
  }, [splicingId, paragraphIds, query, promptText, rlEnabled]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Puzzle className="w-5 h-5" />
        <h2 className="text-xl font-bold">智能拼接</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-3">
          <label className="block text-sm font-medium">选择公式</label>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C]"
              value={selectedFormulaId ? String(selectedFormulaId) : ''}
              onChange={(e) => handleSelectFormula(e.target.value)}
            >
              <option value="">— 选择 —</option>
              {availableFormulas.map(f => (
                <option key={String(f.id ?? f.name)} value={String(f.id ?? f.name)}>{f.name}</option>
              ))}
            </select>
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-200 dark:bg-white/10"
              onClick={handleSaveFormula}
              title="保存当前公式"
            >
              <Save className="w-4 h-4" /> 保存
            </button>
          </div>



          {/* 类别筛选 - 合并小说类型与公式类别 */}
          <div className="flex items-center gap-2 mt-4">
            <Filter className="w-4 h-4" />
            <label className="text-sm font-medium">类别筛选</label>
          </div>
          <select
            className="w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-2 text-sm"
            value={formulaCategory}
            onChange={(e) => setFormulaCategory(e.target.value)}
          >
            <option value="">— 所有类别 —</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            基于文学辞典的类别:对话、描写、剧情等
          </div>

          {/* 公式模板快速选择 */}
          <div className="mt-4 p-3 rounded-md border-2 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 space-y-2">
            <div className="flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-green-600" />
              <label className="text-sm font-semibold text-green-700 dark:text-green-300">快速模板(20+预设)</label>
            </div>
            <select
              className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-2 text-sm"
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">— 选择模板 —</option>
              {templates.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {templates.find(t => t.name === selectedTemplate)?.description}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              快速应用预设场景:复仇开局、初入江湖、清冷女主外貌等
            </div>
          </div>

          <label className="block text-sm font-medium mt-4">公式表达式</label>
          <textarea
            className="w-full h-32 rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-2"
            value={formulaText}
            onChange={(e) => setFormulaText(e.target.value)}
            placeholder="输入公式表达式或使用下方结构化配置生成"
          />

          {/* 结构化公式配置面板 */}
          <div className="mt-4 p-3 rounded-md border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#1C1C1C] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">结构化公式配置</label>
              <button
                onClick={buildFormulaFromFields}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-xs"
              >
                生成JSON公式
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block mb-1">查询(query)</label>
                <input
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="查询文本"
                />
              </div>
              <div>
                <label className="block mb-1">书目ID(book_id)</label>
                <input
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  placeholder="可选"
                />
              </div>
              <div>
                <label className="block mb-1">top_k</label>
                <input
                  type="number"
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block mb-1">threshold</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
              <div className="col-span-2">
                <label className="block mb-1">排序(order)</label>
                <select
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                >
                  <option value="similarity_desc">相似度降序</option>
                  <option value="similarity_asc">相似度升序</option>
                  <option value="position_asc">位置升序</option>
                  <option value="position_desc">位置降序</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">元过滤(meta_filters)</label>
                <button
                  onClick={addMetaFilter}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-xs"
                >
                  + 添加
                </button>
              </div>
              {metaFilters.map((f, idx) => (
                <div key={idx} className="flex gap-1 mb-1">
                  <input
                    className="flex-1 rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1 text-xs"
                    placeholder="键(如category)"
                    value={f.key}
                    onChange={(e) => updateMetaFilter(idx, 'key', e.target.value)}
                  />
                  <input
                    className="flex-1 rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1 text-xs"
                    placeholder="值(逗号分隔)"
                    value={f.values}
                    onChange={(e) => updateMetaFilter(idx, 'values', e.target.value)}
                  />
                  <button
                    onClick={() => removeMetaFilter(idx)}
                    className="px-2 py-0.5 rounded bg-red-600 text-white text-xs"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ComRAG 质心式记忆机制配置 */}
          <div className="mt-4 p-3 rounded-md border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 space-y-2">
            <div className="flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-blue-600" />
              <label className="text-sm font-semibold text-blue-700 dark:text-blue-300">ComRAG 质心式记忆机制</label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <label className="block mb-1 font-medium">运行模式(comrag_mode)</label>
                <select
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1.5"
                  value={comragMode}
                  onChange={(e) => setComragMode(e.target.value)}
                >
                  <option value="retrieve_high">仅高质检索(retrieve_high)</option>
                  <option value="generate_with_high">用高质记忆生成(generate_with_high)</option>
                  <option value="generate_excluding_low">排除低质生成(generate_excluding_low)</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  · 仅高质检索:只从高质量库检索段落<br/>
                  · 用高质记忆生成:LLM结合高质上下文生成<br/>
                  · 排除低质生成:避免低质量库干扰
                </div>
              </div>
              <div>
                <label className="block mb-1">质量阈值(quality_threshold)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className="w-full rounded border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-1"
                  value={qualityThreshold}
                  onChange={(e) => setQualityThreshold(Number(e.target.value))}
                />
                <div className="text-xs text-gray-500 mt-0.5">LLM评分{'>='}阈值入高质量库</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={updateMemory}
                    onChange={(e) => setUpdateMemory(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs">自动更新记忆(update_memory)</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={staticKb}
                    onChange={(e) => setStaticKb(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs">融合静态知识库(static_kb)</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs">🛠️ 测试运行模式(debug_mode)</span>
                </label>
              </div>
            </div>
            {debugMode && (
              <div className="col-span-2 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600">
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  🛠️ <strong>测试模式</strong>:仅返回前3段+元数据分析,不生成完整内容
                </div>
              </div>
            )}
          </div>
          
          {/* RL强化学习配置面板 */}
          <RLConfigCard
            enabled={rlEnabled}
            explorationRate={explorationRate}
            learningRate={learningRate}
            qStats={qStats}
            onEnabledChange={setRlEnabled}
            onExplorationRateChange={setExplorationRate}
            onLearningRateChange={setLearningRate}
          />

          <label className="block text-sm font-medium mt-4">提示词 / 主题</label>
          <textarea
            className="w-full h-24 rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-2"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="输入主题或补充说明"
          />

          <div className="flex gap-2 mt-3">
            <button
              onClick={startStreaming}
              disabled={!canStart || isRunning}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors disabled:bg-gray-500"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              开始拼接
            </button>
            <button
              onClick={stopStreaming}
              disabled={!isRunning}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 dark:bg-white/10 rounded-md"
            >
              <StopCircle className="w-4 h-4" /> 停止
            </button>
            <button
              onClick={() => { setOutputText(''); setAppendCount(0); setEventLog([]); }}
              className="inline-flex items-center justify-center gap-2 h-10 px-3 py-2 bg-gray-100 dark:bg-white/10 rounded-md"
            >
              <Trash2 className="w-4 h-4" /> 清空
            </button>
          </div>

          {errorText && (
            <div className="mt-2 text-sm text-red-600">错误:{errorText}</div>
          )}
          <div className="mt-2 text-xs text-gray-500">状态:{statusText}</div>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-sm font-medium mb-2"><BookOpen className="w-4 h-4" /> 拆书入库</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              拼接功能需要向量段落库支持,向量段落库用于存储和检索文本内容.
              如需将文本拆分并入库向量段落库,请前往"拆书工具"页面完成.
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">拼接输出</label>
          
          {/* ComRAG 上下文统计面板 */}
          {comragContext && (
            <div className="mb-3 p-3 rounded-md border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
                <Puzzle className="w-4 h-4" />
                ComRAG 上下文统计
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">运行模式</div>
                  <div className="font-semibold text-blue-600">{comragContext.mode}</div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">高质量段落</div>
                  <div className="font-semibold text-green-600">{comragContext.high_count}</div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">静态知识</div>
                  <div className="font-semibold text-gray-600">{comragContext.static_count}</div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">总段落数</div>
                  <div className="font-semibold text-blue-600">{comragContext.total_count}</div>
                </div>
              </div>
              {comragContext.low_count > 0 && (
                <div className="mt-2 text-xs text-orange-600">
                  ⚠️ 检测到 {comragContext.low_count} 个低质量段落,已根据模式处理
                </div>
              )}
            </div>
          )}
                    
          {/* LLM评分与记忆更新面板 */}
          {scoreResult && (
            <div className="mb-3 p-3 rounded-md border border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
                <Save className="w-4 h-4" />
                LLM评分与记忆更新
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">评分</div>
                  <div className={`font-semibold text-lg ${
                    scoreResult.score >= scoreResult.threshold ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {scoreResult.score.toFixed(2)}
                  </div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">阈值</div>
                  <div className="font-semibold text-gray-600">{scoreResult.threshold.toFixed(2)}</div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                  <div className="text-gray-500">质量分级</div>
                  <div className={`font-semibold ${
                    scoreResult.quality === 'high' ? 'text-green-600' : 
                    scoreResult.quality === 'low' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {scoreResult.quality === 'high' ? '⬆️ 高质量' : 
                     scoreResult.quality === 'low' ? '⬇️ 低质量' : '⏳ 评估中...'}
                  </div>
                </div>
              </div>
              {scoreResult.success !== undefined && (
                <div className={`mt-2 text-xs ${
                  scoreResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {scoreResult.success ? '✅ 已更新到记忆库' : '❌ 记忆更新失败'}
                </div>
              )}
            </div>
          )}
          
          {/* 段落来源统计可视化面板 */}
          {sourceStats.length > 0 && (
            <div className="mb-3 p-3 rounded-md border border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">
                <BookOpen className="w-4 h-4" />
                段落来源分布({appendCount}段)
              </div>
              <div className="space-y-2">
                {sourceStats.map((stat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {stat.book_id === 'memory_high' ? '💎 高质量库' : 
                           stat.book_id === 'memory_low' ? '⚠️ 低质量库' : 
                           stat.book_id === '未知来源' ? '📚 静态知识库' :
                           `📖 ${stat.book_id}`}
                        </span>
                        <span className="text-gray-500">{stat.count}段 ({stat.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            stat.book_id === 'memory_high' ? 'bg-green-500' :
                            stat.book_id === 'memory_low' ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}
                          style={{width: `${stat.percentage}%`}}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                💡 来源多样化度越高,生成内容越不易被识别为"拼接"
              </div>
            </div>
          )}
          
          <div className="min-h-[320px] rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-4 whitespace-pre-wrap">
            {outputText || <span className="text-gray-400">等待输出...</span>}
          </div>
          <div className="mt-3 text-xs text-gray-500">已追加段落数:{appendCount}</div>
          
          {/* 用户反馈面板 */}
          {showFeedback && outputText && (
            <FeedbackPanel
              splicingId={splicingId || `splicing_${Date.now()}`}
              paragraphIds={paragraphIds}
              query={query || promptText}
              onFeedbackSubmit={handleFeedbackSubmit}
            />
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">事件日志</label>
            <div className="min-h-[160px] rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] p-3 text-xs max-h-[240px] overflow-auto">
              {eventLog.length === 0 ? (
                <div className="text-gray-400">暂无事件...</div>
              ) : (
                <ul className="space-y-1">
                  {eventLog.map((ev, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200">
                        {ev.event}
                      </span>
                      <span className="text-gray-500">
                        {new Date(ev.ts).toLocaleTimeString()}
                      </span>
                      <pre className="flex-1 whitespace-pre-wrap break-all">
                        {typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorySplicing;

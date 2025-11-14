/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * DeconstructionTool - 文件上传与段落处理工具
 * 
 * 缓存架构说明:
 * 1. 浏览器端: 使用 LocalStorage 存储用户偏好、临时数据
 *    - 用户偏好设置 (编码选择、拆分配置等)
 *    - 临时表单数据 (未保存的配置)
 *    - 最近使用的文件列表
 * 2. HTTP 层: 所有 API 响应禁用浏览器缓存 (Cache-Control: no-store)
 * 3. 服务端: 统一使用 Redis 作为唯一缓存层
 *    - 向量计算结果缓存 (7天TTL)
 *    - 文件段落缓存 (7天TTL)
 *    - 会话数据缓存 (1小时TTL)
 * 
 * 数据流向:
 * 浏览器 → API请求 → FastAPI → Redis缓存 → 数据库
 *              ↑         ↓
 *         禁用HTTP缓存  缓存命中? → 返回缓存数据
 *                          ↓ 否
 *                     计算新数据 → 存入Redis → 返回
 */

import React, { useState, useRef } from 'react';
import { BookOpen, BookUp, FileText, Loader, Download, Upload, Bot, Scissors, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { BookAnalysisResult, NarrativeElement, EmotionPoint } from '../types.ts';
import * as agentService from '../services/agentService.ts';
import { ingestStoryText, ingestBookStream, uploadBook, ingestFile } from '../services/storyService.ts';
import EmotionCurveChart from './EmotionCurveChart.tsx';
import yaml from 'js-yaml';
import { CacheType, BrowserCacheManager } from '../services/cacheManager.ts';

// 自定义类型定义，替代Google genai库的类型
interface SchemaProperty {
  description?: string;
  type: string;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface Schema {
  description?: string;
  type: string;
  properties: Record<string, SchemaProperty>;
  required: string[];
}

// --- Sub-components for Displaying Results ---

const NarrativeElements: React.FC<{ title: string, elements: NarrativeElement[], keyName: string, valueName: string }> = ({ title, elements, keyName, valueName }) => {
  if (!elements || elements.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-bold mb-2 text-gray-900 dark:text-white">{title}</h4>
      <div className="space-y-2">
        {elements.map((el, i) => (
          <div key={i} className="bg-gray-100 dark:bg-black/20 p-3 rounded-lg text-sm border border-gray-200 dark:border-white/10">
            <p className="font-semibold text-gray-800 dark:text-white/90">{el[keyName]}</p>
            <p className="text-gray-600 dark:text-white/70 mt-1 text-xs">{el[valueName]}</p>
          </div>
        ))}
      </div>
    </div>
  );
};


const BookAnalysisView: React.FC<{ result: BookAnalysisResult }> = ({ result }) => {
  return (
    <div className="space-y-6">
      <EmotionCurveChart points={result.emotionCurve} />
       <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">整体情绪总结</h3>
          <p className="p-3 bg-gray-100 dark:bg-black/20 rounded-lg text-sm border border-gray-200 dark:border-white/10">{result.overallSentiment}</p>
      </div>
      <NarrativeElements title="关键角色" elements={result.characters} keyName="character" valueName="description" />
      <NarrativeElements title="关键情节" elements={result.plotPoints} keyName="plotPoint" valueName="description" />
      <NarrativeElements title="世界观设定" elements={result.worldBuilding} keyName="element" valueName="description" />
    </div>
  );
};

const SplitTextView: React.FC<{ chunks: { title: string; content: string }[], onExport: () => void }> = ({ chunks, onExport }) => {
    const [copiedChunk, setCopiedChunk] = useState<string | null>(null);
    // Virtual scrolling optimization: only render visible chunks
    const [displayCount, setDisplayCount] = useState(50);
    const [searchTerm, setSearchTerm] = useState('');

    const handleCopy = (content: string, title: string) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedChunk(title);
            setTimeout(() => setCopiedChunk(null), 2000);
        });
    };
    
    // Filter chunks based on search term
    const filteredChunks = React.useMemo(() => {
        if (!searchTerm) return chunks;
        return chunks.filter(c => 
            c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [chunks, searchTerm]);
    
    // Statistics summary
    const stats = React.useMemo(() => {
        const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);
        return {
            totalChunks: chunks.length,
            avgLength: Math.round(totalChars / chunks.length),
            totalChars,
            maxLength: Math.max(...chunks.map(c => c.content.length)),
            minLength: Math.min(...chunks.map(c => c.content.length))
        };
    }, [chunks]);
    
    // Load more handler
    const handleLoadMore = () => {
        setDisplayCount(prev => Math.min(prev + 50, filteredChunks.length));
    };
    
    const visibleChunks = filteredChunks.slice(0, displayCount);
    
    return (
        <div className="h-full flex flex-col">
            {/* Statistics card */}
            <div className="grid grid-cols-3 gap-2 mb-3 flex-shrink-0">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <div className="text-xs text-gray-500">Total Chunks</div>
                    <div className="text-lg font-bold text-blue-600">{stats.totalChunks}</div>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="text-xs text-gray-500">Avg Length</div>
                    <div className="text-lg font-bold text-green-600">{stats.avgLength}</div>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                    <div className="text-xs text-gray-500">Total Chars</div>
                    <div className="text-lg font-bold text-purple-600">{stats.totalChars.toLocaleString()}</div>
                </div>
            </div>
            
            {/* Search and export */}
            <div className="flex gap-2 mb-3 flex-shrink-0">
                <input
                    type="text"
                    placeholder="Search chunks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 h-9 px-3 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded-md"
                />
                <button
                    onClick={onExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    aria-label="Export split chunks as JSON file"
                >
                    <Download size={14} />
                    Export JSON
                </button>
            </div>
            
            {/* Performance warning */}
            {chunks.length > 100 && (
                <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300 flex-shrink-0">
                    ⚠️ Large file detected ({chunks.length} chunks). Using virtual scrolling for better performance.
                </div>
            )}
            
            {/* Big5 encoding warning */}
            {chunks.length > 0 && chunks[0].title.includes('Big5') && (
                <div className="mb-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-xs text-orange-700 dark:text-orange-300 flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle size={14}/>
                    Big5 编码检测:若出现乱码,请手动选择"编码覆盖"为 GBK 或 UTF-8.
                </div>
            )}
            
            {/* Chunk list with virtual scrolling */}
            <div className="space-y-4 overflow-y-auto flex-grow pr-2">
                {visibleChunks.map((chunk, index) => {
                    // 提取 split_method (如果 title 中包含)
                    const splitMethodMatch = chunk.title.match(/\[(.*?)\]/);
                    const splitMethod = splitMethodMatch ? splitMethodMatch[1] : null;
                    const charCount = chunk.content.length;
                    
                    return (
                        <div key={index} className="bg-gray-100 dark:bg-black/20 p-3 rounded-lg border border-gray-200 dark:border-white/10">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-sm text-gray-800 dark:text-white/90">{chunk.title}</h4>
                                    {splitMethod && (
                                        <span className={`px-2 py-0.5 text-[10px] rounded font-mono ${
                                            splitMethod.includes('strong') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            splitMethod.includes('weak') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            splitMethod.includes('semantic') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}>
                                            {splitMethod}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {charCount} 字
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleCopy(chunk.content, chunk.title)}
                                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20"
                                >
                                    {copiedChunk === chunk.title ? <Check size={12} className="text-green-500"/> : <Copy size={12} />}
                                    {copiedChunk === chunk.title ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="text-sm text-gray-700 dark:text-white/80 whitespace-pre-wrap font-sans bg-white dark:bg-[#121212] p-2 rounded max-h-48 overflow-auto">{chunk.content}</pre>
                        </div>
                    );
                })}
                
                {/* Load more button */}
                {displayCount < filteredChunks.length && (
                    <div className="flex justify-center py-4">
                        <button
                            onClick={handleLoadMore}
                            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-md transition-colors"
                        >
                            Load More ({displayCount}/{filteredChunks.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main Component ---

const DeconstructionTool: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    // AI 拆书可选开关(默认关闭)
    const [analysisEnabled, setAnalysisEnabled] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<BookAnalysisResult | null>(null);
    const [splitChunks, setSplitChunks] = useState<{ title: string; content: string }[] | null>(null);
    const [splitMethod, setSplitMethod] = useState<'chapter' | 'wordCount' | 'paragraph'>('chapter');
    const [splitWordCount, setSplitWordCount] = useState(1000);
    const uploadFileRef = useRef<HTMLInputElement>(null);
    // 新增: 入库参数
    const [bookId, setBookId] = useState<string>('');
    const [chapterIndex, setChapterIndex] = useState<number | undefined>(undefined);
    const [sectionIndex, setSectionIndex] = useState<number | undefined>(undefined);
    const [embeddingModel, setEmbeddingModel] = useState<string>('text-embedding-3-small');
    // 新增: 结构保留开关(三件套集成)
    const [preserveStructure, setPreserveStructure] = useState<boolean>(false);
    // 新增: 文件提取元数据显示
    const [fileMetadata, setFileMetadata] = useState<{
        file_hash?: string;
        encoding?: string;
        method?: string;
        structure?: string;
        source_lib?: string;
        confidence?: number;
        document_id?: number;
        total_paragraphs?: number;
        paragraph_ids?: number[];
    } | null>(null);
    // SSE 入库相关状态
    const [useSseIngest, setUseSseIngest] = useState<boolean>(false);
    const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
    const [sseDisconnect, setSseDisconnect] = useState<(() => void) | null>(null);
    // Ingest status management with retry support
    const [ingestStatus, setIngestStatus] = useState<{
        status: 'idle' | 'processing' | 'success' | 'failed';
        message: string;
        bookId?: string;
        failedBatches?: number[];
        currentBatch?: number;
        totalBatches?: number;
        logs?: string[];
    }>({ status: 'idle', message: '', logs: [] });
    // 新增: 编码覆盖与检测日志
    const [encodingOverride, setEncodingOverride] = useState<string>('auto');
    const [encodingDetected, setEncodingDetected] = useState<string | null>(null);
    const [encodingConfidence, setEncodingConfidence] = useState<number | null>(null);
    const [fileReadLogs, setFileReadLogs] = useState<string[]>([]);
    const [filePreview, setFilePreview] = useState<string>('');
    
    // 用户偏好设置
    const [userPreferences, setUserPreferences] = useState({
        defaultEncoding: 'auto',
        defaultSplitMethod: 'chapter',
        preserveStructure: false,
        minLength: 120,
        maxLength: 1800,
        useSseIngest: false,
        embeddingModel: 'text-embedding-3-small'
    });

    // 初始化时加载用户偏好
    React.useEffect(() => {
        const savedPreferences = BrowserCacheManager.get(CacheType.USER_PREFERENCES, 'deconstruction_tool');
        if (savedPreferences) {
            setUserPreferences(savedPreferences);
            setEncodingOverride(savedPreferences.defaultEncoding);
            setSplitMethod(savedPreferences.defaultSplitMethod as any);
            setPreserveStructure(savedPreferences.preserveStructure);
            setUseSseIngest(savedPreferences.useSseIngest);
            setEmbeddingModel(savedPreferences.embeddingModel);
        }
    }, []);
    // 保存用户偏好
    const saveUserPreferences = React.useCallback(() => {
        const preferences = {
            defaultEncoding: encodingOverride,
            defaultSplitMethod: splitMethod,
            preserveStructure: preserveStructure,
            minLength: 120,
            maxLength: 1800,
            useSseIngest: useSseIngest,
            embeddingModel: embeddingModel
        };
        setUserPreferences(preferences);
        BrowserCacheManager.set(CacheType.USER_PREFERENCES, 'deconstruction_tool', preferences);
    }, [encodingOverride, splitMethod, preserveStructure, useSseIngest, embeddingModel]);

    // 在相关设置改变时保存用户偏好
    React.useEffect(() => {
        saveUserPreferences();
    }, [encodingOverride, splitMethod, preserveStructure, useSseIngest, embeddingModel, saveUserPreferences]);
    
    const generateBookId = (): string => {
        const d = new Date();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
        return `bk_${ts}_${rand}`;
    };

    const bookAnalysisSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            emotionCurve: {
                type: Type.ARRAY,
                description: "An array of points representing the emotional curve of the story, chapter by chapter.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        position: { type: Type.INTEGER, description: "The chapter number." },
                        score: { type: Type.NUMBER, description: "Emotional score from -1.0 (very negative) to 1.0 (very positive)." },
                        summary: { type: Type.STRING, description: "A one-sentence summary explaining the emotional context of the chapter." },
                        keywords: {
                            type: Type.ARRAY,
                            description: "An array of 2-4 key emotion words found in this chapter (e.g., 'hope', 'despair', 'tension').",
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["position", "score", "summary", "keywords"]
                }
            },
            overallSentiment: {
                type: Type.STRING,
                description: "A high-level, one-paragraph summary of the story's overall emotional arc and journey."
            },
            characters: {
                type: Type.ARRAY,
                description: "A list of key characters with their descriptions.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        character: { type: Type.STRING, description: "Name of the character." },
                        description: { type: Type.STRING, description: "A brief description of the character's role, personality, and arc." },
                    },
                    required: ["character", "description"]
                }
            },
            plotPoints: {
                type: Type.ARRAY,
                description: "A list of major plot points.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        plotPoint: { type: Type.STRING, description: "The name or title of the plot point (e.g., 'Inciting Incident')." },
                        description: { type: Type.STRING, description: "A description of what happens at this plot point." },
                    },
                     required: ["plotPoint", "description"]
                }
            },
            worldBuilding: {
                type: Type.ARRAY,
                description: "A list of key world-building elements.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        element: { type: Type.STRING, description: "The name of the world-building element (e.g., 'Magic System', 'Political Factions')." },
                        description: { type: Type.STRING, description: "A description of this element." },
                    },
                    required: ["element", "description"]
                }
            },
        },
        required: ["emotionCurve", "overallSentiment", "characters", "plotPoints", "worldBuilding"]
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setError('');
            setAnalysisResult(null);
            setSplitChunks(null);
            setFileMetadata(null); // 重置元数据
            setIngestStatus({ status: 'idle', message: '', logs: [] }); // 重置入库状态
            // 重置编码状态与日志
            setEncodingOverride('auto');
            setEncodingDetected(null);
            setEncodingConfidence(null);
            setFileReadLogs([]);
            setFilePreview('');

            // 统一读取函数: 按编码读取文本
            const readWithEncoding = (f: File, enc: string): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const t = e.target?.result as string;
                        if (t === null || t === undefined) {
                            reject(new Error('File is empty or could not be read.'));
                            return;
                        }
                        resolve(t);
                    };
                    reader.onerror = () => reject(new Error('Error reading file.'));
                    // FileReader 支持第二参数指定编码
                    try {
                        reader.readAsText(f, enc);
                    } catch (e: any) {
                        reject(new Error(e?.message || 'Unsupported encoding'));
                    }
                });
            };

            // CJK 占比评估
            const cjkRatio = (t: string): number => {
                if (!t) return 0;
                let total = t.length;
                let cjk = 0;
                for (let i = 0; i < t.length; i++) {
                    const code = t.charCodeAt(i);
                    if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF) || (code >= 0xF900 && code <= 0xFAFF) || (code >= 0x3000 && code <= 0x303F)) {
                        cjk++;
                    }
                }
                return cjk / Math.max(total, 1);
            };

            const addLog = (msg: string) => setFileReadLogs(prev => [...prev, msg]);

            const extension = file.name.split('.').pop()?.toLowerCase();
            const candidates = ['utf-8', 'utf-8-sig', 'gb18030', 'gbk', 'big5', 'windows-1252', 'latin-1'];

            const autoDetectAndLoad = async () => {
                // 首先用 UTF-8 读取
                try {
                    addLog(`Try decoding with utf-8`);
                    const utf8Text = await readWithEncoding(file, 'utf-8');
                    const replCount = (utf8Text.match(/�/g) || []).length;
                    const ratio = cjkRatio(utf8Text);
                    addLog(`utf-8: cjkRatio=${ratio.toFixed(3)}, replacementCharCount=${replCount}`);
                    // 若不存在替换符且文本看起来正常,直接使用
                    if (replCount === 0 && ratio >= 0.1) {
                        setFileContent(utf8Text);
                        setEncodingDetected('UTF-8');
                        setEncodingConfidence(0.95);
                        setFilePreview(utf8Text.slice(0, 2048));
                        return;
                    }
                } catch (e: any) {
                    addLog(`utf-8 read failed: ${e.message}`);
                }

                // 备选编码尝试,选择分数最高者
                let bestText = '';
                let bestEnc = '';
                let bestScore = -1;
                for (const enc of candidates) {
                    try {
                        addLog(`Try decoding with ${enc}`);
                        const t = await readWithEncoding(file, enc);
                        const replCount = (t.match(/�/g) || []).length;
                        const ratio = cjkRatio(t);
                        // 简单评分: CJK 占比优先,惩罚替换符
                        const score = ratio - Math.min(replCount / Math.max(t.length, 1), 0.2);
                        addLog(`${enc}: cjkRatio=${ratio.toFixed(3)}, replacementCharCount=${replCount}, score=${score.toFixed(3)}`);
                        if (score > bestScore) {
                            bestScore = score;
                            bestText = t;
                            bestEnc = enc;
                        }
                    } catch (e: any) {
                        addLog(`${enc} read failed: ${e.message}`);
                    }
                }

                if (bestText) {
                    setFileContent(bestText);
                    // 规范化展示编码名
                    let displayEnc = bestEnc.toLowerCase();
                    if (displayEnc === 'gb18030' || displayEnc === 'gbk' || displayEnc === 'gb2312') displayEnc = 'GBK';
                    if (displayEnc === 'windows-1252') displayEnc = 'Windows-1252';
                    setEncodingDetected(displayEnc.toUpperCase());
                    setEncodingConfidence(bestScore >= 0.3 ? 0.98 : 0.85);
                    setFilePreview(bestText.slice(0, 2048));
                } else {
                    setError('无法识别编码,已回退空文本.');
                    setFileContent('');
                    setEncodingDetected(null);
                    setEncodingConfidence(null);
                    setFilePreview('');
                }
            };

            // 根据文件类型处理
            const run = async () => {
                try {
                    if (extension === 'json' || extension === 'yml' || extension === 'yaml') {
                        const text = await readWithEncoding(file, 'utf-8');
                        const importedResult: BookAnalysisResult = extension === 'json'
                            ? JSON.parse(text) as BookAnalysisResult
                            : yaml.load(text) as BookAnalysisResult;
                        if (importedResult.emotionCurve && importedResult.characters && importedResult.plotPoints && importedResult.worldBuilding && importedResult.overallSentiment) {
                            setAnalysisResult(importedResult);
                            setFileContent('');
                            setFilePreview('');
                            setEncodingDetected('UTF-8');
                            setEncodingConfidence(0.99);
                            addLog('Imported analysis JSON/YAML with UTF-8');
                        } else {
                            throw new Error('File does not match the required analysis data structure.');
                        }
                    } else if (extension === 'txt') {
                        await autoDetectAndLoad();
                    } else {
                        throw new Error('Unsupported file type. Please upload .txt, .json, .yml, or .yaml files.');
                    }
                } catch (error: any) {
                    setError(`Failed to process file: ${error.message}`);
                    setFileContent('');
                    setAnalysisResult(null);
                    addLog(`Process error: ${error.message}`);
                }
            };

            // 执行读取
            run();
        }
        if (uploadFileRef.current) {
            uploadFileRef.current.value = "";
        }
    };
    
    const generateAnalysisPrompt = (text: string): string => {
        if (!text) return "请先上传一本书籍以生成提示词.";

        return `You are an expert literary analyst. Your task is to perform a deep analysis of the following book text, extracting key information about its narrative structure, characters, themes, and emotional trajectory.

Your response MUST be a single, complete JSON object that strictly conforms to the provided schema. Do not include any text, markdown formatting, or explanations outside the JSON object. The entire book text is provided below.

Your task is to populate the JSON object with the following information:
1.  'emotionCurve': Analyze the sentiment of each chapter. Provide a sentiment score from -1.0 (very negative) to 1.0 (very positive), a brief summary, and 2-4 emotion keywords for each chapter.
2.  'overallSentiment': Provide a one-paragraph summary of the story's overall emotional journey.
3.  'characters': Identify the main characters. For each, provide their name and a detailed description of their role, personality, and character arc.
4.  'plotPoints': Outline the major plot points, such as the inciting incident, rising action, climax, and resolution.
5.  'worldBuilding': Describe the key elements of the story's world, including any unique settings, magic systems, political structures, or technologies.

Book Text:
---
${text}
---
`;
    };

    const handleAnalyze = async () => {
        if (!analysisEnabled) {
            return;
        }
        if (!selectedFile || !fileContent) {
            setError('请选择一个文件进行分析.');
            return;
        }
        setIsAnalyzing(true);
        setError('');
        setAnalysisResult(null);
        setSplitChunks(null);
        
        const prompt = generateAnalysisPrompt(fileContent);

        try {
            const response = await agentService.runAgent(prompt, bookAnalysisSchema);
            if (response.text) {
                const resultJson = JSON.parse(response.text);
                setAnalysisResult(resultJson);
            } else {
                throw new Error("AI returned an empty or invalid response. Please try again.");
            }
        } catch (e: any) {
            console.error("Analysis Error:", e);
            setError(e.message || '分析文本时发生未知错误.');
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    // --- Text Splitting Logic ---
    const splitByChapter = (text: string): { title: string; content: string }[] => {
        const chapterRegex = /^(Chapter\s+\d+|第\s*[一二三四五六七八九十百千万零\d]+\s*章|^\s*【.*】\s*$)/gim;
        const parts = text.split(chapterRegex);

        const chunks: { title: string; content: string }[] = [];
        if (parts.length <= 1) {
            return [{ title: '全文', content: text }];
        }

        for (let i = 1; i < parts.length; i += 2) {
            const title = parts[i]?.trim();
            const content = parts[i + 1]?.trim() || '';
            if (title || content) {
                chunks.push({ title: title || `片段 ${chunks.length + 1}`, content });
            }
        }
        return chunks;
    };

    const splitByParagraph = (text: string): { title: string; content: string }[] => {
        // 按段落拆分: 使用中文标点符号边界 (.!?;)
        // 参考后端 paragraph_service.py 的语义段落拆分逻辑
        const sentences = text.split(/([.!?;]+)/).filter(s => s.trim());
        const chunks: { title: string; content: string }[] = [];
        let currentPara = '';
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            currentPara += sentence;
            
            // 如果是标点符号且累积内容达到一定长度,或者是最后一句
            if (/[.!?;]+/.test(sentence) && (currentPara.length >= 40 || i === sentences.length - 1)) {
                if (currentPara.trim()) {
                    chunks.push({
                        title: `段落 ${chunks.length + 1} (${currentPara.length}字)`,
                        content: currentPara.trim()
                    });
                    currentPara = '';
                }
            }
        }
        
        // 处理剩余内容
        if (currentPara.trim()) {
            chunks.push({
                title: `段落 ${chunks.length + 1} (${currentPara.length}字)`,
                content: currentPara.trim()
            });
        }
        
        return chunks.length > 0 ? chunks : [{ title: '全文', content: text }];
    };

    const splitByWordCount = (text: string, count: number): { title: string; content: string }[] => {
        const words = text.trim().split(/\s+/);
        if (words.length === 0 || count <= 0) return [];

        const chunks: { title: string; content: string }[] = [];
        let currentChunk: string[] = [];
        
        for (let i = 0; i < words.length; i++) {
            currentChunk.push(words[i]);
            if (currentChunk.length >= count || i === words.length - 1) {
                const startWord = (chunks.length * count) + 1;
                const endWord = startWord + currentChunk.length - 1;
                chunks.push({
                    title: `片段 ${chunks.length + 1} (字数 ${startWord}-${endWord})`,
                    content: currentChunk.join(' '),
                });
                currentChunk = [];
            }
        }
        return chunks;
    };

    const handleSplitText = () => {
        if (!fileContent) {
            setError('请先上传文件再进行拆分.');
            return;
        }
        setError('');
        setAnalysisResult(null);
        setSplitChunks(null);

        try {
            if (splitMethod === 'chapter') {
                setSplitChunks(splitByChapter(fileContent));
            } else if (splitMethod === 'paragraph') {
                setSplitChunks(splitByParagraph(fileContent));
            } else {
                setSplitChunks(splitByWordCount(fileContent, splitWordCount));
            }
        } catch (e: any) {
            setError('拆分文本时出错: ' + e.message);
        }
    };
    
    // Download error log
    const downloadErrorLog = () => {
        if (!ingestStatus.logs || ingestStatus.logs.length === 0) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logContent = [
            `=== Ingest Error Log ===`,
            `Timestamp: ${new Date().toISOString()}`,
            `Book ID: ${ingestStatus.bookId || 'N/A'}`,
            `Status: ${ingestStatus.status}`,
            `\n--- Error Details ---`,
            ...ingestStatus.logs,
            `\n--- End of Log ---`
        ].join('\n');
        
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ingest-error-${timestamp}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    // Batch ingest with retry logic
    const processBatchWithRetry = async (
        batch: string,
        batchIndex: number,
        bookId: string,
        maxRetries: number = 3
    ): Promise<boolean> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const resp = await ingestStoryText({
                    text: batch.trim(),
                    bookId,
                    chapterIndex: typeof chapterIndex === 'number' ? chapterIndex : undefined,
                    sectionIndex: typeof sectionIndex === 'number' ? sectionIndex + batchIndex - 1 : undefined,
                    embeddingModel: embeddingModel || undefined,
                });
                
                if (resp?.code === 0) {
                    return true;
                } else {
                    const errorMsg = `Batch ${batchIndex} attempt ${attempt}/${maxRetries} failed: ${resp?.message}`;
                    setIngestStatus(prev => ({
                        ...prev,
                        logs: [...(prev.logs || []), errorMsg]
                    }));
                    
                    if (attempt === maxRetries) {
                        throw new Error(resp?.message || 'Unknown error');
                    }
                    
                    // Exponential backoff: 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
                }
            } catch (e: any) {
                const errorMsg = `Batch ${batchIndex} attempt ${attempt}/${maxRetries} exception: ${e.message}`;
                setIngestStatus(prev => ({
                    ...prev,
                    logs: [...(prev.logs || []), errorMsg]
                }));
                
                if (attempt === maxRetries) {
                    return false;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
        return false;
    };
    
    const handleExport = (type: 'analysis' | 'chunks') => {
        let blob: Blob;
        let fileNameSuffix: string;

        if (type === 'analysis' && analysisResult) {
            blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: 'application/json' });
            fileNameSuffix = '-analysis.json';
        } else if (type === 'chunks' && splitChunks) {
            blob = new Blob([JSON.stringify(splitChunks, null, 2)], { type: 'application/json' });
            fileNameSuffix = '-split-chunks.json';
        } else {
            setError(`没有可导出的${type === 'analysis' ? '分析结果' : '拆分片段'}.`);
            return;
        }
        
        const fileName = selectedFile?.name.replace(/\.[^/.]+$/, "") || 'book';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}${fileNameSuffix}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    return (
        <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full overflow-y-auto text-gray-900 dark:text-[#E2E2E2] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3 mb-6">
                <BookOpen size={28} className="text-cyan-400" />
                <div>
                    <h2 className="text-2xl font-bold">拆书工具</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">用于文本拆分与入库,可选启用 AI 拆书分析(默认关闭)</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2">
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">上传文件</h3>
                         <label htmlFor="file-upload" className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-100 dark:bg-[#2C2C2C] border border-dashed border-gray-300 dark:border-white/20 text-gray-500 dark:text-[#A8ABB4] rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 hover:border-gray-400 dark:hover:border-white/30 transition-colors">
                            <FileText size={16}/>
                            <span className="text-sm truncate">{selectedFile ? selectedFile.name : '上传 .txt, .json, .yml 文件'}</span>
                        </label>
                        <input id="file-upload" type="file" accept=".txt,.json,.yml,.yaml" className="hidden" onChange={handleFileChange} disabled={isAnalyzing} ref={uploadFileRef} />
                        {/* 编码覆盖与检测结果 */}
                        {selectedFile && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600 dark:text-gray-400">编码覆盖:</label>
                              <select
                                value={encodingOverride}
                                onChange={async (e) => {
                                  const enc = e.target.value;
                                  setEncodingOverride(enc);
                                  // 用户选择覆盖时,重新按指定编码读取(仅 .txt)
                                  try {
                                    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
                                    if (ext === 'txt') {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const t = ev.target?.result as string;
                                        if (t === null || t === undefined) {
                                          setError('File is empty or could not be read.');
                                          return;
                                        }
                                        setFileContent(t);
                                        let displayEnc = enc.toLowerCase();
                                        if (displayEnc === 'gb18030' || displayEnc === 'gbk' || displayEnc === 'gb2312') displayEnc = 'GBK';
                                        if (displayEnc === 'windows-1252') displayEnc = 'Windows-1252';
                                        setEncodingDetected(displayEnc.toUpperCase());
                                        setEncodingConfidence(enc === 'auto' ? null : 0.99);
                                        setFilePreview(t.slice(0, 2048));
                                        setFileReadLogs(prev => [...prev, `User override to ${enc}, re-read success`] );
                                      };
                                      reader.onerror = () => {
                                        setError('Error reading file with selected encoding.');
                                        setFileReadLogs(prev => [...prev, `User override to ${enc} failed`] );
                                      };
                                      // auto 不重新读取
                                      if (enc !== 'auto') {
                                        try {
                                          reader.readAsText(selectedFile, enc);
                                        } catch (err: any) {
                                          setError(err?.message || 'Unsupported encoding');
                                          setFileReadLogs(prev => [...prev, `User override to ${enc} error: ${err?.message || 'Unsupported encoding'}`] );
                                        }
                                      }
                                    }
                                  } catch {}
                                }}
                                className={`h-8 px-2.5 text-xs border rounded ${
                                  encodingConfidence !== null && encodingConfidence < 0.85
                                    ? 'border-yellow-500 dark:border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-300 dark:ring-yellow-500'
                                    : 'border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C]'
                                }`}>
                                <option value="auto">Auto (推荐)</option>
                                <option value="utf-8">UTF-8</option>
                                <option value="utf-8-sig">UTF-8-SIG</option>
                                <option value="gb18030">GB18030</option>
                                <option value="gbk">GBK</option>
                                <option value="big5">Big5</option>
                                <option value="windows-1252">Windows-1252</option>
                                <option value="latin-1">Latin-1</option>
                              </select>
                              {fileReadLogs.length > 0 && (
                                <button
                                  onClick={() => {
                                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                    const content = [
                                      '=== File Read Log ===',
                                      `Timestamp: ${new Date().toISOString()}`,
                                      `Filename: ${selectedFile.name}`,
                                      '',
                                      ...fileReadLogs,
                                      '\n--- End of Log ---'
                                    ].join('\n');
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `file-read-${timestamp}.log`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="ml-auto px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded"
                                >下载日志</button>
                              )}
                            </div>
                            {(encodingDetected || encodingConfidence !== null) && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                检测编码: {encodingDetected || '未知'} {encodingConfidence !== null ? `(置信度 ${encodingConfidence?.toFixed(2)})` : ''}
                                {encodingConfidence !== null && encodingConfidence < 0.85 && (
                                  <div className="mt-1 flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                                    <AlertTriangle size={12}/>
                                    置信度较低,建议手动选择编码.
                                  </div>
                                )}
                              </div>
                            )}
                            {filePreview && (
                              <div className="mt-1">
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">预览(前 2KB):</div>
                                <pre className="text-xs whitespace-pre-wrap bg-white dark:bg-[#121212] p-2 rounded border border-gray-200 dark:border-white/10 max-h-36 overflow-auto">{filePreview}</pre>
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {fileContent && (
                        <>
                         <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">AI 拆书(可选)</h3>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={analysisEnabled}
                                  onChange={(e) => setAnalysisEnabled(e.target.checked)}
                                />
                                启用 AI 拆书分析
                              </label>
                              <button
                                  onClick={handleAnalyze}
                                  disabled={!analysisEnabled || isAnalyzing || !selectedFile}
                                  className="inline-flex items-center gap-2 h-9 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 dark:text-cyan-300 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {isAnalyzing ? <Loader size={16} className="animate-spin"/> : <BookUp size={16} />}
                                  <span>{isAnalyzing ? '分析中...' : '分析书籍'}</span>
                              </button>
                            </div>
                            {!analysisEnabled && (
                              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                说明:若不启用 AI 拆书,仍可在下方执行文本拆分并进行"拆书入库",满足向量段落检索的核心业务流程.
                              </p>
                            )}
                         </div>

                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Scissors size={16}/> 文本拆分</h3>
                            <div className="space-y-3">
                                <div className="flex gap-2 text-sm flex-wrap">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="split-method" value="chapter" checked={splitMethod === 'chapter'} onChange={() => setSplitMethod('chapter')} className="form-radio h-4 w-4 text-cyan-500 bg-gray-200 border-gray-300 focus:ring-cyan-500" />
                                        按章节
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="split-method" value="paragraph" checked={splitMethod === 'paragraph'} onChange={() => setSplitMethod('paragraph')} className="form-radio h-4 w-4 text-cyan-500 bg-gray-200 border-gray-300 focus:ring-cyan-500" />
                                        按段落
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="split-method" value="wordCount" checked={splitMethod === 'wordCount'} onChange={() => setSplitMethod('wordCount')} className="form-radio h-4 w-4 text-cyan-500 bg-gray-200 border-gray-300 focus:ring-cyan-500" />
                                        按字数
                                    </label>
                                </div>
                                {splitMethod === 'wordCount' && (
                                    <input type="number" value={splitWordCount} onChange={e => setSplitWordCount(parseInt(e.target.value, 10))} className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg text-sm" />
                                )}
                                <button onClick={handleSplitText} disabled={isAnalyzing} className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                                    <Scissors size={16}/> 拆分文本
                                </button>
                            </div>
                        </div>
                        </>
                    )}
                    
                    {analysisEnabled && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Bot size={18}/> AI 分析提示词</h3>
                          <textarea
                              readOnly
                              value={generateAnalysisPrompt(fileContent)}
                              className="w-full h-24 p-2 text-xs bg-gray-100 dark:bg-[#2C2C2C] border border-gray-200 dark:border-white/10 rounded-md resize-none font-mono text-gray-600 dark:text-gray-400"
                              disabled={isAnalyzing}
                          />
                      </div>
                    )}
                    
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">数据管理</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleExport('analysis')}
                                disabled={!analysisResult}
                                className="flex-1 flex items-center justify-center gap-2 h-9 px-3 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={14}/>
                                导出 JSON
                            </button>
                        </div>
                    </div>
                    {/* New: Batch ingest to vector paragraph store */}
                    {fileContent && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <Upload size={16}/>
                          文件入库(三件套集成)
                        </h3>
                        <div className="space-y-2 text-sm">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            直接上传文件,后端自动进行编码检测、文本提取、段落拆分和入库.
                            <br/>最大文件: 10MB,超过将自动分片处理.
                          </p>
                          
                          {/* 结构保留开关 */}
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={preserveStructure}
                              onChange={(e) => setPreserveStructure(e.target.checked)}
                              className="form-checkbox h-4 w-4 text-cyan-500"
                            />
                            保留文档结构(Markdown、表格、标题)
                          </label>
                          
                          {/* 文件大小检测 */}
                          {selectedFile && selectedFile.size > 10 * 1024 * 1024 && (
                            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                              <AlertTriangle size={14}/>
                              文件较大({(selectedFile.size / 1024 / 1024).toFixed(2)} MB),建议分片上传或使用SSE流式处理.
                            </div>
                          )}
                          
                          {/* Book ID 等参数 */}
                          <input
                            type="text"
                            placeholder="Book ID (optional, 自动生成)"
                            value={bookId}
                            onChange={(e) => setBookId(e.target.value)}
                            className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              placeholder="Chapter Index (optional)"
                              value={typeof chapterIndex === 'number' ? chapterIndex : ''}
                              onChange={(e) => setChapterIndex(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                              className="h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg text-xs"
                            />
                            <input
                              type="number"
                              placeholder="Section Index (optional)"
                              value={typeof sectionIndex === 'number' ? sectionIndex : ''}
                              onChange={(e) => setSectionIndex(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                              className="h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg text-xs"
                            />
                          </div>
                          
                          {/* 三件套入库按钮 */}
                          <button
                            onClick={async () => {
                              if (!selectedFile) {
                                setError('请先选择文件');
                                return;
                              }
                              
                              setIngestStatus({ status: 'processing', message: '上传中...', logs: [] });
                              setFileMetadata(null);
                              
                              try {
                                const finalBookId = (bookId && bookId.trim()) ? bookId.trim() : generateBookId();
                                
                                const result = await ingestFile({
                                  file: selectedFile,
                                  detected_encoding: encodingOverride !== 'auto' ? encodingOverride : undefined,
                                  preserve_structure: preserveStructure,
                                  book_id: finalBookId,
                                  chapter_index: chapterIndex,
                                  section_index: sectionIndex,
                                });
                                
                                if (result?.code === 0 && result?.data) {
                                  const data = result.data;
                                  setFileMetadata({
                                    file_hash: data.file_hash,
                                    encoding: data.encoding,
                                    method: data.method,
                                    structure: data.structure,
                                    source_lib: data.source_lib,
                                    confidence: data.confidence,
                                    document_id: data.document_id,
                                    total_paragraphs: data.total_paragraphs,
                                    paragraph_ids: data.paragraph_ids,
                                  });
                                  setBookId(finalBookId);
                                  setIngestStatus({
                                    status: 'success',
                                    message: `成功入库 ${data.total_paragraphs} 个段落, 文档ID=${data.document_id}`,
                                    bookId: finalBookId,
                                    logs: [`Extracted using ${data.source_lib}`, `Encoding: ${data.encoding} (confidence: ${data.confidence})`]
                                  });
                                } else {
                                  throw new Error(result?.message || '入库失败');
                                }
                              } catch (e: any) {
                                const errorMsg = `入库失败: ${e?.message || 'Network error'}`;
                                setIngestStatus({
                                  status: 'failed',
                                  message: errorMsg,
                                  logs: [errorMsg]
                                });
                                setError(errorMsg);
                              }
                            }}
                            disabled={ingestStatus.status === 'processing' || !selectedFile}
                            className="w-full flex items-center justify-center gap-2 h-10 px-3 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ingestStatus.status === 'processing' && <Loader className="inline w-4 h-4 animate-spin" />}
                            <Upload size={16}/>
                            {ingestStatus.status === 'processing' ? '处理中...' : '直接入库(三件套)'}
                          </button>
                          
                          {/* 提取元数据显示 */}
                          {fileMetadata && (
                            <div className="mt-2 p-3 bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-white/10">
                              <h4 className="text-xs font-bold mb-2 text-gray-900 dark:text-white">提取元数据</h4>
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <div className="text-gray-600 dark:text-gray-400">文档ID:</div>
                                <div className="font-mono text-gray-800 dark:text-white">{fileMetadata.document_id}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">文件哈希:</div>
                                <div className="font-mono text-gray-800 dark:text-white text-[10px]">{fileMetadata.file_hash?.slice(0, 16)}...</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">编码:</div>
                                <div className="font-mono text-gray-800 dark:text-white">{fileMetadata.encoding}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">置信度:</div>
                                <div className="font-mono text-gray-800 dark:text-white">{fileMetadata.confidence?.toFixed(2)}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">来源库:</div>
                                <div className="font-mono text-gray-800 dark:text-white">{fileMetadata.source_lib}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">提取方法:</div>
                                <div className="font-mono text-gray-800 dark:text-white text-[10px]">{fileMetadata.method}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">结构类型:</div>
                                <div className="font-mono text-gray-800 dark:text-white">{fileMetadata.structure}</div>
                                
                                <div className="text-gray-600 dark:text-gray-400">段落数:</div>
                                <div className="font-mono text-gray-800 dark:text-white font-bold text-cyan-600 dark:text-cyan-400">{fileMetadata.total_paragraphs}</div>
                              </div>
                              {fileMetadata.paragraph_ids && fileMetadata.paragraph_ids.length > 0 && (
                                <div className="mt-2 text-xs">
                                  <div className="text-gray-600 dark:text-gray-400 mb-1">段落ID列表(前10个):</div>
                                  <div className="font-mono text-gray-800 dark:text-white bg-gray-100 dark:bg-black/20 p-2 rounded max-h-20 overflow-auto text-[10px]">
                                    {fileMetadata.paragraph_ids.slice(0, 10).join(', ')}
                                    {fileMetadata.paragraph_ids.length > 10 && ` ... (+${fileMetadata.paragraph_ids.length - 10} more)`}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* 入库状态显示 */}
                          {ingestStatus.status !== 'idle' && (
                            <div className={`mt-2 p-2 rounded text-sm ${
                              ingestStatus.status === 'processing' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                              ingestStatus.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                              'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {ingestStatus.status === 'processing' && <Loader className="inline w-4 h-4 animate-spin" />}
                                  {ingestStatus.status === 'success' && '✅ '}
                                  {ingestStatus.status === 'failed' && <AlertTriangle className="inline w-4 h-4" />}
                                  <span>{ingestStatus.message}</span>
                                </div>
                                {ingestStatus.status === 'failed' && ingestStatus.logs && ingestStatus.logs.length > 0 && (
                                  <button
                                    onClick={downloadErrorLog}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                  >
                                    <Download size={12} />
                                    Download Log
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* 保留原有的批量入库功能 */}
                    {fileContent && (
                      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Batch Ingest (Optimized)</h3>
                        <div className="space-y-2 text-sm">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Note: Indexes start from 0 (first chapter/section = 0). Auto-generates bookId if empty.
                            Large files will be processed in batches for better performance.
                          </p>
                          {/* SSE 入库模式切换 */}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={useSseIngest}
                              onChange={(e) => setUseSseIngest(e.target.checked)}
                            />
                            使用服务端解析 + SSE 入库(支持编码覆盖)
                          </label>
                          <input
                            type="text"
                            placeholder="Book ID (optional)"
                            value={bookId}
                            onChange={(e) => setBookId(e.target.value)}
                            className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              placeholder="Chapter Index (optional)"
                              value={typeof chapterIndex === 'number' ? chapterIndex : ''}
                              onChange={(e) => setChapterIndex(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                              className="h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg"
                            />
                            <input
                              type="number"
                              placeholder="Section Index (optional)"
                              value={typeof sectionIndex === 'number' ? sectionIndex : ''}
                              onChange={(e) => setSectionIndex(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                              className="h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Embedding Model"
                            value={embeddingModel}
                            onChange={(e) => setEmbeddingModel(e.target.value)}
                            className="w-full h-8 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-lg"
                          />
                          <button
                            onClick={async () => {
                              if (useSseIngest) {
                                if (!selectedFile) {
                                  setError('请先选择文件');
                                  return;
                                }
                                setIngestStatus({ status: 'processing', message: 'Uploading file and starting stream...', logs: [] });
                                try {
                                  const uploadResp = await uploadBook(selectedFile);
                                  const fid = uploadResp.fileId;
                                  setUploadedFileId(fid);
                                  // 关闭之前的连接(若有)
                                  try { sseDisconnect?.(); } catch {}
                                  const disconnect = ingestBookStream(fid, {
                                    modelId: embeddingModel,
                                    format: 'text',
                                    encoding: encodingOverride
                                  }, {
                                    onMessage: (data: any) => {
                                      const evtType = data?.__event__ || data?.event || data?.type;
                                      if (evtType === 'parsed') {
                                        const enc = data?.encoding;
                                        const conf = data?.confidence;
                                        setIngestStatus(prev => ({
                                          ...prev,
                                          message: `Parsed: encoding=${enc || 'unknown'} confidence=${conf ?? ''}`,
                                        }));
                                        if (data?.preview) {
                                          setFilePreview(String(data.preview).slice(0, 2048));
                                        }
                                      } else if (evtType === 'progress') {
                                        const bi = Number(data?.batchIndex || 0);
                                        const tb = Number(data?.totalBatches || 0);
                                        setIngestStatus(prev => ({
                                          ...prev,
                                          status: 'processing',
                                          message: `Processing batch ${bi}/${tb}...`,
                                          currentBatch: bi,
                                          totalBatches: tb
                                        }));
                                      } else if (evtType === 'batch_error') {
                                        const bi = Number(data?.batchIndex || 0);
                                        const msg = data?.message || 'Unknown error';
                                        setIngestStatus(prev => ({
                                          ...prev,
                                          logs: [...(prev.logs || []), `Batch ${bi} error: ${msg}`],
                                          failedBatches: [...(prev.failedBatches || []), bi]
                                        }));
                                      } else if (evtType === 'complete') {
                                        const docId = data?.docId;
                                        setIngestStatus(prev => ({
                                          ...prev,
                                          status: 'success',
                                          message: `Stream ingest complete, docId=${docId}`,
                                          bookId: String(docId || prev.bookId || ''),
                                        }));
                                      } else if (evtType === 'error') {
                                        const msg = data?.message || 'Stream error';
                                        setIngestStatus(prev => ({
                                          ...prev,
                                          status: 'failed',
                                          message: msg,
                                          logs: [...(prev.logs || []), msg]
                                        }));
                                      }
                                    },
                                    onError: (err: Event) => {
                                      setIngestStatus(prev => ({
                                        ...prev,
                                        status: 'failed',
                                        message: 'SSE connection error',
                                        logs: [...(prev.logs || []), `SSE error: ${String((err as any)?.message || '')}`]
                                      }));
                                    }
                                  });
                                  setSseDisconnect(() => disconnect);
                                } catch (e: any) {
                                  const criticalError = `Upload or stream failed: ${e?.message || 'Network error'}`;
                                  setIngestStatus(prev => ({
                                    status: 'failed',
                                    message: criticalError,
                                    logs: [...(prev.logs || []), criticalError]
                                  }));
                                }
                              } else {
                                setIngestStatus({ status: 'processing', message: 'Initializing batch processing...', logs: [] });
                                try {
                                  const finalBookId = (bookId && bookId.trim()) ? bookId.trim() : generateBookId();
                                  const textLength = fileContent.length;
                                  const CHUNK_SIZE = 100000; // 100KB per batch
                                  const MAX_RETRIES = 3;
                                  if (textLength > CHUNK_SIZE) {
                                    const paragraphs = fileContent.split(/\n\n+/);
                                    let currentBatch = '';
                                    let batchIndex = 0;
                                    let totalBatches = Math.ceil(textLength / CHUNK_SIZE);
                                    const failedBatches: number[] = [];
                                    setIngestStatus(prev => ({ 
                                      ...prev, 
                                      totalBatches,
                                      logs: [...(prev.logs || []), `Starting batch processing: ${totalBatches} batches estimated`]
                                    }));
                                    for (let i = 0; i < paragraphs.length; i++) {
                                      currentBatch += paragraphs[i] + '\n\n';
                                      if (currentBatch.length >= CHUNK_SIZE || i === paragraphs.length - 1) {
                                        batchIndex++;
                                        setIngestStatus(prev => ({ 
                                          ...prev,
                                          status: 'processing', 
                                          message: `Processing batch ${batchIndex}/${totalBatches}... (${currentBatch.length.toLocaleString()} chars)`,
                                          currentBatch: batchIndex
                                        }));
                                        const success = await processBatchWithRetry(
                                          currentBatch,
                                          batchIndex,
                                          finalBookId,
                                          MAX_RETRIES
                                        );
                                        if (!success) {
                                          failedBatches.push(batchIndex);
                                          const errorMsg = `Batch ${batchIndex} failed after ${MAX_RETRIES} retries`;
                                          setIngestStatus(prev => ({
                                            ...prev,
                                            logs: [...(prev.logs || []), errorMsg]
                                          }));
                                        }
                                        currentBatch = '';
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                      }
                                    }
                                    setBookId(finalBookId);
                                    if (failedBatches.length > 0) {
                                      setIngestStatus({
                                        status: 'failed',
                                        message: `Partially failed: ${failedBatches.length}/${batchIndex} batches failed. Download log for details.`,
                                        bookId: finalBookId,
                                        failedBatches,
                                        totalBatches: batchIndex,
                                        logs: ingestStatus.logs
                                      });
                                    } else {
                                      setIngestStatus({
                                        status: 'success',
                                        message: `Successfully ingested ${batchIndex} batches, bookId=${finalBookId}`,
                                        bookId: finalBookId,
                                        totalBatches: batchIndex,
                                        logs: [...(ingestStatus.logs || []), `All batches completed successfully`]
                                      });
                                    }
                                  } else {
                                    setIngestStatus(prev => ({
                                      ...prev,
                                      logs: [...(prev.logs || []), `Processing small file (${textLength} chars) in single batch`]
                                    }));
                                    const success = await processBatchWithRetry(
                                      fileContent,
                                      1,
                                      finalBookId,
                                      MAX_RETRIES
                                    );
                                    setBookId(finalBookId);
                                    if (success) {
                                      setIngestStatus({
                                        status: 'success',
                                        message: `Successfully ingested, bookId=${finalBookId}`,
                                        bookId: finalBookId,
                                        logs: [...(ingestStatus.logs || []), `Single batch completed successfully`]
                                      });
                                    } else {
                                      setIngestStatus({
                                        status: 'failed',
                                        message: `Ingest failed after ${MAX_RETRIES} retries`,
                                        logs: ingestStatus.logs
                                      });
                                    }
                                  }
                                } catch (e: any) {
                                  const criticalError = `Critical error: ${e?.message || 'Network error'}`;
                                  setIngestStatus(prev => ({
                                    status: 'failed',
                                    message: criticalError,
                                    logs: [...(prev.logs || []), criticalError]
                                  }));
                                }
                              }
                            }}
                            disabled={ingestStatus.status === 'processing'}
                            className="w-full flex items-center justify-center gap-2 h-9 px-3 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ingestStatus.status === 'processing' && <Loader className="inline w-4 h-4 animate-spin" />}
                            {useSseIngest ? 'Upload & Stream Ingest (SSE)' : 'Ingest to Vector Store'}
                          </button>
                          {useSseIngest && sseDisconnect && ingestStatus.status === 'processing' && (
                            <button
                              onClick={() => {
                                try { sseDisconnect(); } catch {}
                                setSseDisconnect(null);
                                setIngestStatus(prev => ({
                                  ...prev,
                                  status: 'failed',
                                  message: '已停止',
                                  logs: [...(prev.logs || []), 'User stopped SSE stream']
                                }));
                              }}
                              className="w-full mt-2 flex items-center justify-center gap-2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded"
                            >
                              <RefreshCw size={12} /> Stop Stream
                            </button>
                          )}
                          {ingestStatus.status !== 'idle' && (
                            <div className={`mt-2 p-2 rounded text-sm ${
                              ingestStatus.status === 'processing' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                              ingestStatus.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                              'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {ingestStatus.status === 'processing' && <Loader className="inline w-4 h-4 animate-spin" />}
                                  {ingestStatus.status === 'success' && '✅ '}
                                  {ingestStatus.status === 'failed' && <AlertTriangle className="inline w-4 h-4" />}
                                  <span>{ingestStatus.message}</span>
                                </div>
                                {ingestStatus.status === 'failed' && ingestStatus.logs && ingestStatus.logs.length > 0 && (
                                  <button
                                    onClick={downloadErrorLog}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                  >
                                    <Download size={12} />
                                    Download Log
                                  </button>
                                )}
                              </div>
                              {/* Progress bar for batch processing */}
                              {ingestStatus.status === 'processing' && ingestStatus.currentBatch && ingestStatus.totalBatches && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div 
                                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${(ingestStatus.currentBatch / ingestStatus.totalBatches) * 100}%` }}
                                    />
                                  </div>
                                  <div className="text-xs mt-1 text-center">
                                    {ingestStatus.currentBatch}/{ingestStatus.totalBatches} batches
                                  </div>
                                </div>
                              )}
                              {/* Failed batches info */}
                              {ingestStatus.status === 'failed' && ingestStatus.failedBatches && ingestStatus.failedBatches.length > 0 && (
                                <div className="mt-2 text-xs">
                                  Failed batches: {ingestStatus.failedBatches.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {error && <p className="text-xs text-red-400 mt-3 text-center p-2 bg-red-500/10 rounded-md">{error}</p>}
                </div>

                <div className="md:col-span-2 h-full">
                     {isAnalyzing ? (
                         <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-gray-50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-gray-400 dark:text-gray-500">
                           <Loader size={24} className="animate-spin mb-2" />
                           <p>AI 正在进行全面分析...</p>
                           <p className="text-xs mt-1">这可能需要一些时间</p>
                        </div>
                    ) : splitChunks ? (
                        <SplitTextView chunks={splitChunks} onExport={() => handleExport('chunks')} />
                    ) : analysisResult ? (
                        <div className="overflow-y-auto h-full pr-2">
                            <BookAnalysisView result={analysisResult} />
                        </div>
                    ) : (
                        <div className="h-full min-h-[300px] flex items-center justify-center bg-gray-50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-gray-400 dark:text-gray-500">
                           <p>分析或拆分结果将显示在此处</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeconstructionTool;

/**
 * 段落处理工具 - 新版界面
 * 
 * 功能流程:
 * 1. 文件上传 → 编码检测
 * 2. 段落拆分 → 清洗为单行
 * 3. 展示段落列表(虚拟滚动)
 * 4. 入库操作
 */

import React, { useState, useRef } from 'react';
import { Upload, Scissors, Database, FileText, Loader, Download, Check, AlertTriangle } from 'lucide-react';
import VirtualParagraphList from './VirtualParagraphList';
import { uploadAndExtractFile, splitParagraphs, Paragraph } from '../services/paragraphService';
import { ingestStoryText } from '../services/storyService';
import { getCurrentTimestamp } from '../utils/timeUtils.ts';

const ParagraphProcessingTool: React.FC = () => {
  // 文件上传状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>('');
  const [fileMetadata, setFileMetadata] = useState<any>(null);
  const [encodingOverride, setEncodingOverride] = useState<string>('auto');
  const [isUploading, setIsUploading] = useState(false);
  
  // 段落拆分状态
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitConfig, setSplitConfig] = useState({
    method: 'paragraph' as const,
    min_length: 120,
    max_length: 1800,
    clean_mode: 'strict' as const
  });
  
  // 入库状态
  const [bookId, setBookId] = useState<string>('');
  const [chapterIndex, setChapterIndex] = useState<number | undefined>(undefined);
  const [sectionIndex, setSectionIndex] = useState<number | undefined>(undefined);
  const [embeddingModel, setEmbeddingModel] = useState<string>('text-embedding-3-small');
  const [ingestStatus, setIngestStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'failed';
    message: string;
  }>({ status: 'idle', message: '' });
  
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 生成书籍ID
  const generateBookId = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `bk_${ts}_${rand}`;
  };
  
  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setParagraphs([]);
      setFileText('');
      setFileMetadata(null);
    }
  };
  
  // 上传并提取文件
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }
    
    setIsUploading(true);
    setError('');
    
    try {
      const result = await uploadAndExtractFile(
        selectedFile,
        encodingOverride !== 'auto' ? encodingOverride : undefined,
        false
      );
      
      if (result.code === 0 && result.data) {
        setFileText(result.data.text);
        setFileMetadata(result.data);
      } else {
        throw new Error(result.message || '文件提取失败');
      }
    } catch (e: any) {
      setError(`上传失败: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  // 拆分段落
  const handleSplit = async () => {
    if (!fileText) {
      setError('请先上传文件');
      return;
    }
    
    setIsSplitting(true);
    setError('');
    
    try {
      const result = await splitParagraphs({
        text: fileText,
        config: splitConfig,
        metadata: {
          file_id: fileMetadata?.file_id,
          book_id: bookId || generateBookId()
        }
      });
      
      if (result.code === 0 && result.data) {
        setParagraphs(result.data.paragraphs);
        setStatistics(result.data.statistics);
      } else {
        throw new Error(result.message || '段落拆分失败');
      }
    } catch (e: any) {
      setError(`拆分失败: ${e.message}`);
    } finally {
      setIsSplitting(false);
    }
  };
  
  // 入库
  const handleIngest = async () => {
    if (paragraphs.length === 0) {
      setError('请先拆分段落');
      return;
    }
    
    setIngestStatus({ status: 'processing', message: '正在入库...' });
    setError('');
    
    try {
      const finalBookId = bookId || generateBookId();
      
      // 批量入库
      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        
        await ingestStoryText({
          text: para.content,
          bookId: finalBookId,
          chapterIndex,
          sectionIndex: typeof sectionIndex === 'number' ? sectionIndex + i : undefined,
          embeddingModel
        });
        
        // 更新进度
        setIngestStatus({
          status: 'processing',
          message: `正在入库 ${i + 1}/${paragraphs.length}...`
        });
      }
      
      setBookId(finalBookId);
      setIngestStatus({
        status: 'success',
        message: `成功入库 ${paragraphs.length} 个段落, bookId=${finalBookId}`
      });
    } catch (e: any) {
      setIngestStatus({
        status: 'failed',
        message: `入库失败: ${e.message}`
      });
      setError(`入库失败: ${e.message}`);
    }
  };
  
  // 导出JSON
  const handleExport = () => {
    if (paragraphs.length === 0) return;
    
    const data = {
      paragraphs,
      statistics,
      metadata: fileMetadata
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paragraphs_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full overflow-y-auto text-gray-900 dark:text-[#E2E2E2] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-cyan-400" />
        <div>
          <h2 className="text-2xl font-bold">段落处理工具</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            文件上传 → 段落拆分 → 单行清洗 → 向量入库
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {/* 左侧操作面板 */}
        <div className="md:col-span-1 space-y-4">
          {/* 文件上传 */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">文件上传</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors mb-2"
            >
              <Upload size={16} />
              {selectedFile ? selectedFile.name : '选择文件'}
            </button>
            
            {selectedFile && (
              <>
                <select
                  value={encodingOverride}
                  onChange={(e) => setEncodingOverride(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded mb-2"
                >
                  <option value="auto">Auto (推荐)</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="gbk">GBK</option>
                  <option value="gb18030">GB18030</option>
                  <option value="big5">Big5</option>
                </select>
                
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                  {isUploading ? '提取中...' : '提取文本'}
                </button>
              </>
            )}
            
            {fileMetadata && (
              <div className="mt-2 p-2 bg-white dark:bg-[#121212] rounded text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-gray-500">编码:</span>
                  <span className="font-mono">{fileMetadata.encoding}</span>
                  <span className="text-gray-500">置信度:</span>
                  <span className="font-mono">{fileMetadata.confidence?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 段落拆分配置 */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">段落拆分设置</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">最小字节数</label>
                  <input
                    type="number"
                    value={splitConfig.min_length}
                    onChange={(e) => setSplitConfig({...splitConfig, min_length: parseInt(e.target.value)})}
                    className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">最大字节数</label>
                  <input
                    type="number"
                    value={splitConfig.max_length}
                    onChange={(e) => setSplitConfig({...splitConfig, max_length: parseInt(e.target.value)})}
                    className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                  />
                </div>
              </div>
              
              <button
                onClick={handleSplit}
                disabled={isSplitting || !fileText}
                className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSplitting ? <Loader size={16} className="animate-spin" /> : <Scissors size={16} />}
                {isSplitting ? '拆分中...' : '开始拆分'}
              </button>
            </div>
          </div>
          
          {/* 入库操作 */}
          {paragraphs.length > 0 && (
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">入库操作</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Book ID (可选)"
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                />
                
                <button
                  onClick={handleIngest}
                  disabled={ingestStatus.status === 'processing'}
                  className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {ingestStatus.status === 'processing' ? <Loader size={16} className="animate-spin" /> : <Database size={16} />}
                  {ingestStatus.status === 'processing' ? '入库中...' : '开始入库'}
                </button>
                
                {ingestStatus.status !== 'idle' && (
                  <div className={`p-2 rounded text-sm ${
                    ingestStatus.status === 'processing' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                    ingestStatus.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                    'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {ingestStatus.status === 'success' && '✅ '}
                    {ingestStatus.status === 'failed' && <AlertTriangle className="inline w-4 h-4 mr-1" />}
                    {ingestStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
        
        {/* 右侧段落展示区 */}
        <div className="md:col-span-2">
          {paragraphs.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* 统计信息 */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    段落列表 ({statistics?.total_count || 0})
                  </h3>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-md transition-colors"
                  >
                    <Download size={14} />
                    导出JSON
                  </button>
                </div>
                
                {statistics && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="text-xs text-gray-500">总段落数</div>
                      <div className="text-lg font-bold text-blue-600">{statistics.total_count}</div>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-xs text-gray-500">平均字节数</div>
                      <div className="text-lg font-bold text-green-600">{statistics.avg_length_bytes}B</div>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <div className="text-xs text-gray-500">总字符数</div>
                      <div className="text-lg font-bold text-purple-600">{statistics.total_chars}</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 虚拟滚动列表 */}
              <div className="flex-1 overflow-hidden">
                <VirtualParagraphList paragraphs={paragraphs} />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/10 rounded-lg">
              <p className="text-gray-400 dark:text-gray-500">段落列表将显示在此处</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParagraphProcessingTool;
/**
 * 段落处理工具 - 新版界面
 * 
 * 功能流程:
 * 1. 文件上传 → 编码检测
 * 2. 段落拆分 → 清洗为单行
 * 3. 展示段落列表(虚拟滚动)
 * 4. 入库操作
 */

import React, { useState, useRef } from 'react';
import { Upload, Scissors, Database, FileText, Loader, Download, Check, AlertTriangle } from 'lucide-react';
import VirtualParagraphList from './VirtualParagraphList';
import { uploadAndExtractFile, splitParagraphs, Paragraph } from '../services/paragraphService';
import { ingestStoryText } from '../services/storyService';

const ParagraphProcessingTool: React.FC = () => {
  // 文件上传状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string>('');
  const [fileMetadata, setFileMetadata] = useState<any>(null);
  const [encodingOverride, setEncodingOverride] = useState<string>('auto');
  const [isUploading, setIsUploading] = useState(false);
  
  // 段落拆分状态
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitConfig, setSplitConfig] = useState({
    method: 'paragraph' as const,
    min_length: 120,
    max_length: 1800,
    clean_mode: 'strict' as const
  });
  
  // 入库状态
  const [bookId, setBookId] = useState<string>('');
  const [chapterIndex, setChapterIndex] = useState<number | undefined>(undefined);
  const [sectionIndex, setSectionIndex] = useState<number | undefined>(undefined);
  const [embeddingModel, setEmbeddingModel] = useState<string>('text-embedding-3-small');
  const [ingestStatus, setIngestStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'failed';
    message: string;
  }>({ status: 'idle', message: '' });
  
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 生成书籍ID
  const generateBookId = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `bk_${ts}_${rand}`;
  };
  
  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setParagraphs([]);
      setFileText('');
      setFileMetadata(null);
    }
  };
  
  // 上传并提取文件
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请先选择文件');
      return;
    }
    
    setIsUploading(true);
    setError('');
    
    try {
      const result = await uploadAndExtractFile(
        selectedFile,
        encodingOverride !== 'auto' ? encodingOverride : undefined,
        false
      );
      
      if (result.code === 0 && result.data) {
        setFileText(result.data.text);
        setFileMetadata(result.data);
      } else {
        throw new Error(result.message || '文件提取失败');
      }
    } catch (e: any) {
      setError(`上传失败: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  // 拆分段落
  const handleSplit = async () => {
    if (!fileText) {
      setError('请先上传文件');
      return;
    }
    
    setIsSplitting(true);
    setError('');
    
    try {
      const result = await splitParagraphs({
        text: fileText,
        config: splitConfig,
        metadata: {
          file_id: fileMetadata?.file_id,
          book_id: bookId || generateBookId()
        }
      });
      
      if (result.code === 0 && result.data) {
        setParagraphs(result.data.paragraphs);
        setStatistics(result.data.statistics);
      } else {
        throw new Error(result.message || '段落拆分失败');
      }
    } catch (e: any) {
      setError(`拆分失败: ${e.message}`);
    } finally {
      setIsSplitting(false);
    }
  };
  
  // 入库
  const handleIngest = async () => {
    if (paragraphs.length === 0) {
      setError('请先拆分段落');
      return;
    }
    
    setIngestStatus({ status: 'processing', message: '正在入库...' });
    setError('');
    
    try {
      const finalBookId = bookId || generateBookId();
      
      // 批量入库
      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];
        
        await ingestStoryText({
          text: para.content,
          bookId: finalBookId,
          chapterIndex,
          sectionIndex: typeof sectionIndex === 'number' ? sectionIndex + i : undefined,
          embeddingModel
        });
        
        // 更新进度
        setIngestStatus({
          status: 'processing',
          message: `正在入库 ${i + 1}/${paragraphs.length}...`
        });
      }
      
      setBookId(finalBookId);
      setIngestStatus({
        status: 'success',
        message: `成功入库 ${paragraphs.length} 个段落, bookId=${finalBookId}`
      });
    } catch (e: any) {
      setIngestStatus({
        status: 'failed',
        message: `入库失败: ${e.message}`
      });
      setError(`入库失败: ${e.message}`);
    }
  };
  
  // 导出JSON
  const handleExport = () => {
    if (paragraphs.length === 0) return;
    
    const data = {
      paragraphs,
      statistics,
      metadata: fileMetadata
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paragraphs_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full overflow-y-auto text-gray-900 dark:text-[#E2E2E2] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-cyan-400" />
        <div>
          <h2 className="text-2xl font-bold">段落处理工具</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            文件上传 → 段落拆分 → 单行清洗 → 向量入库
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {/* 左侧操作面板 */}
        <div className="md:col-span-1 space-y-4">
          {/* 文件上传 */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">文件上传</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors mb-2"
            >
              <Upload size={16} />
              {selectedFile ? selectedFile.name : '选择文件'}
            </button>
            
            {selectedFile && (
              <>
                <select
                  value={encodingOverride}
                  onChange={(e) => setEncodingOverride(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded mb-2"
                >
                  <option value="auto">Auto (推荐)</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="gbk">GBK</option>
                  <option value="gb18030">GB18030</option>
                  <option value="big5">Big5</option>
                </select>
                
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                  {isUploading ? '提取中...' : '提取文本'}
                </button>
              </>
            )}
            
            {fileMetadata && (
              <div className="mt-2 p-2 bg-white dark:bg-[#121212] rounded text-xs">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-gray-500">编码:</span>
                  <span className="font-mono">{fileMetadata.encoding}</span>
                  <span className="text-gray-500">置信度:</span>
                  <span className="font-mono">{fileMetadata.confidence?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* 段落拆分配置 */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">段落拆分设置</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">最小字节数</label>
                  <input
                    type="number"
                    value={splitConfig.min_length}
                    onChange={(e) => setSplitConfig({...splitConfig, min_length: parseInt(e.target.value)})}
                    className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400">最大字节数</label>
                  <input
                    type="number"
                    value={splitConfig.max_length}
                    onChange={(e) => setSplitConfig({...splitConfig, max_length: parseInt(e.target.value)})}
                    className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                  />
                </div>
              </div>
              
              <button
                onClick={handleSplit}
                disabled={isSplitting || !fileText}
                className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSplitting ? <Loader size={16} className="animate-spin" /> : <Scissors size={16} />}
                {isSplitting ? '拆分中...' : '开始拆分'}
              </button>
            </div>
          </div>
          
          {/* 入库操作 */}
          {paragraphs.length > 0 && (
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">入库操作</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Book ID (可选)"
                  value={bookId}
                  onChange={(e) => setBookId(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] rounded"
                />
                
                <button
                  onClick={handleIngest}
                  disabled={ingestStatus.status === 'processing'}
                  className="w-full flex items-center justify-center gap-2 h-10 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {ingestStatus.status === 'processing' ? <Loader size={16} className="animate-spin" /> : <Database size={16} />}
                  {ingestStatus.status === 'processing' ? '入库中...' : '开始入库'}
                </button>
                
                {ingestStatus.status !== 'idle' && (
                  <div className={`p-2 rounded text-sm ${
                    ingestStatus.status === 'processing' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                    ingestStatus.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                    'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {ingestStatus.status === 'success' && '✅ '}
                    {ingestStatus.status === 'failed' && <AlertTriangle className="inline w-4 h-4 mr-1" />}
                    {ingestStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
        
        {/* 右侧段落展示区 */}
        <div className="md:col-span-2">
          {paragraphs.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* 统计信息 */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    段落列表 ({statistics?.total_count || 0})
                  </h3>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-md transition-colors"
                  >
                    <Download size={14} />
                    导出JSON
                  </button>
                </div>
                
                {statistics && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="text-xs text-gray-500">总段落数</div>
                      <div className="text-lg font-bold text-blue-600">{statistics.total_count}</div>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-xs text-gray-500">平均字节数</div>
                      <div className="text-lg font-bold text-green-600">{statistics.avg_length_bytes}B</div>
                    </div>
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <div className="text-xs text-gray-500">总字符数</div>
                      <div className="text-lg font-bold text-purple-600">{statistics.total_chars}</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 虚拟滚动列表 */}
              <div className="flex-1 overflow-hidden">
                <VirtualParagraphList paragraphs={paragraphs} />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/10 rounded-lg">
              <p className="text-gray-400 dark:text-gray-500">段落列表将显示在此处</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParagraphProcessingTool;

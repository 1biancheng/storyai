import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, File, Film, Music, Archive, AlertCircle, CheckCircle } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  preview?: string;
}

interface FileUploadToolProps {
  onFileUpload?: (files: UploadedFile[]) => void;
  maxFileSize?: number; // MB
  maxFileCount?: number;
  acceptedFileTypes?: string[];
  className?: string;
}

const FileUploadTool: React.FC<FileUploadToolProps> = ({
  onFileUpload,
  maxFileSize = 10, // 默认10MB
  maxFileCount = 5,
  acceptedFileTypes = ['image/*', 'text/*', 'application/pdf', '.doc,.docx,.txt'],
  className = ''
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
    if (fileType.startsWith('video/')) return <Film className="w-5 h-5 text-purple-500" />;
    if (fileType.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-500" />;
    if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) 
      return <FileText className="w-5 h-5 text-blue-500" />;
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar')) 
      return <Archive className="w-5 h-5 text-yellow-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  // 验证文件
  const validateFile = (file: File): string | null => {
    // 检查文件大小
    if (file.size > maxFileSize * 1024 * 1024) {
      return `文件大小超过限制 (${maxFileSize}MB)`;
    }

    // 检查文件数量
    if (uploadedFiles.length >= maxFileCount) {
      return `文件数量超过限制 (最多${maxFileCount}个文件)`;
    }

    // 检查文件类型
    const isAccepted = acceptedFileTypes.some(type => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -2));
      }
      return file.type === type;
    });

    if (!isAccepted) {
      return '不支持的文件类型';
    }

    return null;
  };

  // 处理文件上传
  const handleFiles = useCallback((files: FileList) => {
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
        return;
      }

      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substring(2),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      };

      newFiles.push(newFile);
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (newFiles.length === 0) return;

    // 添加到上传列表
    setUploadedFiles(prev => [...prev, ...newFiles]);

    // 模拟上传过程
    newFiles.forEach(file => {
      simulateFileUpload(file);
    });
  }, [uploadedFiles.length, maxFileSize, maxFileCount, acceptedFileTypes]);

  // 模拟文件上传
  const simulateFileUpload = (file: UploadedFile) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        // 更新文件状态为成功
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'success', url: `https://example.com/files/${file.id}` }
              : f
          )
        );

        // 设置上传进度为100%
        setUploadProgress(prev => ({ ...prev, [file.id]: 100 }));
      } else {
        // 更新上传进度
        setUploadProgress(prev => ({ ...prev, [file.id]: progress }));
      }
    }, 300);
  };

  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // 重置input值，允许重复选择同一文件
    e.target.value = '';
  };

  // 删除文件
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  // 通知父组件文件上传完成
  React.useEffect(() => {
    const successfulFiles = uploadedFiles.filter(f => f.status === 'success');
    if (successfulFiles.length > 0 && onFileUpload) {
      onFileUpload(successfulFiles);
    }
  }, [uploadedFiles, onFileUpload]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <Upload className="w-4 h-4 mr-2" />
          文件上传
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          支持图片、文档等多种文件类型，单个文件最大 {maxFileSize}MB，最多上传 {maxFileCount} 个文件
        </p>
      </div>
      
      <div className="p-4">
        {/* 拖拽上传区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            拖拽文件到此处或点击上传
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            选择文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* 文件列表 */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              已上传文件 ({uploadedFiles.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadedFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-md"
                >
                  {/* 文件图标/预览 */}
                  <div className="mr-3 flex-shrink-0">
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      getFileIcon(file.type)
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      {file.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-500 ml-2 flex-shrink-0" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-500 ml-2 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                      {file.status === 'uploading' && uploadProgress[file.id] !== undefined && (
                        <>
                          <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(uploadProgress[file.id])}%
                          </p>
                        </>
                      )}
                    </div>

                    {/* 上传进度条 */}
                    {file.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[file.id] || 0}%` }}
                        />
                      </div>
                    )}

                    {/* 错误信息 */}
                    {file.status === 'error' && file.error && (
                      <p className="text-xs text-red-500 mt-1">{file.error}</p>
                    )}
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadTool;
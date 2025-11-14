# 如何禁用 textract

## 问题背景

textract 现在**默认启用**(`enable_textract: bool = Field(default=True)`),但某些环境下可能需要禁用:
- 系统缺少依赖(Poppler、Antiword)
- 仅需处理纯文本文件
- 降低资源消耗

## 禁用方法

### 方法 1:环境变量(推荐)

在 `.env` 文件中设置:

```bash
# 禁用 textract
FILE_EXTRACTION__ENABLE_TEXTRACT=false

# 同时可以禁用 markitdown
FILE_EXTRACTION__ENABLE_MARKITDOWN=false
```

### 方法 2:API 参数覆盖

前端调用 `/ingest-file` 时,可通过请求头或参数覆盖:

```typescript
// 在 storyService.ts 中
await ingestFile({
  file: selectedFile,
  preserve_structure: false,  // 禁用结构保留会跳过 markitdown
  // 注意:目前API不支持动态禁用textract,需通过环境变量控制
})
```

### 方法 3:修改配置文件

编辑 `backend/config.py`:

```python
class FileExtractionSettings(BaseSettings):
    enable_textract: bool = Field(default=False, description="...")  # 改为 False
    enable_markitdown: bool = Field(default=False, description="...")
```

⚠️ **不推荐**此方法,因为会影响所有环境,应使用环境变量.

## 降级行为

当 textract 和 markitdown 都禁用时,系统会自动降级到:

1. **纯文本文件(.txt)**:使用 charset-normalizer 编码检测 + 直接解码
2. **富格式文件(.pdf/.docx 等)**:返回错误或空文本(因为无法提取)

## 推荐配置

### 开发环境(无系统依赖)
```bash
FILE_EXTRACTION__ENABLE_TEXTRACT=false
FILE_EXTRACTION__ENABLE_MARKITDOWN=false
```

### 生产环境(完整功能)
```bash
FILE_EXTRACTION__ENABLE_TEXTRACT=true
FILE_EXTRACTION__ENABLE_MARKITDOWN=true
FILE_EXTRACTION__CONFIDENCE_THRESHOLD=0.8
```

## 验证状态

启动服务后查看日志:

```bash
# 如果 textract 被禁用或未安装
WARNING: textract not available, will skip PDF/DOC extraction

# 如果 markitdown 被禁用或未安装
WARNING: markitdown not available, will use textract fallback
```

## 系统依赖安装(仅在需要启用时)

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install poppler-utils antiword
pip install textract
```

### macOS
```bash
brew install poppler antiword
pip install textract
```

### Windows
使用预编译二进制或 WSL2 环境
# 如何禁用 textract

## 问题背景

textract 现在**默认启用**(`enable_textract: bool = Field(default=True)`),但某些环境下可能需要禁用:
- 系统缺少依赖(Poppler、Antiword)
- 仅需处理纯文本文件
- 降低资源消耗

## 禁用方法

### 方法 1:环境变量(推荐)

在 `.env` 文件中设置:

```bash
# 禁用 textract
FILE_EXTRACTION__ENABLE_TEXTRACT=false

# 同时可以禁用 markitdown
FILE_EXTRACTION__ENABLE_MARKITDOWN=false
```

### 方法 2:API 参数覆盖

前端调用 `/ingest-file` 时,可通过请求头或参数覆盖:

```typescript
// 在 storyService.ts 中
await ingestFile({
  file: selectedFile,
  preserve_structure: false,  // 禁用结构保留会跳过 markitdown
  // 注意:目前API不支持动态禁用textract,需通过环境变量控制
})
```

### 方法 3:修改配置文件

编辑 `backend/config.py`:

```python
class FileExtractionSettings(BaseSettings):
    enable_textract: bool = Field(default=False, description="...")  # 改为 False
    enable_markitdown: bool = Field(default=False, description="...")
```

⚠️ **不推荐**此方法,因为会影响所有环境,应使用环境变量.

## 降级行为

当 textract 和 markitdown 都禁用时,系统会自动降级到:

1. **纯文本文件(.txt)**:使用 charset-normalizer 编码检测 + 直接解码
2. **富格式文件(.pdf/.docx 等)**:返回错误或空文本(因为无法提取)

## 推荐配置

### 开发环境(无系统依赖)
```bash
FILE_EXTRACTION__ENABLE_TEXTRACT=false
FILE_EXTRACTION__ENABLE_MARKITDOWN=false
```

### 生产环境(完整功能)
```bash
FILE_EXTRACTION__ENABLE_TEXTRACT=true
FILE_EXTRACTION__ENABLE_MARKITDOWN=true
FILE_EXTRACTION__CONFIDENCE_THRESHOLD=0.8
```

## 验证状态

启动服务后查看日志:

```bash
# 如果 textract 被禁用或未安装
WARNING: textract not available, will skip PDF/DOC extraction

# 如果 markitdown 被禁用或未安装
WARNING: markitdown not available, will use textract fallback
```

## 系统依赖安装(仅在需要启用时)

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install poppler-utils antiword
pip install textract
```

### macOS
```bash
brew install poppler antiword
pip install textract
```

### Windows
使用预编译二进制或 WSL2 环境

# Story AI - 智能小说创作平台

一个基于多智能体协作和先进AI技术的全流程小说创作平台,提供从创意构思到内容生成的智能化解决方案.

## 🌟 核心特性

### 智能创作引擎
- **多智能体协作系统**: 协调器、数据分析、大纲生成、章节写作等专业智能体协同工作
- **ComRAG记忆机制**: 基于质心的多维质量评分记忆系统,支持高质量内容检索
- **多维质量评分**: 综合LLM评分、用户反馈、使用频率、向量聚类等因素
- **情感曲线分析**: 自动生成情感波动曲线,优化叙事节奏

### 可视化工作流
- **拖拽式工作流编辑器**: 支持智能体、LLM、工具、数据等多种节点类型
- **实时执行监控**: 实时显示工作流执行状态和日志
- **灵活节点配置**: 支持代码解释器、图像生成、语音合成等工具集成

### 多模型支持
- **OpenAI系列**: GPT-4、GPT-3.5等模型
- **Anthropic Claude**: 支持Claude系列模型
- **国产大模型**: 支持国内主流AI模型
- **模型路由**: 智能选择最适合的模型完成任务

### 高级功能
- **章节管理系统**: 支持章节创建、编辑、版本控制
- **场景卡片**: 可视化场景管理和提示词卡片系统
- **实时协作**: 支持多人协作创作
- **版本历史**: 完整的版本追踪和回滚机制

## 🏗️ 技术架构

### 前端技术栈
- **React 18** + **TypeScript**: 现代化前端开发框架
- **Tailwind CSS**: 原子化CSS框架,快速构建美观界面
- **Vite**: 快速的前端构建工具
- **Zustand**: 轻量级状态管理
- **Lucide React**: 优雅的图标库
- **React Flow**: 工作流可视化库

### 后端技术栈
- **Python** + **FastAPI**: 高性能异步Web框架
- **PostgreSQL** + **pgvector**: 支持向量存储的关系型数据库
- **Apache AGE**: 图数据库扩展,支持复杂关系查询
- **Redis**: 高性能缓存和消息队列
- **SQLAlchemy**: ORM框架,支持异步操作

### AI/ML技术
- **OpenAI API**: GPT系列模型集成
- **Anthropic API**: Claude模型集成
- **Sentence Transformers**: 文本向量化
- **scikit-learn**: 机器学习算法库
- **Jieba**: 中文分词处理

### 文档处理
- **Textract**: 文档内容提取
- **MarkItDown**: Markdown文档处理
- **charset-normalizer**: 字符编码自动检测

## 📁 项目结构

```
story-ai/
├── backend/                    # 后端服务
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── requirements.txt     # Python依赖
│   ├── routers/            # API路由模块
│   │   ├── ai.py           # AI模型相关接口
│   │   ├── workflows.py    # 工作流管理接口
│   │   ├── projects.py     # 项目管理接口
│   │   ├── chapters.py     # 章节管理接口
│   │   ├── books.py        # 书籍管理接口
│   │   ├── file_upload.py  # 文件上传接口
│   │   └── system.py       # 系统管理接口
│   ├── services/           # 业务逻辑层
│   │   ├── ai_service.py       # AI模型服务
│   │   ├── comrag_service.py   # ComRAG记忆服务
│   │   ├── workflow_service.py # 工作流执行服务
│   │   ├── file_service.py     # 文件处理服务
│   │   └── project_service.py  # 项目管理服务
│   ├── models/            # 数据模型
│   └── scripts/          # 工具脚本
├── components/             # React组件
│   ├── AgentWorkflowEditor.tsx   # 工作流编辑器
│   ├── CardEditor.tsx           # 卡片编辑器
│   ├── ChapterEditor.tsx        # 章节编辑器
│   ├── ProjectManager.tsx       # 项目管理器
│   └── ui/                      # 基础UI组件
├── services/              # 前端服务层
│   ├── api.ts            # API调用封装
│   ├── workflowManager.ts # 工作流管理
│   └── sseService.ts     # SSE服务
├── stores/                # 状态管理
│   ├── workflowStore.ts  # 工作流状态
│   └── projectStore.ts   # 项目状态
├── src/                   # 源码目录
├── public/                # 静态资源
├── docs/                  # 项目文档
├── sample_data/          # 示例数据
└── utils/                # 工具函数
```

## 🔧 核心组件详解

### ComRAG服务 (backend/services/comrag_service.py)
- **多维质量评分**: 综合LLM评分、用户反馈、使用频率、向量聚类计算最终质量分数
- **质心向量计算**: 基于段落嵌入向量计算聚类质心
- **聚类紧密度**: 计算向量与质心的方差,评估聚类质量
- **记忆库管理**: 区分高质量和低质量记忆库,优化检索效率

### 工作流系统
- **工作流编辑器** (components/AgentWorkflowEditor.tsx): 可视化拖拽界面
- **工作流执行器** (backend/services/workflow_service.py): 异步执行工作流节点
- **事件流** (backend/routers/workflows.py): SSE实时推送执行状态
- **节点类型**: 智能体、LLM、工具、数据四大类别

### 项目管理
- **项目数据模型**: 支持自定义字段、情感分析、偏好分析
- **章节管理**: 章节创建、编辑、状态跟踪
- **版本控制**: 完整的历史版本记录
- **协作功能**: 多人实时协作支持

## 🚀 快速开始

### 环境要求
- Node.js 16+
- Python 3.8+
- PostgreSQL 12+ (支持pgvector扩展)
- Redis 6+

### 前端安装
```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 设置必要的API密钥

# 启动开发服务器
npm run dev
```

### 后端安装
```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置数据库和API配置

# 初始化数据库
python scripts/init_db.py

# 启动后端服务
python main.py
```

### Docker部署
```bash
# 使用Docker Compose一键部署
docker-compose up -d

# 服务将运行在:
# - 前端: http://localhost:3000
# - 后端: http://localhost:8000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

## 📋 配置说明

### 环境变量

#### 后端配置 (.env)
```bash
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/story_ai
DB_HOST=localhost
DB_PORT=5432
DB_NAME=story_ai
DB_USER=username
DB_PASSWORD=password

# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# AI模型配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4
ANTHROPIC_API_KEY=your_anthropic_api_key

# 服务器配置
HOST=0.0.0.0
PORT=8000
DEBUG=false
RELOAD=false
WORKERS=4

# 安全配置
SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

#### 前端配置 (.env.local)
```bash
# API基础URL
VITE_API_BASE_URL=http://localhost:8000

# AI模型配置
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_DEFAULT_MODEL=gpt-4

# 功能开关
VITE_ENABLE_ADVANCED_FEATURES=true
VITE_ENABLE_REAL_TIME_COLLABORATION=true
```

## 🔌 API文档

启动后端服务后,访问以下地址查看完整的API文档:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 主要API端点

#### 工作流管理
- `POST /api/workflows/run` - 执行工作流
- `GET /api/workflows/stream/{execution_id}` - 获取执行事件流
- `GET /api/workflows/{workflow_id}` - 获取工作流详情

#### 项目管理
- `POST /api/projects` - 创建项目
- `GET /api/projects/{project_id}` - 获取项目详情
- `PUT /api/projects/{project_id}` - 更新项目
- `DELETE /api/projects/{project_id}` - 删除项目

#### AI模型
- `POST /api/ai/generate` - 文本生成
- `POST /api/ai/chat` - 对话接口
- `GET /api/ai/models` - 获取可用模型列表

#### 章节管理
- `POST /api/chapters` - 创建章节
- `GET /api/chapters/{chapter_id}` - 获取章节内容
- `PUT /api/chapters/{chapter_id}` - 更新章节
- `DELETE /api/chapters/{chapter_id}` - 删除章节

## 🧪 开发指南

### 添加新的AI模型
1. 在 `backend/services/ai_service.py` 中添加模型配置
2. 实现模型调用逻辑
3. 更新前端模型选择器组件
4. 添加相应的测试用例

### 扩展工作流节点类型
1. 在 `types.ts` 中定义新的节点类型
2. 在 `components/AgentWorkflowEditor.tsx` 中添加节点组件
3. 在 `backend/services/workflow_service.py` 中实现执行逻辑
4. 更新工作流验证规则

### 添加新的文件处理功能
1. 在 `backend/services/file_service.py` 中实现处理逻辑
2. 添加相应的文件类型支持
3. 更新前端文件上传组件
4. 添加错误处理和验证

### 数据库扩展
1. 在 `backend/models/` 中创建新的数据模型
2. 使用Alembic创建数据库迁移
3. 更新相应的CRUD操作
4. 添加数据库索引优化

## 📊 性能优化

### 数据库优化
- 使用pgvector进行高效的向量相似度搜索
- 为常用查询字段添加索引
- 实现数据库连接池管理
- 使用Redis缓存热点数据

### 前端优化
- 实现虚拟滚动处理大量数据
- 使用React.memo和useMemo优化渲染
- 实现懒加载和代码分割
- 使用Web Workers处理复杂计算

### 后端优化
- 使用异步编程提高并发性能
- 实现请求限流和熔断机制
- 使用连接池管理数据库连接
- 实现API响应缓存

## 🔒 安全考虑

### 数据安全
- 使用JWT进行身份验证
- 实现API请求签名验证
- 对敏感数据进行加密存储
- 实现数据脱敏处理

### 访问控制
- 基于角色的权限管理
- API访问频率限制
- 文件上传类型和大小限制
- SQL注入防护

### 隐私保护
- 用户数据匿名化处理
- 实现数据删除机制
- 遵守GDPR等隐私法规
- 透明的数据使用政策

## 🧪 测试策略

### 单元测试
- 后端使用pytest进行单元测试
- 前端使用Jest和React Testing Library
- 达到80%以上的代码覆盖率

### 集成测试
- API接口集成测试
- 数据库操作测试
- 第三方服务集成测试

### 端到端测试
- 使用Cypress进行E2E测试
- 测试关键用户流程
- 跨浏览器兼容性测试

## 📈 监控和日志

### 应用监控
- 使用Prometheus收集指标
- Grafana仪表盘展示
- 自定义业务指标监控
- 性能瓶颈分析

### 日志管理
- 结构化日志输出
- 日志级别动态调整
- 错误日志聚合分析
- 审计日志记录

### 健康检查
- 数据库连接检查
- Redis连接检查
- 第三方服务可用性检查
- 自定义健康指标

## 🔄 部署策略

### 容器化部署
- 使用Docker进行容器化
- Kubernetes集群管理
- 自动扩缩容配置
- 蓝绿部署策略

### CI/CD流程
- GitHub Actions自动化构建
- 自动化测试执行
- 代码质量检查
- 自动部署到测试环境

### 环境管理
- 开发、测试、生产环境分离
- 环境变量管理
- 数据库迁移管理
- 配置版本控制

## 📚 相关文档

- [API文档](http://localhost:8000/docs)
- [数据库设计](docs/database_design.md)
- [架构设计](docs/architecture.md)
- [部署指南](docs/deployment.md)
- [开发规范](docs/development.md)

## 🤝 贡献指南

1. Fork项目到您的GitHub账户
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

### 代码规范
- 遵循PEP 8 (Python)和ESLint (JavaScript/TypeScript)规范
- 添加适当的注释和文档字符串
- 编写单元测试
- 更新相关文档

## 📄 许可证

本项目采用 [Apache-2.0](LICENSE) 许可证 - 详见 [LICENSE](LICENSE) 文件.

## 🆘 支持

如果您遇到问题或有建议,请通过以下方式联系我们:
- 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 发送邮件至: support@story-ai.com
- 加入我们的 [Discord社区](https://discord.gg/story-ai)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和贡献者.特别感谢以下开源项目:
- [FastAPI](https://fastapi.tiangolo.com/) - 现代、快速的Web框架
- [React](https://reactjs.org/) - 用于构建用户界面的JavaScript库
- [PostgreSQL](https://www.postgresql.org/) - 强大的开源数据库
- [Redis](https://redis.io/) - 高性能的内存数据结构存储

---

**⭐ 如果这个项目对您有帮助,请给我们一个Star!**
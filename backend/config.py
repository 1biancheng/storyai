"""
统一配置管理系统
使用 Pydantic BaseSettings 管理应用程序配置
支持环境变量、.env 文件和类型验证
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """数据库配置"""
    host: str = Field(default="localhost", description="数据库主机")
    port: int = Field(default=5432, description="数据库端口")
    name: str = Field(default="story_ai", description="数据库名称")
    username: str = Field(default="postgres", description="数据库用户名")
    password: str = Field(default="postgres123", description="数据库密码")
    enabled: bool = Field(default=False, description="是否启用数据库")
    
    @property
    def url(self) -> str:
        """构建数据库连接URL"""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.name}"


class RedisSettings(BaseSettings):
    """Redis配置"""
    host: str = Field(default="localhost", description="Redis主机")
    port: int = Field(default=6379, description="Redis端口")
    password: Optional[str] = Field(default=None, description="Redis密码")
    db: int = Field(default=0, description="Redis数据库编号")
    enabled: bool = Field(default=False, description="是否启用Redis")
    max_connections: int = Field(default=10, description="最大连接数")
    
    @property
    def url(self) -> str:
        """构建Redis连接URL"""
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"


class AISettings(BaseSettings):
    """AI服务配置"""
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API密钥")
    openai_base_url: str = Field(default="https://api.openai.com/v1", description="OpenAI API基础URL")
    default_model: str = Field(default="gpt-3.5-turbo", description="默认AI模型")
    max_tokens: int = Field(default=2000, description="最大token数")
    temperature: float = Field(default=0.7, description="生成温度")
    enable_dev_embeddings: bool = Field(default=True, description="开发环境启用嵌入回退(无密钥也可运行)")
    
    @validator('temperature')
    def validate_temperature(cls, v):
        if not 0 <= v <= 2:
            raise ValueError('temperature must be between 0 and 2')
        return v


class ServerSettings(BaseSettings):
    """服务器配置"""
    host: str = Field(default="127.0.0.1", description="服务器主机")
    port: int = Field(default=8000, description="服务器端口")
    debug: bool = Field(default=False, description="调试模式")
    reload: bool = Field(default=False, description="自动重载")
    workers: int = Field(default=1, description="工作进程数")


class SecuritySettings(BaseSettings):
    """安全配置"""
    algorithm: str = Field(default="HS256", description="JWT算法")
    access_token_expire_minutes: int = Field(default=30, description="访问令牌过期时间(分钟)")


class CORSSettings(BaseSettings):
    """CORS配置"""
    allow_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            # 兼容 Trae 预览默认的 127.0.0.1 访问
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3002",
        ],
        description="允许的源"
    )
    allow_credentials: bool = Field(default=True, description="允许凭据")
    allow_methods: list[str] = Field(default=["*"], description="允许的方法")
    allow_headers: list[str] = Field(default=["*"], description="允许的头部")


class FileExtractionSettings(BaseSettings):
    """File extraction configuration (three-articles integration)"""
    enable_textract: bool = Field(default=True, description="Enable textract (requires system dependencies: poppler, antiword)")
    enable_markitdown: bool = Field(default=True, description="Enable markitdown")
    default_encoding: str = Field(default="utf-8", description="Default text encoding")
    confidence_threshold: float = Field(default=0.8, description="charset-normalizer coherence threshold")
    cache_ttl: int = Field(default=604800, description="File cache TTL in seconds (7 days)")
    max_file_size: int = Field(default=10*1024*1024, description="Max file size 10MB, auto chunking above")
    chunk_size: int = Field(default=5*1024*1024, description="Chunk size for large files 5MB")


class SearchEngineSettings(BaseSettings):
    """搜索引擎配置"""
    default_engine: str = Field(default="duckduckgo", description="默认搜索引擎 (duckduckgo, bing, google)")
    bing_api_key: Optional[str] = Field(default=None, description="Bing搜索API密钥")
    google_api_key: Optional[str] = Field(default=None, description="Google搜索API密钥")
    google_search_engine_id: Optional[str] = Field(default=None, description="Google自定义搜索引擎ID")
    timeout: float = Field(default=15.0, description="搜索超时时间(秒)")
    max_retries: int = Field(default=2, description="搜索失败重试次数")
    enable_proxy: bool = Field(default=False, description="是否启用代理")
    proxy_url: Optional[str] = Field(default=None, description="代理服务器URL")


class Settings(BaseSettings):
    """Main configuration class"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application basic info
    app_name: str = Field(default="Story AI API", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    environment: str = Field(default="development", description="Runtime environment")
    debug: bool = Field(default=False, description="Debug mode")
    log_level: str = Field(default="INFO", description="Log level")
    secret_key: str = Field(default="dev-secret-key-min-32-chars-long-change-in-production", description="Application secret key")
    
    # Workspace directory (backend目录下的workspace,通过API提供文件存储)
    workspace_dir: Path = Field(
        default=Path(__file__).parent / "workspace",
        description="Workspace directory for file storage in backend"
    )
    
    # Module configurations
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    ai: AISettings = Field(default_factory=AISettings)
    server: ServerSettings = Field(default_factory=ServerSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    cors: CORSSettings = Field(default_factory=CORSSettings)
    file_extraction: FileExtractionSettings = Field(default_factory=FileExtractionSettings)
    search_engine: SearchEngineSettings = Field(default_factory=SearchEngineSettings)
    
    # Log configuration
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format"
    )
    
    # Cache configuration
    cache_ttl: int = Field(default=300, description="Cache TTL (seconds)")
    cache_max_size: int = Field(default=1000, description="Memory cache max size")

    # Upload configuration
    upload_dir: str = Field(default="./uploads", description="File upload directory")
    max_file_size: int = Field(default=10 * 1024 * 1024, description="Max upload file size (bytes)")
    
    # Batch processing configuration
    batch_size: int = Field(default=64, description="Embedding API batch size (1-100)")
    overlength_threshold: int = Field(default=1000, description="Paragraph char count threshold for manual editing")
    embed_api_timeout: int = Field(default=30, description="Embedding API request timeout (seconds)")
    embed_retry_max: int = Field(default=3, description="Max retries for embedding API failures")
    task_timeout_seconds: int = Field(default=1800, description="Max task execution time (30 minutes)")
    
    @validator('environment')
    def validate_environment(cls, v):
        allowed_envs = ['development', 'testing', 'staging', 'production']
        if v not in allowed_envs:
            raise ValueError(f'environment must be one of {allowed_envs}')
        return v
    
    @validator('secret_key')
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError('secret_key must be at least 32 characters long')
        return v
    
    @property
    def is_development(self) -> bool:
        """是否为开发环境"""
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        """是否为生产环境"""
        return self.environment == "production"
    
    def get_database_url(self) -> str:
        """获取数据库连接URL"""
        return self.database.url
    
    def get_redis_url(self) -> str:
        """获取Redis连接URL"""
        return self.redis.url


# 创建全局配置实例
settings = Settings()


def get_settings() -> Settings:
    """获取配置实例 - 用于依赖注入"""
    return settings


# 导出常用配置
__all__ = [
    "Settings",
    "DatabaseSettings", 
    "RedisSettings",
    "AISettings",
    "ServerSettings",
    "SecuritySettings",
    "CORSSettings",
    "FileExtractionSettings",
    "SearchEngineSettings",
    "settings",
    "get_settings"
]

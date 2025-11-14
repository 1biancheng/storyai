#!/usr/bin/env python3
"""测试配置加载"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class TestSettings(BaseSettings):
    """测试配置类"""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    secret_key: str = Field(description="应用密钥")
    app_name: str = Field(default="Test App", description="应用名称")

if __name__ == "__main__":
    try:
        settings = TestSettings()
        print(f"配置加载成功:")
        print(f"  APP_NAME: {settings.app_name}")
        print(f"  SECRET_KEY: {settings.secret_key[:20]}...")
    except Exception as e:
        print(f"配置加载失败: {e}")
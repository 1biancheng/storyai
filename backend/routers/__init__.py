"""
路由模块初始化文件
"""

# 导入所有路由模块,确保它们可以被正确导入
from . import ai
from . import db
from . import models
from . import projects
from . import sse
from . import system
from . import workflows
from . import story
from . import books
from . import tools

__all__ = [
    "ai",
    "db", 
    "models",
    "projects",
    "sse",
    "system",
    "workflows",
    "story",
    "books",
    "tools"
]

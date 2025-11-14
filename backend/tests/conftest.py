import os
import sys
from pathlib import Path

# 确保后端根目录加入到 sys.path 以便 tests 中可导入 services.*
BASE = Path(__file__).resolve().parents[1]
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

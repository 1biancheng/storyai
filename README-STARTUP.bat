@echo off
echo ========================================
echo      StoryAI 项目启动指南
echo ========================================
echo.
echo 本目录提供了以下启动脚本:
echo.
echo [1] start-dev.bat      - 一键启动前后端开发环境
        echo     自动启动后端(8000) + 前端(5173) + 打开浏览器
        echo     按任意键可停止所有服务
        echo.
echo [2] start-backend.bat  - 单独启动后端服务
        echo     端口:8000,支持自动安装依赖
        echo.
echo [3] start-frontend.bat - 单独启动前端开发服务  
        echo     端口:5173,支持自动安装依赖
        echo.
echo [4] preview.bat        - 启动前端预览服务
        echo     端口:4173,需要先构建项目(npm run build)
        echo.
echo [5] stop-all.bat       - 强制停止所有相关服务
        echo     关闭所有端口和进程
        echo.
echo ========================================
echo 使用说明:
echo 1. 首次使用建议先运行 start-backend.bat 和 start-frontend.bat 分别测试
        echo 2. 确认无误后可使用 start-dev.bat 一键启动
        echo 3. 开发完成后可使用 preview.bat 预览生产构建
        echo 4. 任何时候可使用 stop-all.bat 停止所有服务
        echo.
echo 端口说明:
echo - 后端API: http://localhost:8000
echo - 前端开发: http://localhost:3000  
echo - 前端预览: http://localhost:4173
echo - API文档: http://localhost:8000/docs
echo ========================================
pause
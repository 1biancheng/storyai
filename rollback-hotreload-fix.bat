@echo off
REM 回滚热重载修复提交
REM 提交哈希: d799e0e
REM 提交信息: feat: 优化章节管理防止热重载 - 使用useShallow和乐观更新策略

echo ==========================================
echo 准备回滚到修复之前的状态
echo ==========================================
echo.

REM 显示当前状态
echo 当前状态:
git log --oneline -3
echo.

REM 询问确认
set /p confirm="确定要回滚到上一个提交吗? (y/n): "
if /i not "%confirm%"=="y" (
    echo 已取消回滚操作
    pause
    exit /b 0
)

echo.
echo 执行回滚...
git reset --hard HEAD~1

echo.
echo ==========================================
echo 回滚完成!
echo ==========================================
echo.
echo 当前状态:
git log --oneline -3
echo.

pause

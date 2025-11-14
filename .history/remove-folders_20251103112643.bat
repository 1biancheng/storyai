@echo off
echo 正在删除远程仓库中的不需要的文件夹...
echo.

echo 1. 拉取最新代码
git pull origin main

echo.
echo 2. 删除qoder文件夹(如果存在)
git rm -r --cached qoder

echo.
echo 3. 删除trae文件夹(如果存在)
git rm -r --cached trae

echo.
echo 4. 删除.history文件夹(如果存在)
git rm -r --cached .history

echo.
echo 5. 提交更改
git commit -m "删除不需要的文件夹:qoder、trae和.history"

echo.
echo 6. 推送到远程仓库
git push origin main

echo.
echo 完成!
pause
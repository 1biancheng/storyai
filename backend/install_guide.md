# Windows 数据库安装指南

由于Docker未安装,我们需要在Windows上直接安装PostgreSQL和Redis.

## PostgreSQL 安装

### 方法1:官方安装程序(推荐)
1. 访问 [PostgreSQL Windows 下载页面](https://www.postgresql.org/download/windows/)
2. 下载 EDB 提供的官方安装程序
3. 运行安装程序,按照向导完成安装:
   - 选择安装目录
   - 选择组件(包括 PostgreSQL Server、pgAdmin 4、命令行工具)
   - 设置数据目录
   - 设置超级用户密码(建议:postgres123)
   - 设置端口(默认:5432)
   - 选择区域设置

### 安装 pgvector 扩展
1. 下载 pgvector 扩展:
   ```bash
   # 使用 git 克隆或下载预编译版本
   # 或者使用 Stack Builder 安装
   ```

## Redis 安装

### 方法1:MSI 安装程序(推荐)
1. 下载 Redis Windows 版本:
   - [Redis-x64-5.0.14.1.msi](https://sourceforge.net/projects/redis-for-windows.mirror/files/v5.0.14.1/Redis-x64-5.0.14.1.msi/download)
2. 运行 MSI 安装程序
3. 安装时选择:
   - 添加到 PATH 环境变量
   - 默认端口:6379
   - 内存限制:根据需要设置

### 方法2:WSL(Windows Subsystem for Linux)
如果您有 WSL,可以在 Ubuntu 子系统中安装:
```bash
# 安装 Redis
sudo apt-add-repository ppa:redislabs/redis
sudo apt-get update
sudo apt-get install redis-server

# 启动服务
sudo service redis-server start
```

## 验证安装

### PostgreSQL 验证
```bash
# 打开 psql 命令行
psql -U postgres -h localhost

# 在 psql 中执行
SELECT version();
CREATE EXTENSION IF NOT EXISTS vector;
```

### Redis 验证
```bash
# 打开 Redis CLI
redis-cli

# 测试连接
127.0.0.1:6379> SET test "Hello World"
127.0.0.1:6379> GET test
```

## 配置环境变量

安装完成后,请创建 `.env` 文件:
```env
# 数据库配置
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/story_ai
REDIS_URL=redis://localhost:6379

# 或使用新的配置格式
DATABASE__HOST=localhost
DATABASE__PORT=5432
DATABASE__NAME=story_ai
DATABASE__USERNAME=postgres
DATABASE__PASSWORD=postgres123

REDIS__HOST=localhost
REDIS__PORT=6379
REDIS__ENABLED=true
```

## 创建数据库

连接到 PostgreSQL 并创建项目数据库:
```sql
CREATE DATABASE story_ai;
\c story_ai;
CREATE EXTENSION IF NOT EXISTS vector;
```
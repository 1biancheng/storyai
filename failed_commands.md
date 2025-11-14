# 失败命令文档

## 失败的psql命令

### 错误信息
```
psql : 无法将"psql"项识别为 cmdlet、函数、脚本文件或可运行程序的名称.
```

### 原因分析
系统中没有安装psql命令行工具,但数据库服务正常运行.

## 编码问题命令

### 错误信息
```
Error: 'utf-8' codec can't decode byte 0xd6 in position 61: invalid continuation byte
```

### 原因分析
文件编码问题导致Python脚本无法正确读取文件内容.

## 数据库连接问题

### 错误信息
```
⚠️  无法连接数据库: 'utf-8' codec can't decode byte 0xd6 in position 61: invalid continuation byte
```

### 原因分析
环境变量文件编码问题导致数据库连接信息读取失败.

## API 404错误

### 错误信息
```
INFO:     127.0.0.1:57677 - "POST /api/v1/chapters/project/c2145a29-ab82-4f01-a923-d4bb02c5b513/validate HTTP/1.1" 404 Not Found
```

### 原因分析
API端点未正确注册或路由配置问题.

## 数据库字段不存在错误

### 错误信息
```
字段 "display_order" 不存在
```

### 原因分析
数据库迁移未执行,缺少display_order字段.
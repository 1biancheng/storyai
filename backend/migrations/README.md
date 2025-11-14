# 数据库迁移说明

## 概述

本目录包含book-division-optimization项目的数据库迁移脚本,用于扩展`paragraphs`和`formulas`表以支持轻量级神经替代网络功能。

## 迁移文件

1. **002_extend_paragraphs_table.sql**
   - 添加神经网络参数字段(sequence_weight, paragraph_bias, enhanced_embedding)
   - 添加序列索引字段(prev/next_paragraph_id, global_position)
   - 添加稀疏激活字段(keywords, idioms)

2. **003_extend_formulas_table.sql**
   - 添加公式类型字段(formula_type)
   - 添加公式关联字段(book_id, parent_formula_id)
   - 添加元信息字段(metadata, validation_status, usage_count)

## 执行方式

### 方式1: 使用psql命令行工具

```bash
# 连接到数据库
psql -U postgres -d story_ai

# 执行迁移1
\i 002_extend_paragraphs_table.sql

# 执行迁移2
\i 003_extend_formulas_table.sql
```

### 方式2: 使用Python脚本(需要配置数据库连接)

```bash
# 设置数据库连接环境变量
export DATABASE_URL="postgresql://用户名:密码@localhost:5432/story_ai"

# 运行迁移脚本
python run_migrations.py
```

### 方式3: 使用pgAdmin或其他数据库管理工具

1. 打开pgAdmin并连接到story_ai数据库
2. 打开Query Tool
3. 复制002_extend_paragraphs_table.sql的内容并执行
4. 复制003_extend_formulas_table.sql的内容并执行

## 验证迁移

执行以下SQL验证迁移是否成功:

```sql
-- 检查paragraphs表新增字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'paragraphs' 
AND column_name IN ('sequence_weight', 'paragraph_bias', 'enhanced_embedding', 'keywords', 'idioms');

-- 检查formulas表新增字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'formulas' 
AND column_name IN ('formula_type', 'book_id', 'parent_formula_id', 'metadata');

-- 检查索引
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('paragraphs', 'formulas')
AND indexname LIKE 'idx%';
```

## 回滚

如果需要回滚迁移,可以执行以下SQL:

```sql
-- 回滚paragraphs表
ALTER TABLE paragraphs 
DROP COLUMN IF EXISTS sequence_weight,
DROP COLUMN IF EXISTS paragraph_bias,
DROP COLUMN IF EXISTS enhanced_embedding,
DROP COLUMN IF EXISTS prev_paragraph_id,
DROP COLUMN IF EXISTS next_paragraph_id,
DROP COLUMN IF EXISTS global_position,
DROP COLUMN IF EXISTS keywords,
DROP COLUMN IF EXISTS idioms;

-- 回滚formulas表
ALTER TABLE formulas
DROP COLUMN IF EXISTS formula_type,
DROP COLUMN IF EXISTS book_id,
DROP COLUMN IF EXISTS parent_formula_id,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS validation_status,
DROP COLUMN IF EXISTS usage_count;
```

## 注意事项

1. 迁移脚本使用`IF NOT EXISTS`子句,可以安全地重复执行
2. 建议在执行迁移前备份数据库
3. 迁移会创建多个索引,首次执行可能需要几秒钟时间
4. 如果数据库中已有大量数据,建议在非高峰期执行迁移
# 数据库迁移说明

## 概述

本目录包含book-division-optimization项目的数据库迁移脚本,用于扩展`paragraphs`和`formulas`表以支持轻量级神经替代网络功能。

## 迁移文件

1. **002_extend_paragraphs_table.sql**
   - 添加神经网络参数字段(sequence_weight, paragraph_bias, enhanced_embedding)
   - 添加序列索引字段(prev/next_paragraph_id, global_position)
   - 添加稀疏激活字段(keywords, idioms)

2. **003_extend_formulas_table.sql**
   - 添加公式类型字段(formula_type)
   - 添加公式关联字段(book_id, parent_formula_id)
   - 添加元信息字段(metadata, validation_status, usage_count)

## 执行方式

### 方式1: 使用psql命令行工具

```bash
# 连接到数据库
psql -U postgres -d story_ai

# 执行迁移1
\i 002_extend_paragraphs_table.sql

# 执行迁移2
\i 003_extend_formulas_table.sql
```

### 方式2: 使用Python脚本(需要配置数据库连接)

```bash
# 设置数据库连接环境变量
export DATABASE_URL="postgresql://用户名:密码@localhost:5432/story_ai"

# 运行迁移脚本
python run_migrations.py
```

### 方式3: 使用pgAdmin或其他数据库管理工具

1. 打开pgAdmin并连接到story_ai数据库
2. 打开Query Tool
3. 复制002_extend_paragraphs_table.sql的内容并执行
4. 复制003_extend_formulas_table.sql的内容并执行

## 验证迁移

执行以下SQL验证迁移是否成功:

```sql
-- 检查paragraphs表新增字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'paragraphs' 
AND column_name IN ('sequence_weight', 'paragraph_bias', 'enhanced_embedding', 'keywords', 'idioms');

-- 检查formulas表新增字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'formulas' 
AND column_name IN ('formula_type', 'book_id', 'parent_formula_id', 'metadata');

-- 检查索引
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('paragraphs', 'formulas')
AND indexname LIKE 'idx%';
```

## 回滚

如果需要回滚迁移,可以执行以下SQL:

```sql
-- 回滚paragraphs表
ALTER TABLE paragraphs 
DROP COLUMN IF EXISTS sequence_weight,
DROP COLUMN IF EXISTS paragraph_bias,
DROP COLUMN IF EXISTS enhanced_embedding,
DROP COLUMN IF EXISTS prev_paragraph_id,
DROP COLUMN IF EXISTS next_paragraph_id,
DROP COLUMN IF EXISTS global_position,
DROP COLUMN IF EXISTS keywords,
DROP COLUMN IF EXISTS idioms;

-- 回滚formulas表
ALTER TABLE formulas
DROP COLUMN IF EXISTS formula_type,
DROP COLUMN IF EXISTS book_id,
DROP COLUMN IF EXISTS parent_formula_id,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS validation_status,
DROP COLUMN IF EXISTS usage_count;
```

## 注意事项

1. 迁移脚本使用`IF NOT EXISTS`子句,可以安全地重复执行
2. 建议在执行迁移前备份数据库
3. 迁移会创建多个索引,首次执行可能需要几秒钟时间
4. 如果数据库中已有大量数据,建议在非高峰期执行迁移

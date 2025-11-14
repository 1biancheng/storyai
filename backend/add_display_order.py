import asyncio
import asyncpg

async def add_display_order_column():
    try:
        # 数据库连接信息
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='1234',
            database='story_ai'
        )
        
        # 添加display_order列
        await conn.execute("""
            ALTER TABLE chapters ADD COLUMN IF NOT EXISTS display_order INTEGER;
        """)
        print("✅ 成功添加display_order列")
        
        # 设置默认值
        await conn.execute("""
            UPDATE chapters SET display_order = chapter_number WHERE display_order IS NULL;
        """)
        print("✅ 成功设置display_order默认值")
        
        # 创建索引
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chapters_display_order ON chapters(project_id, display_order);
        """)
        print("✅ 成功创建索引")
        
        # 检查列是否存在
        result = await conn.fetch("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        """, 'chapters', 'display_order')
        
        if result:
            print("✅ display_order列已存在")
        else:
            print("❌ display_order列不存在")
            
        await conn.close()
        
    except Exception as e:
        print(f"❌ 错误: {e}")

if __name__ == "__main__":
    asyncio.run(add_display_order_column())
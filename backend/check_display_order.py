import os
import psycopg2

def check_display_order_column():
    try:
        # 从环境变量或默认配置获取数据库连接
        db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/story_ai')
        
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # 检查display_order列是否存在
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        """, ('chapters', 'display_order'))
        result = cursor.fetchall()
        print('display_order column exists:', len(result) > 0)
        
        # 检查chapters表的结构
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, ('chapters',))
        columns = cursor.fetchall()
        print('Chapters table columns:')
        for column_name, data_type in columns:
            print('  {}: {}'.format(column_name, data_type))
            
        cursor.close()
        conn.close()
    except Exception as e:
        print('Error: {}'.format(e))

if __name__ == '__main__':
    check_display_order_column()
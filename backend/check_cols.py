import asyncio, asyncpg
async def check():
    c = await asyncpg.connect('postgresql://storyai:storyai@localhost/storyai_db')
    rows = await c.fetch("""SELECT column_name FROM information_schema.columns WHERE table_name='chapters'""")
    cols = [r['column_name'] for r in rows]
    print('chapters 字段:', cols)
    await c.close()
asyncio.run(check())
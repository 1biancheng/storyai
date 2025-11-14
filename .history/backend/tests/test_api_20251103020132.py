"""示例API调用脚本(开发者自测用)
运行前:确保 backend/main.py 以 uvicorn 启动在 localhost:8000
"""

import json
import requests
from urllib.parse import urlencode

BASE = "http://127.0.0.1:8000"


def test_ingest():
    text = """
第一章

主角踏入古堡的大门,空气里弥漫着尘埃的味道.
他感觉到一阵不安.

大厅的尽头,一道黑影闪过.
"""
    resp = requests.post(f"{BASE}/api/story/ingest", json={
        "text": text,
        "bookId": "demo-book",
        "chapterIndex": 1
    })
    print("ingest:", resp.status_code, resp.text)


def test_create_formula():
    formula = {
        "query": "主角与黑影的首次遭遇",
        "top_k": 5,
        "threshold": 0.6,
        "order": "similarity_desc"
    }
    resp = requests.post(f"{BASE}/api/story/formulas", json={
        "name": "首次遭遇",
        "expression": json.dumps(formula),
        "category": "demo"
    })
    print("create_formula:", resp.status_code, resp.text)


def test_generate_stream():
    """测试 SSE 智能拼接流: 验证事件序列(step/append/complete)与 similarity 字段"""
    # 先准备一个简单公式,限定在 demo-book,降低阈值以确保有返回
    formula = {
        "query": "主角",
        "top_k": 5,
        "threshold": 0.0,
        "order": "similarity_desc",
        "book_id": "demo-book"
    }
    params = {"formula": json.dumps(formula, ensure_ascii=False)}

    url = f"{BASE}/api/story/generate/stream"
    print("GET", url, "params=", params)

    # 使用 requests 流式读取 SSE
    with requests.get(url, params=params, stream=True, headers={"Accept": "text/event-stream"}, timeout=(5, 60)) as resp:
        print("status:", resp.status_code)
        assert resp.status_code == 200

        last_event = None
        append_count = 0
        similarities = []
        # SSE 格式: 多行组成一个事件块
        # 解析规则: 收集 event: 和 data: 行, 遇到空行表示事件结束
        event_name = None
        event_data_lines = []

        for raw in resp.iter_lines(decode_unicode=True):
            if raw is None:
                continue
            line = raw.strip()
            if not line:
                # 事件块结束
                if event_name:
                    data_str = "\n".join(event_data_lines)
                    print("evt:", event_name, "data:", data_str)
                    try:
                        # 使用安全的JSON解析
                        from services.json_repairer import safe_json_loads
                        payload = safe_json_loads(data_str, data_str)
                    except Exception:
                        payload = data_str

                    last_event = event_name
                    if event_name == "append" and isinstance(payload, dict):
                        append_count += 1
                        if "similarity" in payload:
                            similarities.append(payload["similarity"])
                    if event_name == "complete":
                        break
                # 重置收集器
                event_name = None
                event_data_lines = []
                continue

            if line.startswith("event: "):
                event_name = line.split(": ", 1)[1]
            elif line.startswith("data: "):
                event_data_lines.append(line.split(": ", 1)[1])

        print("summary: last_event=", last_event, "append_count=", append_count, "similarities=", similarities)
        assert append_count >= 1, "应至少有一个 append 事件"
        assert last_event == "complete", "最后一个事件应为 complete"
        assert all(isinstance(s, (int, float)) for s in similarities), "similarity 字段应为数值"


if __name__ == "__main__":
    test_ingest()
    test_create_formula()
    test_generate_stream()


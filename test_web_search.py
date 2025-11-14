"""测试网络搜索功能"""
import requests
import json

# 测试搜索配置
print("测试搜索配置...")
config_response = requests.get("http://localhost:8000/api/tools/search_config")
print(f"配置响应: {config_response.status_code}")
print(json.dumps(config_response.json(), indent=2, ensure_ascii=False))
print("\n" + "="*60 + "\n")

# 测试网络搜索 - 搜索最新新闻
print("测试网络搜索 - 2025年11月最新新闻...")
search_data = {
    "query": "2025年11月最新新闻",
    "num_results": 5,
    "safe_search": "moderate"
}

search_response = requests.post(
    "http://localhost:8000/api/tools/web_search",
    json=search_data,
    headers={"Content-Type": "application/json"}
)

print(f"搜索响应状态码: {search_response.status_code}")
print(f"搜索结果:")
result = search_response.json()
print(json.dumps(result, indent=2, ensure_ascii=False))
print("\n" + "="*60 + "\n")

# 如果有结果,显示详细信息
if result.get("data") and result["data"].get("results"):
    print(f"找到 {len(result['data']['results'])} 个搜索结果:")
    for idx, item in enumerate(result['data']['results'], 1):
        print(f"\n{idx}. {item.get('title', 'N/A')}")
        print(f"   URL: {item.get('url', 'N/A')}")
        print(f"   摘要: {item.get('snippet', 'N/A')[:100]}...")
        print(f"   域名: {item.get('domain', 'N/A')}")
        if item.get('relevance_score'):
            print(f"   相关度: {item['relevance_score']}%")

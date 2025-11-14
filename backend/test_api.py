#!/usr/bin/env python3
"""
StoryAI Backend API 测试脚本
测试所有API端点的功能和错误处理机制
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_URL = "http://127.0.0.1:8000"

class APITester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_endpoint(self, method: str, endpoint: str, data: Dict = None, 
                          expected_status: int = 200, test_name: str = None) -> Dict:
        """测试单个API端点"""
        test_name = test_name or f"{method} {endpoint}"
        url = f"{self.base_url}{endpoint}"
        
        try:
            start_time = time.time()
            
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    response_data = await response.text()
                    status = response.status
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    response_data = await response.text()
                    status = response.status
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data) as response:
                    response_data = await response.text()
                    status = response.status
            elif method.upper() == "DELETE":
                async with self.session.delete(url) as response:
                    response_data = await response.text()
                    status = response.status
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response_time = time.time() - start_time
            
            # 尝试解析JSON响应
            try:
                from services.json_repairer import safe_json_loads
                json_data = safe_json_loads(response_data, {"raw_response": response_data})
            except Exception:
                json_data = {"raw_response": response_data}
            
            result = {
                "test_name": test_name,
                "method": method.upper(),
                "endpoint": endpoint,
                "status_code": status,
                "expected_status": expected_status,
                "response_time": round(response_time, 3),
                "success": status == expected_status,
                "response_data": json_data
            }
            
            self.test_results.append(result)
            
            if result["success"]:
                logger.info(f"✅ {test_name} - Status: {status}, Time: {response_time:.3f}s")
            else:
                logger.error(f"❌ {test_name} - Expected: {expected_status}, Got: {status}")
                
            return result
            
        except Exception as e:
            result = {
                "test_name": test_name,
                "method": method.upper(),
                "endpoint": endpoint,
                "status_code": None,
                "expected_status": expected_status,
                "response_time": None,
                "success": False,
                "error": str(e)
            }
            
            self.test_results.append(result)
            logger.error(f"❌ {test_name} - Error: {e}")
            return result
    
    async def test_health_check(self):
        """测试健康检查端点"""
        logger.info("🔍 Testing Health Check...")
        await self.test_endpoint("GET", "/", test_name="Health Check")
        await self.test_endpoint("GET", "/api/ai/health", test_name="AI Health Check")
    
    async def test_ai_endpoints(self):
        """测试AI服务端点"""
        logger.info("🤖 Testing AI Endpoints...")
        
        # 测试获取可用模型
        await self.test_endpoint("GET", "/api/ai/models", test_name="Get Available Models")
        
        # 测试模型配置
        await self.test_endpoint("GET", "/api/ai/models/gpt-3.5-turbo/config", 
                                test_name="Get Model Config")
        
        # 测试缓存统计
        await self.test_endpoint("GET", "/api/ai/cache/stats", test_name="Cache Statistics")
        
        # 测试AI代理运行(需要有效的API密钥)
        agent_data = {
            "prompt": "Hello, this is a test message.",
            "model_id": "gpt-3.5-turbo",
            "parameters": {"max_tokens": 50}
        }
        await self.test_endpoint("POST", "/api/ai/run-agent", data=agent_data, 
                                expected_status=200, test_name="Run AI Agent")
        
        # 测试模型连接测试
        test_data = {"model_id": "gpt-3.5-turbo"}
        await self.test_endpoint("POST", "/api/ai/test-model", data=test_data,
                                test_name="Test Model Connection")
    
    async def test_database_endpoints(self):
        """测试数据库端点"""
        logger.info("🗄️ Testing Database Endpoints...")
        
        # 测试数据库统计
        await self.test_endpoint("GET", "/api/db/stats", test_name="Database Statistics")
        
        # 测试创建文档
        doc_data = {
            "title": "Test Document",
            "content": "This is a test document for API testing.",
            "content_type": "text",
            "source": "api_test",
            "doc_metadata": {"test": True, "created_by": "api_tester"}
        }
        create_result = await self.test_endpoint("POST", "/api/db/documents", 
                                                data=doc_data, expected_status=201,
                                                test_name="Create Document")
        
        # 如果文档创建成功,获取文档ID进行后续测试
        doc_id = None
        if create_result["success"] and "response_data" in create_result:
            doc_id = create_result["response_data"].get("id")
        
        if doc_id:
            # 测试获取文档
            await self.test_endpoint("GET", f"/api/db/documents/{doc_id}",
                                    test_name="Get Document")
            
            # 测试更新文档嵌入
            embedding_data = {
                "embedding": [0.1] * 1536  # 模拟1536维向量
            }
            await self.test_endpoint("PUT", f"/api/db/documents/{doc_id}/embedding",
                                    data=embedding_data, test_name="Update Document Embedding")
        
        # 测试向量搜索(需要有嵌入向量)
        search_data = {
            "query_embedding": [0.1] * 1536,
            "limit": 5,
            "threshold": 0.5
        }
        await self.test_endpoint("POST", "/api/db/search/vector", data=search_data,
                                test_name="Vector Search")
        
        # 测试混合搜索
        hybrid_data = {
            "query_text": "test document",
            "query_embedding": [0.1] * 1536,
            "limit": 5
        }
        await self.test_endpoint("POST", "/api/db/search/hybrid", data=hybrid_data,
                                test_name="Hybrid Search")
        
        # 清理:删除测试文档
        if doc_id:
            await self.test_endpoint("DELETE", f"/api/db/documents/{doc_id}",
                                    expected_status=204, test_name="Delete Document")
    
    async def test_cache_endpoints(self):
        """测试缓存端点"""
        logger.info("💾 Testing Cache Endpoints...")
        
        # 测试清除缓存
        await self.test_endpoint("POST", "/api/ai/cache/clear", test_name="Clear Cache")
        
        # 再次检查缓存统计
        await self.test_endpoint("GET", "/api/ai/cache/stats", test_name="Cache Stats After Clear")
    
    async def test_error_handling(self):
        """测试错误处理"""
        logger.info("⚠️ Testing Error Handling...")
        
        # 测试不存在的端点
        await self.test_endpoint("GET", "/api/nonexistent", expected_status=404,
                                test_name="Non-existent Endpoint")
        
        # 测试无效的模型ID
        await self.test_endpoint("GET", "/api/ai/models/invalid-model/config",
                                expected_status=404, test_name="Invalid Model Config")
        
        # 测试无效的文档ID
        await self.test_endpoint("GET", "/api/db/documents/99999",
                                expected_status=404, test_name="Invalid Document ID")
        
        # 测试无效的请求数据
        invalid_data = {"invalid": "data"}
        await self.test_endpoint("POST", "/api/ai/run-agent", data=invalid_data,
                                expected_status=422, test_name="Invalid Agent Request")
    
    def generate_report(self) -> Dict:
        """生成测试报告"""
        total_tests = len(self.test_results)
        successful_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - successful_tests
        
        success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
        
        report = {
            "summary": {
                "total_tests": total_tests,
                "successful_tests": successful_tests,
                "failed_tests": failed_tests,
                "success_rate": round(success_rate, 2)
            },
            "test_results": self.test_results
        }
        
        return report
    
    def print_summary(self):
        """打印测试摘要"""
        report = self.generate_report()
        summary = report["summary"]
        
        print("\n" + "="*60)
        print("📊 API 测试报告摘要")
        print("="*60)
        print(f"总测试数: {summary['total_tests']}")
        print(f"成功测试: {summary['successful_tests']}")
        print(f"失败测试: {summary['failed_tests']}")
        print(f"成功率: {summary['success_rate']}%")
        
        if summary['failed_tests'] > 0:
            print("\n❌ 失败的测试:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test_name']}: {result.get('error', 'Status mismatch')}")
        
        print("="*60)

async def main():
    """主测试函数"""
    print("🚀 开始 StoryAI Backend API 测试...")
    
    async with APITester() as tester:
        # 运行所有测试
        await tester.test_health_check()
        await tester.test_ai_endpoints()
        await tester.test_database_endpoints()
        await tester.test_cache_endpoints()
        await tester.test_error_handling()
        
        # 生成并保存报告
        report = tester.generate_report()
        
        # 保存详细报告到文件
        with open("api_test_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # 打印摘要
        tester.print_summary()
        
        print(f"\n📄 详细报告已保存到: api_test_report.json")

if __name__ == "__main__":
    asyncio.run(main())
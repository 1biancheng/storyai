"""
测试删除API的幂等性修复
验证设计文档中的所有场景
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_scenario_1():
    """场景1: 删除不存在的文件/目录 - 应返回200成功"""
    print("\n" + "="*60)
    print("场景1: 删除不存在的文件/目录")
    print("="*60)
    
    # 测试删除不存在的项目目录
    response = requests.delete(
        f"{BASE_URL}/api/workspace/delete",
        params={"path": "chapters/non-existent-project-id"}
    )
    
    print(f"状态码: {response.status_code}")
    print(f"响应体: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    assert response.status_code == 200, "应返回200"
    data = response.json()
    assert data["code"] == 200, "响应码应为200"
    assert data["data"]["deleted"] == False, "deleted应为False"
    assert data["data"]["existed"] == False, "existed应为False"
    assert data["data"]["recycleId"] is None, "recycleId应为None"
    
    print("✅ 场景1测试通过!")


def test_scenario_2():
    """场景2: 重复删除同一个不存在的路径 - 应保持幂等性"""
    print("\n" + "="*60)
    print("场景2: 重复删除测试(幂等性)")
    print("="*60)
    
    path = "chapters/test-idempotent-delete"
    
    # 第一次删除
    response1 = requests.delete(
        f"{BASE_URL}/api/workspace/delete",
        params={"path": path}
    )
    print(f"第一次删除 - 状态码: {response1.status_code}")
    print(f"第一次删除 - 响应: {json.dumps(response1.json(), indent=2, ensure_ascii=False)}")
    
    # 第二次删除(幂等性测试)
    response2 = requests.delete(
        f"{BASE_URL}/api/workspace/delete",
        params={"path": path}
    )
    print(f"第二次删除 - 状态码: {response2.status_code}")
    print(f"第二次删除 - 响应: {json.dumps(response2.json(), indent=2, ensure_ascii=False)}")
    
    # 两次都应该返回200
    assert response1.status_code == 200, "第一次应返回200"
    assert response2.status_code == 200, "第二次应返回200(幂等)"
    
    print("✅ 场景2测试通过!")


def test_scenario_3():
    """场景3: 删除存在的临时文件"""
    print("\n" + "="*60)
    print("场景3: 删除存在的文件")
    print("="*60)
    
    # 先创建一个测试文件
    test_path = "test-delete-file.txt"
    write_response = requests.post(
        f"{BASE_URL}/api/workspace/write",
        json={
            "path": test_path,
            "content": "测试内容"
        }
    )
    print(f"创建文件 - 状态码: {write_response.status_code}")
    
    # 删除该文件
    delete_response = requests.delete(
        f"{BASE_URL}/api/workspace/delete",
        params={"path": test_path}
    )
    print(f"删除文件 - 状态码: {delete_response.status_code}")
    print(f"删除响应: {json.dumps(delete_response.json(), indent=2, ensure_ascii=False)}")
    
    assert delete_response.status_code == 200, "应返回200"
    data = delete_response.json()
    assert data["data"]["deleted"] == True, "deleted应为True"
    assert data["data"]["existed"] == True, "existed应为True"
    
    print("✅ 场景3测试通过!")


def test_scenario_4():
    """场景4: 验证响应体包含所有新字段"""
    print("\n" + "="*60)
    print("场景4: 验证响应体字段")
    print("="*60)
    
    response = requests.delete(
        f"{BASE_URL}/api/workspace/delete",
        params={"path": "chapters/field-test"}
    )
    
    data = response.json()
    print(f"响应体: {json.dumps(data, indent=2, ensure_ascii=False)}")
    
    # 验证所有必需字段存在
    assert "code" in data, "应包含code字段"
    assert "message" in data, "应包含message字段"
    assert "data" in data, "应包含data字段"
    assert "path" in data["data"], "data应包含path字段"
    assert "deleted" in data["data"], "data应包含deleted字段"
    assert "existed" in data["data"], "data应包含existed字段"
    assert "recycleId" in data["data"], "data应包含recycleId字段"
    
    print("✅ 场景4测试通过!")


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("开始测试删除API幂等性修复")
    print("="*60)
    
    try:
        test_scenario_1()
        test_scenario_2()
        test_scenario_3()
        test_scenario_4()
        
        print("\n" + "="*60)
        print("🎉 所有测试通过!")
        print("="*60)
        print("\n✅ 修复验证成功:")
        print("  1. 删除不存在的资源返回200成功")
        print("  2. 重复删除保持幂等性")
        print("  3. 响应体包含deleted和existed字段")
        print("  4. 预留recycleId字段")
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试错误: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

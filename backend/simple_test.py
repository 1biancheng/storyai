import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

# 测试基本导入
try:
    from services.json_repairer import repair_and_load, safe_json_loads
    print("✅ 成功导入JSON修复模块")
except Exception as e:
    print(f"❌ 导入失败: {e}")
    sys.exit(1)

# 测试正常JSON
try:
    result = repair_and_load('{"name": "测试", "value": 123}')
    expected = {"name": "测试", "value": 123}
    if result == expected:
        print("✅ 正常JSON解析测试通过")
    else:
        print(f"❌ 正常JSON解析失败: 期望 {expected}, 实际 {result}")
except Exception as e:
    print(f"❌ 正常JSON解析异常: {e}")

# 测试损坏的JSON
try:
    result = repair_and_load('{"name": "测试", "value": 123,')
    expected = {"name": "测试", "value": 123}
    if result == expected:
        print("✅ 损坏JSON修复测试通过")
    else:
        print(f"❌ 损坏JSON修复失败: 期望 {expected}, 实际 {result}")
except Exception as e:
    print(f"❌ 损坏JSON修复异常: {e}")

# 测试safe_json_loads
try:
    result = safe_json_loads('{"name": "安全测试", "value": 456}')
    expected = {"name": "安全测试", "value": 456}
    if result == expected:
        print("✅ 安全JSON加载测试通过")
    else:
        print(f"❌ 安全JSON加载失败: 期望 {expected}, 实际 {result}")
except Exception as e:
    print(f"❌ 安全JSON加载异常: {e}")

print("🏁 测试完成")
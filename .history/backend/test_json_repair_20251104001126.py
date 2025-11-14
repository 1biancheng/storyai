#!/usr/bin/env python3
"""
JSON修复功能测试脚本
验证我们增强的JSON修复功能是否能正确处理各种损坏的JSON情况
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

from services.json_repairer import repair_and_load, safe_json_loads

def test_json_repair():
    """测试JSON修复功能"""
    print("🧪 开始测试JSON修复功能...")
    
    # 测试用例
    test_cases = [
        # 正常JSON
        ('{"name": "zhangsan", "age": 30}', {"name": "zhangsan", "age": 30}),
        
        # 缺少结束括号
        ('{"name": "李四", "age": 25', {"name": "李四", "age": 25}),
        
        # 缺少开始括号
        ('"name": "王五", "age": 35}', {"name": "王五", "age": 35}),
        
        # 多余逗号
        ('{"name": "赵六", "age": 40,}', {"name": "赵六", "age": 40}),
        
        # 缺少引号
        ('{name: "孙七", age: 45}', {"name": "孙七", "age": 45}),
        
        # 中文内容
        ('{"姓名": "周八", "年龄": 50}', {"姓名": "周八", "年龄": 50}),
        
        # 嵌套对象
        ('{"user": {"name": "吴九", "info": {"age": 55}', {"user": {"name": "吴九", "info": {"age": 55}}}),
        
        # 数组
        ('[1, 2, 3,', [1, 2, 3]),
        
        # 空值
        ('', {}),
        
        # None值
        (None, {}),
        
        # 纯文本
        ('这是一个测试文本', {"value": "这是一个测试文本"}),
        
        # 数字
        ('123', {"value": 123}),
    ]
    
    passed = 0
    failed = 0
    
    for i, (input_json, expected) in enumerate(test_cases, 1):
        try:
            result = repair_and_load(input_json) if input_json is not None else repair_and_load(input_json)
            if result == expected:
                print(f"✅ 测试 {i}: 通过")
                passed += 1
            else:
                print(f"❌ 测试 {i}: 失败")
                print(f"   输入: {repr(input_json)}")
                print(f"   期望: {expected}")
                print(f"   实际: {result}")
                failed += 1
        except Exception as e:
            print(f"❌ 测试 {i}: 异常 - {e}")
            print(f"   输入: {repr(input_json)}")
            failed += 1
    
    print(f"\n📊 测试结果: {passed} 通过, {failed} 失败")
    return failed == 0

def test_safe_json_loads():
    """测试安全的JSON加载函数"""
    print("\n🛡️ 开始测试安全JSON加载函数...")
    
    # 测试用例
    test_cases = [
        # 正常JSON
        ('{"name": "测试1", "value": 100}', {"name": "测试1", "value": 100}),
        
        # 损坏的JSON
        ('{"name": "测试2", "value": 100,', {"name": "测试2", "value": 100}),
        
        # 默认值测试
        ('invalid json', {}, "默认值测试"),
    ]
    
    passed = 0
    failed = 0
    
    for i, (input_json, expected, *description) in enumerate(test_cases, 1):
        desc = description[0] if description else f"测试 {i}"
        try:
            result = safe_json_loads(input_json, {})
            if result == expected:
                print(f"✅ {desc}: 通过")
                passed += 1
            else:
                print(f"❌ {desc}: 失败")
                print(f"   输入: {repr(input_json)}")
                print(f"   期望: {expected}")
                print(f"   实际: {result}")
                failed += 1
        except Exception as e:
            print(f"❌ {desc}: 异常 - {e}")
            print(f"   输入: {repr(input_json)}")
            failed += 1
    
    print(f"\n📊 安全加载测试结果: {passed} 通过, {failed} 失败")
    return failed == 0

if __name__ == "__main__":
    print("🚀 JSON修复功能验证测试")
    print("=" * 50)
    
    success1 = test_json_repair()
    success2 = test_safe_json_loads()
    
    if success1 and success2:
        print("\n🎉 所有测试通过！JSON修复功能工作正常。")
        sys.exit(0)
    else:
        print("\n💥 部分测试失败，请检查修复功能。")
        sys.exit(1)
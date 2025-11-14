"""
快速测试: 验证核心模块可导入和基本功能
"""

import sys
from pathlib import Path

# 添加backend目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def test_imports():
    """测试所有核心模块可正常导入"""
    print("\n=== 测试模块导入 ===")
    
    try:
        from services.paragraph_enhancer import (
            extract_keywords,
            extract_idioms,
            initialize_sequence_weight,
            initialize_paragraph_bias
        )
        print("✓ paragraph_enhancer 导入成功")
    except Exception as e:
        print(f"✗ paragraph_enhancer 导入失败: {e}")
        return False
    
    try:
        from services.formula_generator import FormulaGenerator
        print("✓ formula_generator 导入成功")
    except Exception as e:
        print(f"✗ formula_generator 导入失败: {e}")
        return False
    
    try:
        from services.formula_restoration import FormulaRestorationEngine
        print("✓ formula_restoration 导入成功")
    except Exception as e:
        print(f"✗ formula_restoration 导入失败: {e}")
        return False
    
    try:
        from services.keyword_rag import KeywordRAG
        print("✓ keyword_rag 导入成功")
    except Exception as e:
        print(f"✗ keyword_rag 导入失败: {e}")
        return False
    
    try:
        from services.rl_optimizer import ReinforcementLearningOptimizer
        print("✓ rl_optimizer 导入成功")
    except Exception as e:
        print(f"✗ rl_optimizer 导入失败: {e}")
        return False
    
    return True


def test_basic_functions():
    """测试基本功能"""
    print("\n=== 测试基本功能 ===")
    
    from services.paragraph_enhancer import extract_keywords, extract_idioms
    
    # 测试文本
    text = "他独自站在山巅,望着云海翻涌,心中感慨万千.破釜沉舟,背水一战!"
    
    # 关键词提取
    keywords = extract_keywords(text, topK=5)
    print(f"✓ 关键词提取: {keywords}")
    
    # 成语提取
    idioms = extract_idioms(text)
    print(f"✓ 成语提取: {idioms}")
    
    return True


def test_formula_generator():
    """测试公式生成器"""
    print("\n=== 测试公式生成器 ===")
    
    from services.formula_generator import FormulaGenerator
    import numpy as np
    
    paragraphs = [
        {
            "id": "para_001",
            "content": "测试段落",
            "embedding": np.random.randn(1536).tolist(),
            "sequence_weight": 1.0,
            "paragraph_bias": np.random.randn(1536).tolist(),
            "meta": {
                "keywords": ["测试"],
                "chapter_index": 0,
                "paragraph_index": 0,
                "global_position": 0.0
            }
        }
    ]
    
    generator = FormulaGenerator()
    formula = generator.generate_master_formula(
        paragraphs=paragraphs,
        book_id="test_book",
        book_title="测试书籍"
    )
    
    print(f"✓ 生成总公式ID: {formula['formula_id']}")
    print(f"✓ 段落数量: {formula['paragraph_sequence']['total_paragraphs']}")
    
    return True


if __name__ == "__main__":
    print("="*60)
    print("快速功能测试")
    print("="*60)
    
    tests = [
        ("模块导入", test_imports),
        ("基本功能", test_basic_functions),
        ("公式生成器", test_formula_generator)
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✅ {name} 测试通过\n")
            else:
                failed += 1
                print(f"\n❌ {name} 测试失败\n")
        except Exception as e:
            failed += 1
            print(f"\n❌ {name} 测试失败: {e}\n")
            import traceback
            traceback.print_exc()
    
    print("="*60)
    print(f"总计: {passed + failed} 个测试, {passed} 个通过, {failed} 个失败")
    print("="*60)
    
    sys.exit(0 if failed == 0 else 1)
"""
快速测试: 验证核心模块可导入和基本功能
"""

import sys
from pathlib import Path

# 添加backend目录到Python路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def test_imports():
    """测试所有核心模块可正常导入"""
    print("\n=== 测试模块导入 ===")
    
    try:
        from services.paragraph_enhancer import (
            extract_keywords,
            extract_idioms,
            initialize_sequence_weight,
            initialize_paragraph_bias
        )
        print("✓ paragraph_enhancer 导入成功")
    except Exception as e:
        print(f"✗ paragraph_enhancer 导入失败: {e}")
        return False
    
    try:
        from services.formula_generator import FormulaGenerator
        print("✓ formula_generator 导入成功")
    except Exception as e:
        print(f"✗ formula_generator 导入失败: {e}")
        return False
    
    try:
        from services.formula_restoration import FormulaRestorationEngine
        print("✓ formula_restoration 导入成功")
    except Exception as e:
        print(f"✗ formula_restoration 导入失败: {e}")
        return False
    
    try:
        from services.keyword_rag import KeywordRAG
        print("✓ keyword_rag 导入成功")
    except Exception as e:
        print(f"✗ keyword_rag 导入失败: {e}")
        return False
    
    try:
        from services.rl_optimizer import ReinforcementLearningOptimizer
        print("✓ rl_optimizer 导入成功")
    except Exception as e:
        print(f"✗ rl_optimizer 导入失败: {e}")
        return False
    
    return True


def test_basic_functions():
    """测试基本功能"""
    print("\n=== 测试基本功能 ===")
    
    from services.paragraph_enhancer import extract_keywords, extract_idioms
    
    # 测试文本
    text = "他独自站在山巅,望着云海翻涌,心中感慨万千.破釜沉舟,背水一战!"
    
    # 关键词提取
    keywords = extract_keywords(text, topK=5)
    print(f"✓ 关键词提取: {keywords}")
    
    # 成语提取
    idioms = extract_idioms(text)
    print(f"✓ 成语提取: {idioms}")
    
    return True


def test_formula_generator():
    """测试公式生成器"""
    print("\n=== 测试公式生成器 ===")
    
    from services.formula_generator import FormulaGenerator
    import numpy as np
    
    paragraphs = [
        {
            "id": "para_001",
            "content": "测试段落",
            "embedding": np.random.randn(1536).tolist(),
            "sequence_weight": 1.0,
            "paragraph_bias": np.random.randn(1536).tolist(),
            "meta": {
                "keywords": ["测试"],
                "chapter_index": 0,
                "paragraph_index": 0,
                "global_position": 0.0
            }
        }
    ]
    
    generator = FormulaGenerator()
    formula = generator.generate_master_formula(
        paragraphs=paragraphs,
        book_id="test_book",
        book_title="测试书籍"
    )
    
    print(f"✓ 生成总公式ID: {formula['formula_id']}")
    print(f"✓ 段落数量: {formula['paragraph_sequence']['total_paragraphs']}")
    
    return True


if __name__ == "__main__":
    print("="*60)
    print("快速功能测试")
    print("="*60)
    
    tests = [
        ("模块导入", test_imports),
        ("基本功能", test_basic_functions),
        ("公式生成器", test_formula_generator)
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✅ {name} 测试通过\n")
            else:
                failed += 1
                print(f"\n❌ {name} 测试失败\n")
        except Exception as e:
            failed += 1
            print(f"\n❌ {name} 测试失败: {e}\n")
            import traceback
            traceback.print_exc()
    
    print("="*60)
    print(f"总计: {passed + failed} 个测试, {passed} 个通过, {failed} 个失败")
    print("="*60)
    
    sys.exit(0 if failed == 0 else 1)

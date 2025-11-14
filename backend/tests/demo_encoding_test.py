"""
Encoding Detection Demo - Interactive Test
Demonstrates charset-normalizer in action

Run this script to see live encoding detection results
"""

import os
import sys
import tempfile
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

os.environ.setdefault('SECRET_KEY', 'demo-secret-key')
os.environ.setdefault('APP_NAME', 'StoryAI')

from services.file_parser_service import parse_file


def print_separator(char="=", length=70):
    print(char * length)


def print_header(text):
    print_separator()
    print(f"  {text}")
    print_separator()


def demo_encoding_test():
    """Interactive demo of encoding detection"""
    
    print_header("Encoding Detection Demo - charset-normalizer")
    
    test_cases = [
        {
            "name": "UTF-8 (Simple Chinese)",
            "encoding": "utf-8",
            "content": "这是一段简单的中文文本。\n包含常见汉字和标点符号！",
            "color": "green"
        },
        {
            "name": "GBK (Legacy Chinese)",
            "encoding": "gbk",
            "content": "这是GBK编码的中文内容。\n在Windows简体中文系统中很常见。\n包含：引号、顿号、省略号……",
            "color": "blue"
        },
        {
            "name": "Big5 (Traditional Chinese)",
            "encoding": "big5",
            "content": "這是繁體中文內容。\n使用Big5編碼。\n包含：臺灣、繁體字。",
            "color": "yellow"
        },
        {
            "name": "Windows-1252 (Western European)",
            "encoding": "windows-1252",
            "content": "Price: €100\nCopyright © 2024\nCafé • Résumé • Naïve",
            "color": "cyan"
        },
        {
            "name": "UTF-8 with BOM",
            "encoding": "utf-8-sig",
            "content": "\ufeff这是带BOM的UTF-8文件。\nBOM (Byte Order Mark) 是一个特殊标记。",
            "color": "magenta"
        }
    ]
    
    results = []
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n[Test {i}/{len(test_cases)}] {test['name']}")
        print("-" * 70)
        
        # Create temporary file
        fd, temp_path = tempfile.mkstemp(suffix=".txt")
        os.close(fd)
        
        try:
            # Write content with specific encoding
            with open(temp_path, "w", encoding=test["encoding"]) as f:
                f.write(test["content"])
            
            # Read file size
            file_size = os.path.getsize(temp_path)
            
            # Parse file
            parsed = parse_file(temp_path)
            
            # Extract metadata
            detected_enc = parsed["meta"].get("encoding", "unknown")
            confidence = parsed["meta"].get("confidence", 0.0)
            text = parsed["text"]
            
            # Check for issues
            has_mojibake = "\uFFFD" in text
            text_preview = text[:100].replace("\n", "\\n")
            
            # Store result
            result = {
                "name": test["name"],
                "original_enc": test["encoding"],
                "detected_enc": detected_enc,
                "confidence": confidence,
                "file_size": file_size,
                "has_mojibake": has_mojibake,
                "success": not has_mojibake and len(text) > 0
            }
            results.append(result)
            
            # Print results
            print(f"  Original Encoding:  {test['encoding']}")
            print(f"  Detected Encoding:  {detected_enc}")
            print(f"  Confidence Score:   {confidence:.2f}" if confidence else "  Confidence Score:   N/A")
            print(f"  File Size:          {file_size} bytes")
            print(f"  Text Length:        {len(text)} characters")
            print(f"  Has Mojibake (�):   {'❌ YES' if has_mojibake else '✅ NO'}")
            print(f"  Preview:            {text_preview}...")
            print(f"  Status:             {'✅ PASS' if result['success'] else '❌ FAIL'}")
            
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
            result = {
                "name": test["name"],
                "error": str(e),
                "success": False
            }
            results.append(result)
        
        finally:
            # Cleanup
            try:
                os.remove(temp_path)
            except:
                pass
    
    # Summary
    print("\n")
    print_header("Test Summary")
    
    total = len(results)
    passed = sum(1 for r in results if r.get("success", False))
    failed = total - passed
    
    print(f"\n  Total Tests:    {total}")
    print(f"  Passed:         {passed} ✅")
    print(f"  Failed:         {failed} ❌")
    print(f"  Success Rate:   {(passed/total)*100:.1f}%")
    
    # Detailed results table
    print("\n  Detailed Results:")
    print("  " + "-" * 66)
    print(f"  {'Encoding'.ljust(25)} {'Detected'.ljust(20)} {'Confidence'.ljust(12)} {'Status'}")
    print("  " + "-" * 66)
    
    for r in results:
        if "error" not in r:
            name = r["name"][:24]
            detected = r["detected_enc"][:19]
            conf = f"{r['confidence']:.2f}" if r.get("confidence") else "N/A"
            status = "✅ PASS" if r["success"] else "❌ FAIL"
            print(f"  {name.ljust(25)} {detected.ljust(20)} {conf.ljust(12)} {status}")
        else:
            print(f"  {r['name'].ljust(25)} {'ERROR'.ljust(20)} {'N/A'.ljust(12)} ❌ FAIL")
    
    print("  " + "-" * 66)
    
    # Performance insights
    print("\n  Key Insights:")
    print("  • charset-normalizer provides pure Python implementation")
    print("  • No compilation required (unlike cchardet)")
    print("  • Better compatibility with Python 3.11+")
    print("  • Reliable detection for CJK (Chinese, Japanese, Korean) texts")
    print("  • Handles edge cases like BOM markers")
    
    print("\n")
    print_separator()
    
    return passed == total


if __name__ == "__main__":
    print("\n🔍 Starting Encoding Detection Demo...\n")
    
    try:
        success = demo_encoding_test()
        
        if success:
            print("\n✅ Demo completed successfully! All tests passed.\n")
            sys.exit(0)
        else:
            print("\n⚠️  Some tests failed. Please review the results above.\n")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user.\n")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Demo failed with error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)

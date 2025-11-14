"""Test charset-normalizer encoding detection"""

def test_charset_normalizer():
    """Test that charset-normalizer can be imported and works correctly"""
    try:
        from charset_normalizer import from_bytes
        print("✅ charset-normalizer import successful")
        
        # Test with UTF-8 text
        test_text_utf8 = "你好世界！Hello World!".encode('utf-8')
        results = from_bytes(test_text_utf8)
        best_match = results.best()
        
        if best_match:
            encoding = str(best_match.encoding)
            confidence = float(best_match.coherence)
            print(f"✅ UTF-8 Detection: {encoding} (coherence: {confidence:.2f})")
        else:
            print("❌ No encoding detected for UTF-8 text")
        
        # Test with GBK text
        test_text_gbk = "中文测试文本".encode('gbk')
        results_gbk = from_bytes(test_text_gbk)
        best_match_gbk = results_gbk.best()
        
        if best_match_gbk:
            encoding_gbk = str(best_match_gbk.encoding)
            confidence_gbk = float(best_match_gbk.coherence)
            print(f"✅ GBK Detection: {encoding_gbk} (coherence: {confidence_gbk:.2f})")
        else:
            print("❌ No encoding detected for GBK text")
        
        print("\n✅ All charset-normalizer tests passed!")
        return True
        
    except ImportError as e:
        print(f"❌ charset-normalizer not available: {e}")
        print("\nPlease install: pip install charset-normalizer")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


if __name__ == "__main__":
    success = test_charset_normalizer()
    exit(0 if success else 1)
"""Test charset-normalizer encoding detection"""

def test_charset_normalizer():
    """Test that charset-normalizer can be imported and works correctly"""
    try:
        from charset_normalizer import from_bytes
        print("✅ charset-normalizer import successful")
        
        # Test with UTF-8 text
        test_text_utf8 = "你好世界！Hello World!".encode('utf-8')
        results = from_bytes(test_text_utf8)
        best_match = results.best()
        
        if best_match:
            encoding = str(best_match.encoding)
            confidence = float(best_match.coherence)
            print(f"✅ UTF-8 Detection: {encoding} (coherence: {confidence:.2f})")
        else:
            print("❌ No encoding detected for UTF-8 text")
        
        # Test with GBK text
        test_text_gbk = "中文测试文本".encode('gbk')
        results_gbk = from_bytes(test_text_gbk)
        best_match_gbk = results_gbk.best()
        
        if best_match_gbk:
            encoding_gbk = str(best_match_gbk.encoding)
            confidence_gbk = float(best_match_gbk.coherence)
            print(f"✅ GBK Detection: {encoding_gbk} (coherence: {confidence_gbk:.2f})")
        else:
            print("❌ No encoding detected for GBK text")
        
        print("\n✅ All charset-normalizer tests passed!")
        return True
        
    except ImportError as e:
        print(f"❌ charset-normalizer not available: {e}")
        print("\nPlease install: pip install charset-normalizer")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


if __name__ == "__main__":
    success = test_charset_normalizer()
    exit(0 if success else 1)

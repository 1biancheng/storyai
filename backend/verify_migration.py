"""Quick verification script for charset-normalizer migration"""
import subprocess
import sys

def check_no_cchardet_references():
    """Verify no cchardet references remain in Python files"""
    print("🔍 Checking for cchardet references...")
    result = subprocess.run(
        ['grep', '-r', 'cchardet', 'backend/', '--include=*.py'],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if result.returncode == 0:  # Found matches
        print("❌ Found cchardet references:")
        print(result.stdout)
        return False
    else:
        print("✅ No cchardet references found")
        return True

def check_charset_normalizer_imports():
    """Verify charset-normalizer is properly imported"""
    print("\n🔍 Checking charset-normalizer imports...")
    result = subprocess.run(
        ['grep', '-r', 'from charset_normalizer import', 'backend/', '--include=*.py'],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if 'from_bytes' in result.stdout:
        print("✅ charset-normalizer imports found:")
        for line in result.stdout.strip().split('\n')[:3]:
            print(f"  {line}")
        return True
    else:
        print("❌ No charset-normalizer imports found")
        return False

def check_requirements():
    """Verify requirements.txt has charset-normalizer"""
    print("\n🔍 Checking requirements.txt...")
    try:
        with open('backend/requirements.txt', 'r') as f:
            content = f.read()
        
        if 'charset-normalizer' in content and 'cchardet' not in content:
            print("✅ requirements.txt updated correctly")
            return True
        else:
            print("❌ requirements.txt not updated")
            return False
    except Exception as e:
        print(f"❌ Error reading requirements.txt: {e}")
        return False

def check_textract_enabled():
    """Verify textract is enabled by default"""
    print("\n🔍 Checking textract default configuration...")
    try:
        with open('backend/config.py', 'r') as f:
            content = f.read()
        
        if 'enable_textract: bool = Field(default=True' in content:
            print("✅ textract enabled by default in config.py")
            return True
        else:
            print("❌ textract not enabled by default")
            return False
    except Exception as e:
        print(f"❌ Error reading config.py: {e}")
        return False

def main():
    print("=" * 60)
    print("charset-normalizer Migration Verification")
    print("=" * 60)
    
    checks = [
        check_no_cchardet_references(),
        check_charset_normalizer_imports(),
        check_requirements(),
        check_textract_enabled()
    ]
    
    print("\n" + "=" * 60)
    if all(checks):
        print("✅ All checks passed! Migration successful.")
        print("=" * 60)
        return 0
    else:
        print("❌ Some checks failed. Please review above.")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
"""Quick verification script for charset-normalizer migration"""
import subprocess
import sys

def check_no_cchardet_references():
    """Verify no cchardet references remain in Python files"""
    print("🔍 Checking for cchardet references...")
    result = subprocess.run(
        ['grep', '-r', 'cchardet', 'backend/', '--include=*.py'],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if result.returncode == 0:  # Found matches
        print("❌ Found cchardet references:")
        print(result.stdout)
        return False
    else:
        print("✅ No cchardet references found")
        return True

def check_charset_normalizer_imports():
    """Verify charset-normalizer is properly imported"""
    print("\n🔍 Checking charset-normalizer imports...")
    result = subprocess.run(
        ['grep', '-r', 'from charset_normalizer import', 'backend/', '--include=*.py'],
        capture_output=True,
        text=True,
        shell=True
    )
    
    if 'from_bytes' in result.stdout:
        print("✅ charset-normalizer imports found:")
        for line in result.stdout.strip().split('\n')[:3]:
            print(f"  {line}")
        return True
    else:
        print("❌ No charset-normalizer imports found")
        return False

def check_requirements():
    """Verify requirements.txt has charset-normalizer"""
    print("\n🔍 Checking requirements.txt...")
    try:
        with open('backend/requirements.txt', 'r') as f:
            content = f.read()
        
        if 'charset-normalizer' in content and 'cchardet' not in content:
            print("✅ requirements.txt updated correctly")
            return True
        else:
            print("❌ requirements.txt not updated")
            return False
    except Exception as e:
        print(f"❌ Error reading requirements.txt: {e}")
        return False

def check_textract_enabled():
    """Verify textract is enabled by default"""
    print("\n🔍 Checking textract default configuration...")
    try:
        with open('backend/config.py', 'r') as f:
            content = f.read()
        
        if 'enable_textract: bool = Field(default=True' in content:
            print("✅ textract enabled by default in config.py")
            return True
        else:
            print("❌ textract not enabled by default")
            return False
    except Exception as e:
        print(f"❌ Error reading config.py: {e}")
        return False

def main():
    print("=" * 60)
    print("charset-normalizer Migration Verification")
    print("=" * 60)
    
    checks = [
        check_no_cchardet_references(),
        check_charset_normalizer_imports(),
        check_requirements(),
        check_textract_enabled()
    ]
    
    print("\n" + "=" * 60)
    if all(checks):
        print("✅ All checks passed! Migration successful.")
        print("=" * 60)
        return 0
    else:
        print("❌ Some checks failed. Please review above.")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(main())

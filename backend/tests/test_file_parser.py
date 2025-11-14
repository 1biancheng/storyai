import os
import tempfile
from pathlib import Path

import pytest

from services.file_parser_service import parse_file
from tests.utils.fixture_factory import ensure_mojibake_fixtures


@pytest.mark.parametrize("enc", ["gbk", "big5", "utf-8-sig"]) 
def test_txt_encoding_detection(enc):
    # 在临时文件中写入指定编码的中文文本
    # Big5 不支持"这"等简体字,改用繁体保证可编码
    text = (
        "這是一段測試文字." if enc == "big5" else "这是一段测试文字."
    ) + "換行\r\n以及一些\t控制字符\x07會被清理."
    fd, path = tempfile.mkstemp(suffix=".txt")
    os.close(fd)
    p = Path(path)
    try:
        with open(p, "w", encoding=enc) as f:
            f.write(text)
        parsed = parse_file(str(p))
        expected = "這是一段測試文字." if enc == "big5" else "这是一段测试文字."
        assert expected in parsed["text"]
        # 换行统一为 \n
        assert "\r\n" not in parsed["text"]
        assert "\x07" not in parsed["text"]  # 控制字符已清理
        assert parsed["meta"]["source_path"].endswith(".txt")
    finally:
        try:
            os.remove(p)
        except Exception:
            pass


def test_docx_pdf_epub_use_textract_when_available(monkeypatch):
    # 若运行环境安装了 textract,则 parse_file 对复杂格式应能返回文本
    # 这里仅验证调用流程不抛异常;真实内容由运行环境依赖决定
    samples = [
        (".docx", "sample"),
        (".pdf", "sample"),
        (".epub", "sample"),
    ]
    for ext, content in samples:
        fd, path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        p = Path(path)
        # 写入简单内容,某些格式并非有效结构文件,textract 可能失败并回退为空文本
        with open(p, "wb") as f:
            f.write(content.encode("utf-8"))
        parsed = parse_file(str(p))
        assert "meta" in parsed
        assert parsed["meta"]["source_path"].endswith(ext)
        # 文本可为空(取决于依赖可用与文件结构),但函数不应抛异常
        assert isinstance(parsed["text"], str)
        try:
            os.remove(p)
        except Exception:
            pass


def test_markdown_option_without_plugin():
    # 未安装 markitdown 时,传入 format=markdown 也应安全回退为纯文本
    fd, path = tempfile.mkstemp(suffix=".txt")
    os.close(fd)
    p = Path(path)
    try:
        with open(p, "w", encoding="utf-8") as f:
            f.write("标题\n\n段落一.\n\n段落二.")
        parsed = parse_file(str(p), format="markdown")
        assert "段落一" in parsed["text"]
    finally:
        try:
            os.remove(p)
        except Exception:
            pass


def test_mojibake_fixtures_end_to_end():
    base_dir = Path(__file__).resolve().parents[1]
    files = ensure_mojibake_fixtures(base_dir)

    # 1) GBK 文本
    gbk = parse_file(str(files["gbk_txt"]))
    assert gbk["meta"].get("encoding") in ("GBK", "gbk", "GB2312", "gb2312")
    conf = gbk["meta"].get("confidence") or 0.0
    assert conf >= 0.9
    assert "\uFFFD" not in gbk["text"]  # 不应出现替换符号 �

    # 2) ANSI 文本(Windows-1252)
    ansi = parse_file(str(files["ansi_txt"]))
    assert ansi["meta"].get("encoding") in ("Windows-1252", "windows-1252", "CP1252", "cp1252")
    conf2 = ansi["meta"].get("confidence") or 0.0
    assert conf2 >= 0.9
    assert "€" in ansi["text"]
    assert "\uFFFD" not in ansi["text"]

    # 3) DOCX
    docx = parse_file(str(files["docx_gbk"]))
    assert isinstance(docx["text"], str)
    assert "Mojibake" in docx["text"] or "中文" in docx["text"]

    # 4) PDF
    pdf = parse_file(str(files["pdf_scan"]))
    assert isinstance(pdf["text"], str)
    # 允许空,但不报错
    assert "\uFFFD" not in pdf["text"]

    # 5) HTML (UTF-8 BOM)
    html = parse_file(str(files["html_bom"]))
    assert "中文全角标点" in html["text"]
    # format=markdown 开关存在但未安装插件时回退
    html_md = parse_file(str(files["html_bom"]), format="markdown")
    assert isinstance(html_md["text"], str)

import os
import zipfile
from pathlib import Path


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def write_gbk_txt(path: Path):
    # 增强中文占比以提高编码识别置信度
    content = (
        "这是 GBK 编码的文本,包含大量中文字符以提高识别置信度." * 10
        + "\r\nEnglish line: Mojibake test with mixed CRLF."
        + "\r\n最后一行:包含中文与英文混合."
    )
    with open(path, "w", encoding="gbk") as f:
        f.write(content)


def write_ansi_txt(path: Path):
    content = "ANSI(Windows-1252) 文本,包含欧元符号:€,以及常见标点.\nSecond line with symbols: © ® ™"
    # 在部分环境中直接以 cp1252 编码写入 € 会报错,改为手动编码并二进制写入
    with open(path, "wb") as f:
        f.write(content.encode("cp1252", errors="ignore"))


def write_bom_html(path: Path):
    # UTF-8 BOM + 全角中文标点
    content = "\ufeff<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"></head><body>中文全角标点:,.!?;( )【 】 _ ;<p>测试段落</p></body></html>"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def write_minimal_docx(path: Path):
    """
    生成一个最小 docx 文件(Unicode 存储),包含中文与英文段落.
    不依赖 python-docx,以 zip 方式直接写入必须的部件.
    """
    # 参考 ECMA-376 的最小文档结构
    content_types = (
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>
        """
    ).strip()

    rels = (
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        </Relationships>
        """
    ).strip()

    document_xml = (
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>中文段落:这是一个包含中文的段落.</w:t></w:r></w:p>
            <w:p><w:r><w:t>English paragraph: Mojibake test.</w:t></w:r></w:p>
            <w:sectPr/>
          </w:body>
        </w:document>
        """
    ).strip()

    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document_xml)


def write_minimal_pdf(path: Path):
    """
    生成一个最小可解析的 PDF 文本页面,不依赖第三方库.
    注意:这里嵌入的是 Unicode 文本,但足以触发解析流程;针对 GBK 的严格嵌入较复杂,交由 textract/PyPDF2 处理.
    """
    # 一个极简单页 PDF 文本(仅演示用途)
    # 参考 https://stackoverflow.com/a/25875504 的最小 PDF 模板
    pdf = (
        "%PDF-1.4\n"
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        "4 0 obj<</Length 66>>stream\nBT /F1 24 Tf 72 100 Td (中文段落:PDF 测试文本.) Tj ET\nendstream endobj\n"
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        "xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000278 00000 n \n0000000409 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n515\n%%EOF\n"
    )
    # 写入二进制
    with open(path, "wb") as f:
        f.write(pdf.encode("latin-1", errors="ignore"))


def ensure_mojibake_fixtures(base_dir: Path) -> dict:
    target = base_dir / "tests" / "fixtures" / "mojibake"
    ensure_dir(target)
    files = {
        "gbk_txt": target / "gbk.txt",
        "ansi_txt": target / "ansi.txt",
        "docx_gbk": target / "docx乱码.docx",
        "pdf_scan": target / "scan.pdf",
        "html_bom": target / "bom.html",
    }
    # 生成样本
    write_gbk_txt(files["gbk_txt"]) 
    write_ansi_txt(files["ansi_txt"]) 
    write_minimal_docx(files["docx_gbk"]) 
    write_minimal_pdf(files["pdf_scan"]) 
    write_bom_html(files["html_bom"]) 
    return files

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复章节文件中的编码问题"""

import json
from pathlib import Path

# 修复章节 tI5NTaA6
chapter_file = Path(r"d:\story-ai (3)\backend\workspace\chapters\2f61d12d-9dc6-4b89-b2fe-8237ddcb8a89\chap_002.json")

data = {
    "id": "tI5NTaA6",
    "projectId": "2f61d12d-9dc6-4b89-b2fe-8237ddcb8a89",
    "chapterNumber": 2,
    "title": "第2章: 新章节",
    "content": "",
    "summary": "",
    "wordCount": 0,
    "tags": [],
    "notes": "",
    "displayOrder": 1,
    "createdAt": 1762851729588,
    "updatedAt": 1762994783618
}

with open(chapter_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Fixed chapter file: {chapter_file}")
print(f"Title: {data['title']}")

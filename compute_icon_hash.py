#!/usr/bin/env python3
"""计算 hutao.ico 的 SHA-256 哈希码，用于应用启动校验。

用法：
    python compute_icon_hash.py
"""
import hashlib
import os

BASE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(BASE, 'hutao.ico')

with open(ICON, 'rb') as f:
    data = f.read()

print(hashlib.sha256(data).hexdigest())

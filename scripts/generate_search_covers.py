#!/usr/bin/env python3
"""生成搜索页用户卡片「无配图帖子」的小红书式贴纸素材。

输入：/home/cloud/emoji 下的表情原图（PNG/JPG）。
输出：public/search-covers/emoji-01.webp ... emoji-18.webp。

卡片里再用 CSS 把「渐变色 + 贴纸 + 标题」拼成封面，所以这里只负责
把大尺寸原图压成 256x256、约 10KB 的白色贴纸底，避免每张卡片加载 300KB 的原图。

用法：
    python3 scripts/generate_search_covers.py
    python3 scripts/generate_search_covers.py --src /path/to/emoji --out public/search-covers
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image

# 正向/中性表情，避免随机把「生气/哭泣/救命」贴到严肃帖子上。
# 数量变化时同步修改 src/components/search/UserSearchCard.vue 的 STICKER_COUNT。
EMOJI_FILES = [
    "好耶.png",
    "心动.png",
    "让我康康.jpg",
    "暗中观察.jpg",
    "送你花花.jpg",
    "赞.jpg",
    "转圈圈.jpg",
    "燃起来了.jpg",
    "乖巧.png",
    "贴贴.jpg",
    "我可爱.jpg",
    "睡觉.jpg",
    "脑子待机中.jpg",
    "疑惑.jpg",
    "惊讶.jpg",
    "偷笑.jpg",
    "捏脸.jpg",
    "那咋了.jpg",
]

SIZE = 256


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default="/home/cloud/emoji", help="表情原图目录")
    parser.add_argument("--out", default="public/search-covers", help="输出目录")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    for index, name in enumerate(EMOJI_FILES, 1):
        path = src / name
        if not path.exists():
            print(f"skip missing: {path}")
            continue
        image = Image.open(path).convert("RGBA")
        inner = int(SIZE * 0.84)
        image.thumbnail((inner, inner), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
        canvas.alpha_composite(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
        background = Image.new("RGB", (SIZE, SIZE), (255, 255, 255))
        background.paste(canvas, mask=canvas.split()[3])
        target = out / f"emoji-{index:02d}.webp"
        background.save(target, "WEBP", quality=82, method=6)
        print(f"{target} {os.path.getsize(target)} bytes")


if __name__ == "__main__":
    main()

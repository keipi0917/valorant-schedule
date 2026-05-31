"""App Store スクリーンショットを 6.7" iPhone 要件 (1290x2796) にリサイズ。

使い方:
    1. raw/ フォルダに iPhone で撮影した PNG を配置
    2. python docs/screenshots/resize.py
    3. resized/ フォルダにリサイズ済み画像が出力される
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow が入っていません。`pip install Pillow` を実行してください。")
    sys.exit(1)

# Apple App Store の要件サイズ
# 注: ASC のメディアマネージャーは現在 6.9" (1320x2868) と 6.5" (1284x2778 or 1242x2688)
# のみを受け付ける。6.7" は廃止。6.5" の "tall" 形式 1284x2778 を使用。
TARGET_SIZE = (1284, 2778)  # 6.5" iPhone (tall) - 全モデルにスケーリングされる

BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "raw"
OUT_DIR = BASE_DIR / "resized"

OUT_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)


def main() -> None:
    files = sorted([p for p in RAW_DIR.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg")])
    if not files:
        print(f"raw/ にスクリーンショットが見つかりません: {RAW_DIR}")
        print("iPhone で撮影した PNG をこのフォルダに置いてから再実行してください。")
        return

    print(f"[resize] {len(files)} 枚を {TARGET_SIZE[0]}x{TARGET_SIZE[1]} にリサイズ")
    for src in files:
        with Image.open(src) as img:
            w, h = img.size
            print(f"  {src.name}: {w}x{h} -> {TARGET_SIZE[0]}x{TARGET_SIZE[1]}")
            # 縦横比が一致していない場合は警告
            src_ratio = h / w
            target_ratio = TARGET_SIZE[1] / TARGET_SIZE[0]
            if abs(src_ratio - target_ratio) > 0.01:
                print(f"    ⚠️ 縦横比が異なります (元: {src_ratio:.3f}, 目標: {target_ratio:.3f})")
                print(f"    続行しますが、画像が歪む可能性があります。")
            resized = img.resize(TARGET_SIZE, Image.LANCZOS)
            out_path = OUT_DIR / src.name
            resized.save(out_path, "PNG", optimize=True)
            print(f"    -> {out_path}")

    print(f"\n完了。{OUT_DIR} に {len(files)} 枚のリサイズ済み画像を保存しました。")
    print("これらを App Store Connect にドラッグ&ドロップしてください。")


if __name__ == "__main__":
    main()

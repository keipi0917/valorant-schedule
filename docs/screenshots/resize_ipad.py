"""iPhone のスクリーンショットを iPad 13" 用キャンバス (2064x2752) に
中央配置 (padding) で配置するスクリプト。

iPhone スクショは縦長 (1284x2778) で、iPad キャンバスより少し高い。
スクショ全体を iPad の高さ (2752) に縮小し、中央寄せで配置する。
背景はアプリのスプラッシュ色 #0F1923 に合わせる。

使い方:
    1. raw/ フォルダに iPhone スクショ (1170x2532 撮ったもの) を配置
    2. python docs/screenshots/resize_ipad.py
    3. ipad_resized/ にアップロード可能な iPad PNG が出力される
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow がインストールされていません。`pip install Pillow` してください。")
    sys.exit(1)

IPAD_CANVAS = (2064, 2752)  # iPad 13" inch screenshot size
BACKGROUND_COLOR = (0x0F, 0x19, 0x23)  # アプリのスプラッシュ #0F1923

BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "raw"
OUT_DIR = BASE_DIR / "ipad_resized"
OUT_DIR.mkdir(exist_ok=True)


def main() -> None:
    files = sorted(p for p in RAW_DIR.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not files:
        print(f"raw/ に画像がありません: {RAW_DIR}")
        return

    canvas_w, canvas_h = IPAD_CANVAS
    print(f"[ipad] canvas={canvas_w}x{canvas_h} background={BACKGROUND_COLOR}")

    for src in files:
        with Image.open(src) as img:
            img = img.convert("RGB")
            iw, ih = img.size
            # 高さを canvas に合わせて拡縮 (アスペクト比維持)
            ratio = canvas_h / ih
            new_h = canvas_h
            new_w = int(iw * ratio)
            resized = img.resize((new_w, new_h), Image.LANCZOS)
            # 横が iPad より広い場合は中央クロップ
            if new_w > canvas_w:
                left = (new_w - canvas_w) // 2
                resized = resized.crop((left, 0, left + canvas_w, canvas_h))
                new_w = canvas_w
            # 暗い背景キャンバス上に貼り付け
            canvas = Image.new("RGB", IPAD_CANVAS, BACKGROUND_COLOR)
            x = (canvas_w - new_w) // 2
            canvas.paste(resized, (x, 0))
            out = OUT_DIR / src.name
            canvas.save(out, "PNG", optimize=True)
            print(f"  {src.name}: scaled to {new_w}x{new_h}, padded to {canvas_w}x{canvas_h} -> {out}")

    print(f"\n完了。{OUT_DIR} に {len(files)} 枚を保存しました。")
    print("これらを ASC の iPad 13\" ドロップゾーンにアップロードしてください。")


if __name__ == "__main__":
    main()

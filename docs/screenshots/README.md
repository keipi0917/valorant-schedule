# App Store スクリーンショット

## 撮影手順

1. EAS 本番ビルド完了後、`eas submit` で TestFlight に配布
2. iPhone の TestFlight アプリで V-HUB を「アップデート」
3. V-HUB を起動し以下 3-5 画面を撮影 (電源ボタン + 音量上 同時押し)
   - 試合一覧 (今後の試合)
   - 試合一覧 (過去の結果 + スコア)
   - カレンダー (月表示で試合日マーカー)
   - 試合詳細
   - (任意) Explore タブ
4. 撮影した PNG を AirDrop で Mac に送る
5. このフォルダ `docs/screenshots/raw/` に保存

## リサイズ

撮影画像は iPhone 12/13/14 サイズ (1170x2532) なので、App Store 6.7" 要件 (1290x2796) にアップスケールが必要。縦横比は同じなので品質劣化は最小。

```bash
cd /Users/kei/valorant-schedule
source .venv/bin/activate
pip install Pillow --quiet
python docs/screenshots/resize.py
```

リサイズ後の画像は `docs/screenshots/resized/` に保存される。これらを ASC にアップロード。

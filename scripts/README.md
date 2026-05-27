# V-HUB Scraper

Valorant 試合データを vlr.gg から取得して Firestore に upsert する Python スクリプト。

## セットアップ

### 1. Python 環境

Python 3.10+ を想定しています。仮想環境を作って依存をインストール:

```bash
cd /Users/kei/valorant-schedule
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 2. Firebase の秘密鍵を取得

1. [Firebase コンソール](https://console.firebase.google.com/) で V-HUB プロジェクト (v-hub-for-schedule) を開く
2. **プロジェクト設定** → **サービス アカウント** タブ
3. **新しい秘密鍵を生成** を押すと JSON ファイルがダウンロードされる
4. それを `scripts/serviceAccountKey.json` という名前で保存

⚠️ この JSON ファイルは Firestore への管理者権限を持つので絶対に Git に commit しないこと。`scripts/.gitignore` で除外済みです。

## 実行

```bash
# 予定 + 結果(直近2ページ)を取得
python scripts/scraper.py

# 予定だけ
python scripts/scraper.py upcoming

# 結果ページを3ページ分(過去をもっと遡る)
python scripts/scraper.py results 3
```

実行ログ例:

```
[scrape] upcoming
  GET https://www.vlr.gg/matches
[scrape] results x2
  GET https://www.vlr.gg/matches/results
  GET https://www.vlr.gg/matches/results/?page=2
[parse] 47 events
[firestore] +12 new, ~35 updated
```

## Firestore のスキーマ

`events` コレクションの各ドキュメントは以下のフィールドを持ちます:

| field | 例 | 説明 |
| --- | --- | --- |
| `title` | `"VCT Pacific Stage 1"` | 大会名 |
| `date` | `"2025-05-15"` | JST の日付 |
| `time` | `"22:00"` | JST の時刻 |
| `teams` | `"Paper Rex vs ZETA DIVISION"` | チーム名(VS 区切り) |
| `team1_logo` | URL or null | チームロゴ |
| `team2_logo` | URL or null | チームロゴ |
| `region` | `"VCT"` | 表示用ラベル |
| `regionColor` | `"#FF4655"` | バッジ色 |
| `type` | `"VCT"` \| `"VCJ"` \| `"GC"` | フィルタ用 |
| `youtube` | URL or null | 公式配信 |
| `status` | `"upcoming"` \| `"live"` \| `"completed"` | 試合状態 |
| `team1_score` | `2` \| null | スコア(終了/ライブのみ) |
| `team2_score` | `1` \| null | スコア |
| `source_url` | `"https://www.vlr.gg/.../"` | 出典 |

## 自動化(任意)

### macOS の launchd / cron

毎朝 6 時に実行する例:

```bash
crontab -e
```

```cron
0 6 * * * cd /Users/kei/valorant-schedule && /Users/kei/valorant-schedule/.venv/bin/python scripts/scraper.py >> /tmp/vhub-scraper.log 2>&1
```

### GitHub Actions (おすすめ・無料)

`.github/workflows/scrape.yml` を新規作成し、Secret に `FIREBASE_SERVICE_ACCOUNT` (JSON の中身まるごと) を登録して使う。雛形:

```yaml
name: scrape

on:
  schedule:
    - cron: '0 21 * * *'  # JST 6:00 ≒ UTC 21:00
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r scripts/requirements.txt
      - name: Write service account
        run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > scripts/serviceAccountKey.json
      - run: python scripts/scraper.py
```

## トラブルシュート

- **0件でした** と出る: vlr.gg の HTML 構造が変わった可能性大。`scripts/scraper.py` の `_parse_match_card` のセレクタを実 DOM (DevTools で確認) に合わせて直す。
- **`PermissionDenied`**: serviceAccountKey が別プロジェクトのものになっていないか確認。
- **時刻がズレる**: vlr.gg は UTC 表記。`_shift_to_jst` で +9 時間しているが、日付の繰り上がりは厳密でないので、深夜の試合は手で確認推奨。

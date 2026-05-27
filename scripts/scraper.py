"""
V-HUB scraper
=============
vlr.gg から Valorant の試合データ(予定+結果)を取得し、Firestore の events コレクションに upsert する。

使い方:
    1) pip install -r scripts/requirements.txt
    2) Firebase コンソール > プロジェクト設定 > サービスアカウント
       > "新しい秘密鍵を生成" で serviceAccountKey.json を取得し、scripts/ に置く
    3) python scripts/scraper.py            # 予定 + 結果(直近2ページ)を取得
       python scripts/scraper.py upcoming    # 予定だけ
       python scripts/scraper.py results 3   # 結果ページを3ページ分

備考:
    - スクレイピング対象の HTML 構造は変わりやすいので、
      動かなくなったら _parse_match_card のセレクタを vlr.gg の実 DOM に合わせて調整してください。
    - 既存ドキュメントには team1_score / team2_score / status のみマージ更新します
      (運用中に手で直したフィールドが上書きされないように)。
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import hashlib
from dataclasses import dataclass, asdict
from typing import Optional

import requests
from bs4 import BeautifulSoup

import firebase_admin
from firebase_admin import credentials, firestore

VLR_BASE = "https://www.vlr.gg"
UPCOMING_URL = f"{VLR_BASE}/matches"
RESULTS_URL = f"{VLR_BASE}/matches/results"

LOGO_CACHE_PATH = os.path.join(os.path.dirname(__file__), "team_logos_cache.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# 地域(リージョン)タグの色マップ。Geminiコメント時に index.tsx で参照していたものに合わせる。
REGION_COLOR = {
    "VCT": "#FF4655",
    "VCJ": "#5BC0EB",
    "GC": "#FFD166",
    "EMEA": "#9B5DE5",
    "AMER": "#F15BB5",
    "PAC": "#00BBF9",
    "CN": "#FB6107",
}


@dataclass
class MatchEvent:
    """Firestore に保存する1試合分のスキーマ"""
    title: str
    date: str            # YYYY-MM-DD
    time: str            # HH:mm (JST)
    teams: str           # "TeamA vs TeamB"
    team1_logo: Optional[str]
    team2_logo: Optional[str]
    region: str          # 表示用ラベル
    regionColor: str
    type: str            # 'VCT' | 'VCJ' | 'GC' など
    youtube: Optional[str]
    status: str          # 'upcoming' | 'live' | 'completed'
    team1_score: Optional[int]
    team2_score: Optional[int]
    source_url: str


def _doc_id_for(url: str) -> str:
    """vlr.gg の試合URLから安定したドキュメントIDを作る"""
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]


def _classify_type(event_name: str) -> str:
    """イベント名から VCT / VCJ / GC を雑に分類する。"""
    name = event_name.upper()
    if "VCT" in name:
        if "JAPAN" in name or "VCJ" in name:
            return "VCJ"
        return "VCT"
    if "GAME CHANGERS" in name or "GC" in name:
        return "GC"
    if "CHALLENGERS" in name and "JAPAN" in name:
        return "VCJ"
    return "VCT"


def _is_japan_event(event_name: str) -> bool:
    """日本国内イベントの判定。"""
    name = (event_name or "").upper()
    return "JAPAN" in name or "VCJ" in name or "日本" in (event_name or "")


def _is_tier1_overseas(event_name: str) -> bool:
    """海外Tier1判定 — VCT国際リーグ + Masters + Champions のみ True。
    Challengers / Game Changers / Off-season tournaments は False。
    """
    name = (event_name or "").upper()

    # 除外条件: Challengers / Game Changers / VCT Game Changers Championship を含むものは Tier2 以下
    if "CHALLENGERS" in name:
        return False
    if "GAME CHANGERS" in name:
        return False

    # VCT 系のみ Tier1 候補とする
    if "VCT" not in name:
        return False

    # VCT International League (Pacific / Americas / EMEA / China)
    for region in ("PACIFIC", "AMERICAS", "EMEA", "CHINA"):
        if region in name:
            return True

    # VCT Masters
    if "MASTERS" in name:
        return True

    # VCT Champions (ただし "CHAMPIONSHIP" は GC Championship と紛らわしいので除外)
    if "CHAMPIONS" in name and "CHAMPIONSHIP" not in name:
        return True

    return False


def _is_other_tier1(event_name: str) -> bool:
    """VCT 系以外の国際 Tier1 大会(Esports World Cup など)。"""
    name = (event_name or "").upper()
    if "GAME CHANGERS" in name or "CHALLENGERS" in name:
        return False
    if "ESPORTS WORLD CUP" in name:
        return True
    return False


def _should_keep_event(event_name: str) -> bool:
    """この試合を保存対象にすべきか? 日本は全部キープ、海外は Tier1 のみ。"""
    if _is_japan_event(event_name):
        return True
    if _is_tier1_overseas(event_name):
        return True
    return _is_other_tier1(event_name)


def _region_color_for(region_label: str, kind: str) -> str:
    key = region_label.upper().strip()
    if key in REGION_COLOR:
        return REGION_COLOR[key]
    return REGION_COLOR.get(kind, "#444444")


def _parse_score(text: str) -> Optional[int]:
    text = (text or "").strip()
    if text.isdigit():
        return int(text)
    return None


def _absolutize(src: str) -> Optional[str]:
    """vlr.gg の img src を絶対 URL に変換。プレースホルダーやスキームレス対応。"""
    if not src:
        return None
    src = src.strip()
    if not src:
        return None
    # プレースホルダー(チームロゴ未登録時の汎用画像)は無視
    if "/img/vlr/tmp/vlr.png" in src or src.endswith("/vlr.png"):
        return None
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return VLR_BASE + src
    return src


def _parse_match_card(card, default_date: str, is_results: bool) -> Optional[MatchEvent]:
    """vlr.gg の一覧ページに並んでいる試合カード(<a>)を1件パースする。

    HTML構造は変わりやすいので、壊れたらここを直すこと。
    """
    href = card.get("href") or ""
    if not href.startswith("/"):
        return None
    url = VLR_BASE + href

    # 各チームのコンテナをまるごと取得 → 名前・ロゴ・スコアをひとまとめに抽出
    team_containers = card.select(".match-item-vs-team")
    if len(team_containers) < 2:
        # フォールバック: 旧構造でも名前だけは拾えるように
        teams = card.select(".match-item-vs-team-name .text-of")
        if len(teams) < 2:
            return None
        team1_name = teams[0].get_text(strip=True)
        team2_name = teams[1].get_text(strip=True)
        team1_logo = None
        team2_logo = None
    else:
        def _extract(container):
            name_node = container.select_one(".match-item-vs-team-name .text-of") or container.select_one(".text-of")
            name = name_node.get_text(strip=True) if name_node else ""
            img = container.select_one("img")
            logo = _absolutize(img.get("src", "")) if img else None
            return name, logo

        team1_name, team1_logo = _extract(team_containers[0])
        team2_name, team2_logo = _extract(team_containers[1])

    score_nodes = card.select(".match-item-vs-team-score")
    team1_score: Optional[int] = None
    team2_score: Optional[int] = None
    if len(score_nodes) >= 2:
        team1_score = _parse_score(score_nodes[0].get_text())
        team2_score = _parse_score(score_nodes[1].get_text())

    time_node = card.select_one(".match-item-time")
    time_text = time_node.get_text(strip=True) if time_node else ""
    # vlr.gg は UTC 表示なので、ざっくり JST(+9h) に直しておく
    time_jst = _shift_to_jst(time_text)

    event_node = card.select_one(".match-item-event")
    event_name = event_node.get_text(" ", strip=True) if event_node else ""

    # 🌟 Tier1 フィルタ: 海外の Tier2 以下はここで弾く
    if not _should_keep_event(event_name):
        return None

    region_tag = card.select_one(".match-item-event-series")
    region_label = region_tag.get_text(strip=True) if region_tag else ""

    kind = _classify_type(event_name)
    if not region_label:
        region_label = kind

    eta_node = card.select_one(".match-item-eta .ml-eta")
    is_live = "live" in (card.get("class") or [])
    status: str
    if is_results or (team1_score is not None and team2_score is not None and (team1_score + team2_score) > 0):
        status = "completed"
    elif is_live or (eta_node and "live" in eta_node.get_text(strip=True).lower()):
        status = "live"
    else:
        status = "upcoming"

    return MatchEvent(
        title=event_name or f"{team1_name} vs {team2_name}",
        date=default_date,
        time=time_jst,
        teams=f"{team1_name} vs {team2_name}",
        team1_logo=team1_logo,
        team2_logo=team2_logo,
        region=region_label,
        regionColor=_region_color_for(region_label, kind),
        type=kind,
        youtube=None,
        status=status,
        team1_score=team1_score if status in ("completed", "live") else None,
        team2_score=team2_score if status in ("completed", "live") else None,
        source_url=url,
    )


def _shift_to_jst(time_text: str) -> str:
    """'10:00 PM' のような UTC 時刻表記を JST(+9h) の 'HH:mm' に変換する。

    解析に失敗したら元の文字列をそのまま返す。
    """
    m = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)?", time_text.strip(), re.IGNORECASE)
    if not m:
        return time_text.strip()
    hour = int(m.group(1))
    minute = int(m.group(2))
    suffix = (m.group(3) or "").upper()
    if suffix == "PM" and hour != 12:
        hour += 12
    if suffix == "AM" and hour == 12:
        hour = 0
    hour = (hour + 9) % 24  # UTC -> JST
    return f"{hour:02d}:{minute:02d}"


def _parse_listing(html: str, is_results: bool) -> list[MatchEvent]:
    soup = BeautifulSoup(html, "html.parser")
    events: list[MatchEvent] = []

    # vlr.gg の一覧は <div class="wf-label mod-large">YYYY-MM-DD</div> のあとに <a class="match-item"> が並ぶ
    current_date = ""
    for node in soup.select(".wf-card-wrap > div, .wf-card > div, .wf-label, a.match-item"):
        if "wf-label" in (node.get("class") or []):
            # ラベルから日付らしき文字列を取り出す
            label_text = node.get_text(" ", strip=True)
            current_date = _extract_date(label_text)
            continue
        if node.name == "a" and "match-item" in (node.get("class") or []):
            ev = _parse_match_card(node, current_date, is_results)
            if ev:
                events.append(ev)
    return events


def _extract_date(label: str) -> str:
    """ラベル文字列('Today', 'Wed, Jan 10, 2025' 等)から YYYY-MM-DD を抽出。失敗時は空文字。"""
    from datetime import datetime, timezone, timedelta

    jst = timezone(timedelta(hours=9))
    today = datetime.now(jst).date()
    text = label.lower()
    if "today" in text:
        return today.isoformat()
    if "yesterday" in text:
        return (today - timedelta(days=1)).isoformat()
    if "tomorrow" in text:
        return (today + timedelta(days=1)).isoformat()
    for fmt in ("%a, %b %d, %Y", "%A, %B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(label.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def fetch(url: str) -> str:
    print(f"  GET {url}")
    res = requests.get(url, headers=HEADERS, timeout=20)
    res.raise_for_status()
    return res.text


def scrape_upcoming() -> list[MatchEvent]:
    print("[scrape] upcoming")
    return _parse_listing(fetch(UPCOMING_URL), is_results=False)


def scrape_results(pages: int = 2) -> list[MatchEvent]:
    print(f"[scrape] results x{pages}")
    out: list[MatchEvent] = []
    for p in range(1, pages + 1):
        url = RESULTS_URL if p == 1 else f"{RESULTS_URL}/?page={p}"
        out.extend(_parse_listing(fetch(url), is_results=True))
        time.sleep(1.0)  # vlr.gg に優しく
    return out


def _name_key(name: str) -> str:
    """チーム名キャッシュ用の正規化キー。大文字小文字・前後空白を無視。"""
    return (name or "").strip().lower()


def load_logo_cache() -> dict:
    """team_logos_cache.json からチーム名→ロゴURLマップを読み込む。無ければ空。"""
    if not os.path.exists(LOGO_CACHE_PATH):
        return {}
    try:
        with open(LOGO_CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_logo_cache(cache: dict) -> None:
    with open(LOGO_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False, sort_keys=True)


def seed_cache_from_firestore(db, cache: dict) -> int:
    """既存の Firestore events を走査し、保存済みのロゴURLをキャッシュに統合する。"""
    added = 0
    for snap in db.collection("events").stream():
        d = snap.to_dict() or {}
        teams = (d.get("teams") or "").split(" vs ")
        if len(teams) < 2:
            continue
        for name, logo in ((teams[0], d.get("team1_logo")), (teams[1], d.get("team2_logo"))):
            if not logo:
                continue
            key = _name_key(name)
            if key and key not in cache:
                cache[key] = logo
                added += 1
    return added


def update_cache_from_events(events: list, cache: dict) -> int:
    """今回スクレイプした events から新しいロゴURLをキャッシュに追加。"""
    added = 0
    for ev in events:
        names = (ev.teams or "").split(" vs ")
        if len(names) < 2:
            continue
        if ev.team1_logo:
            key = _name_key(names[0])
            if key and cache.get(key) != ev.team1_logo:
                cache[key] = ev.team1_logo
                added += 1
        if ev.team2_logo:
            key = _name_key(names[1])
            if key and cache.get(key) != ev.team2_logo:
                cache[key] = ev.team2_logo
                added += 1
    return added


def fill_logos_from_cache(events: list, cache: dict) -> int:
    """ロゴが取れなかった events を cache のマップで補完する。"""
    filled = 0
    for ev in events:
        names = (ev.teams or "").split(" vs ")
        if len(names) < 2:
            continue
        if not ev.team1_logo:
            ev.team1_logo = cache.get(_name_key(names[0]))
            if ev.team1_logo:
                filled += 1
        if not ev.team2_logo:
            ev.team2_logo = cache.get(_name_key(names[1]))
            if ev.team2_logo:
                filled += 1
    return filled


def get_db():
    key_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    if not os.path.exists(key_path):
        raise SystemExit(
            f"serviceAccountKey.json が見つかりません: {key_path}\n"
            "Firebase コンソール > プロジェクト設定 > サービスアカウントから取得してください。"
        )
    if not firebase_admin._apps:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()


def upsert(db, events: list[MatchEvent]) -> tuple[int, int]:
    """events を Firestore に upsert。新規作成数と更新数のタプルを返す。"""
    created = 0
    updated = 0
    coll = db.collection("events")
    for ev in events:
        if not ev.date:
            continue
        doc_id = _doc_id_for(ev.source_url)
        ref = coll.document(doc_id)
        snap = ref.get()
        if snap.exists:
            # 既存の試合は status / スコア / time / ロゴ(未保存なら) を更新
            existing = snap.to_dict() or {}
            patch = {
                "status": ev.status,
                "team1_score": ev.team1_score,
                "team2_score": ev.team2_score,
                "time": ev.time or existing.get("time", ""),
            }
            # ロゴは新規スクレイプで取れた時だけ上書き(取れなかった場合は既存を維持)
            if ev.team1_logo:
                patch["team1_logo"] = ev.team1_logo
            if ev.team2_logo:
                patch["team2_logo"] = ev.team2_logo
            ref.set(patch, merge=True)
            updated += 1
        else:
            ref.set(asdict(ev))
            created += 1
    return created, updated


def cleanup_non_tier1(db, dry_run: bool = True) -> tuple[int, int]:
    """Firestore 上の events をスキャンし、Tier1 フィルタに合わない試合を削除する。

    dry_run=True なら削除対象を出力するだけ。dry_run=False で実際に削除。
    """
    coll = db.collection("events")
    to_delete: list[tuple[str, str]] = []
    total = 0
    for snap in coll.stream():
        total += 1
        data = snap.to_dict() or {}
        title = data.get("title", "")
        if not _should_keep_event(title):
            to_delete.append((snap.id, f"{data.get('region', '')} | {title} | {data.get('teams', '')}"))

    print(f"[cleanup] total {total} docs, drop {len(to_delete)} ({'dry-run' if dry_run else 'DELETING'})")
    for did, label in to_delete[:20]:
        print(f"  - {did[:8]}…  {label}")
    if len(to_delete) > 20:
        print(f"  …他 {len(to_delete) - 20} 件")

    if not dry_run:
        for did, _ in to_delete:
            coll.document(did).delete()
        print(f"[cleanup] deleted {len(to_delete)} docs")
    return total, len(to_delete)


def main():
    args = sys.argv[1:]
    mode = args[0] if args else "all"

    # 🌟 cleanup モード: Tier1 フィルタに合わない既存ドキュメントを削除
    if mode == "cleanup":
        db = get_db()
        confirm = len(args) > 1 and args[1] == "--delete"
        cleanup_non_tier1(db, dry_run=not confirm)
        if not confirm:
            print("\n実際に削除するには:  python scripts/scraper.py cleanup --delete")
        return

    pages = int(args[1]) if len(args) > 1 else 2

    events: list[MatchEvent] = []
    if mode in ("all", "upcoming"):
        events.extend(scrape_upcoming())
    if mode in ("all", "results"):
        events.extend(scrape_results(pages=pages))

    print(f"[parse] {len(events)} events")
    if not events:
        print("0件でした。HTML構造が変わったか、ネットワークの問題が考えられます。")
        return

    db = get_db()

    # 🌟 ロゴキャッシュの構築フロー
    cache = load_logo_cache()
    cache_initial = len(cache)
    # 初回 or キャッシュが空に近い時は Firestore から既存ロゴを吸い上げる
    if cache_initial < 50:
        seeded = seed_cache_from_firestore(db, cache)
        if seeded:
            print(f"[cache] seeded {seeded} entries from Firestore")
    # 今回スクレイプ分のロゴをキャッシュに追加
    added = update_cache_from_events(events, cache)
    # 取れなかった events をキャッシュで補完
    filled = fill_logos_from_cache(events, cache)
    save_logo_cache(cache)
    print(f"[cache] total {len(cache)} teams (+{added} from scrape), filled {filled} missing logos")

    created, updated = upsert(db, events)
    print(f"[firestore] +{created} new, ~{updated} updated")


if __name__ == "__main__":
    main()

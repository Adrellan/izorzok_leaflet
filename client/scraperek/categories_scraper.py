"""
Kategória-scraper az Ízőrzők recept oldalhoz.

Forrás: https://www.izorzok.hu/receptek/

Fő cél: a 13 recept-kategória nevének és linkjének kigyűjtése.

Használat (példa):
    python categories_scraper.py --json out/categories.json
    python categories_scraper.py --csv out/categories.csv

Megjegyzés: a futtatás HTTP kérést végez az oldal felé.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Iterable, Set

import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "https://www.izorzok.hu"
LIST_URL = f"{BASE_URL}/receptek/"


# -----------------------------
# Modellek
# -----------------------------


@dataclass
class Category:
    name: str
    url: str


# -----------------------------
# HTTP segédek
# -----------------------------


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            )
        }
    )
    return s


def fetch_html(session: requests.Session, url: str, retries: int = 3, delay: float = 1.0) -> Optional[str]:
    last: Optional[Exception] = None
    for i in range(retries):
        try:
            r = session.get(url, timeout=20)
            if r.status_code == 200:
                return r.text
            if 500 <= r.status_code < 600:
                last = RuntimeError(f"HTTP {r.status_code}")
            else:
                r.raise_for_status()
        except Exception as e:  # pragma: no cover - hálózati hiba
            last = e
        time.sleep(delay * (i + 1))
    print(f"[WARN] Nem sikerült letölteni: {url}: {last}", file=sys.stderr)
    return None


# -----------------------------
# Parszolás
# -----------------------------


def _abs_url(href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return f"{BASE_URL}/{href}"


def _text(el: Tag) -> str:
    return (el.get_text(" ", strip=True) or "").strip()


def extract_categories(html: str) -> List[Category]:
    soup = BeautifulSoup(html, "html.parser")

    # 1) Próbálkozzunk ismert mintákkal: kategória listák/nav-ok
    containers: List[Tag] = []
    containers += soup.select(
        ",".join(
            [
                "nav.category-nav",
                "ul.category-list, ul.categories, ul.cat-list, .categories-list",
                "div.categories, section.categories, .cat-links, .category-links",
                "aside .widget_categories, .widget .categories",
                "div.filter, .filters, .recipe-categories",
            ]
        )
    )
    if not containers:
        # Ha nincs dedikált konténer, essünk vissza az egész oldalra
        containers = [soup]

    anchors: List[Tag] = []
    for root in containers:
        anchors.extend(root.select("a[href]"))

    out: List[Category] = []
    seen: Set[str] = set()
    for a in anchors:
        href = a.get("href") or ""
        name = _text(a)
        if not href or not name:
            continue
        url = _abs_url(href)
        # Heurisztika: a kategória linkjei jellemzően tartalmazzák a 'kategoria' vagy 'kategoriak'
        # szót az útvonalban, és a /receptek/ rész környékén jelennek meg.
        path = url.lower()
        if ("kategoria" in path or "kategori" in path) and "/recep" in path:
            key = (name.lower(), url)
            if key in seen:
                continue
            seen.add(key)
            out.append(Category(name=name, url=url))

    # Utószűrés: távolítsuk el az esetleges "Összes"/"Minden" jellegű linkeket
    cleaned: List[Category] = []
    for c in out:
        n = c.name.lower()
        if any(k in n for k in ["összes", "minden", "mind", "all", "össz"]):
            continue
        cleaned.append(c)

    # Dedup név alapján is (ha több link ugyanarra a névre mutat)
    unique_by_name: List[Category] = []
    seen_names: Set[str] = set()
    for c in cleaned:
        if c.name not in seen_names:
            seen_names.add(c.name)
            unique_by_name.append(c)

    return unique_by_name


# -----------------------------
# CLI
# -----------------------------


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Ízőrzők kategória-scraper")
    p.add_argument("--json", dest="json_path", help="JSON kimeneti fájl")
    p.add_argument("--csv", dest="csv_path", help="CSV kimeneti fájl")
    args = p.parse_args(list(argv) if argv is not None else None)

    session = make_session()
    html = fetch_html(session, LIST_URL)
    if not html:
        print("[ERROR] Nem sikerült letölteni az oldalt.", file=sys.stderr)
        return 2

    cats = extract_categories(html)

    # Konzolra is írjunk ki egy összefoglalót
    print(json.dumps([asdict(c) for c in cats], ensure_ascii=False, indent=2))

    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as f:
            json.dump([asdict(c) for c in cats], f, ensure_ascii=False, indent=2)

    if args.csv_path:
        with open(args.csv_path, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(["name", "url"])
            for c in cats:
                w.writerow([c.name, c.url])

    # Jelezzük, ha nem 13 darab az eredmény – de ettől még sikeres lehet a futás
    if len(cats) != 13:
        print(f"[WARN] Kategóriák száma eltér a várt 13-tól: {len(cats)}", file=sys.stderr)

    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())


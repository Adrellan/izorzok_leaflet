import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, asdict
from typing import Iterable, List, Optional, Tuple, Dict, Set

import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "https://www.izorzok.hu"
LISTING_URL = f"{BASE_URL}/kategoria/receptek/"


# -----------------------------
# Utilities
# -----------------------------


def strip_accents(s: str) -> str:
    """Remove accents for accent-insensitive matching."""
    if not s:
        return s
    nfkd_form = unicodedata.normalize("NFKD", s)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


def normalize_text(s: str) -> str:
    return strip_accents(s or "").lower().strip()


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def read_settlements(file_path: str) -> List[str]:
    settlements: List[str] = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                name = line.strip()
                if not name:
                    continue
                # Remove seasonal/holiday suffixes like " – Karácsony"
                name = re.sub(r"\s+–\s+.*$", "", name)
                name = re.sub(r"\s+-\s+.*$", "", name)
                if name and name not in settlements:
                    settlements.append(name)
    except FileNotFoundError:
        pass
    return settlements


def unique(seq: Iterable[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# -----------------------------
# HTTP helpers
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
    last_exc: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code == 200:
                return resp.text
            # Retry on transient 5xx
            if 500 <= resp.status_code < 600:
                last_exc = RuntimeError(f"HTTP {resp.status_code}")
            else:
                # 4xx is likely permanent
                resp.raise_for_status()
        except Exception as e:
            last_exc = e
        time.sleep(delay * attempt)
    print(f"[WARN] Failed to fetch {url}: {last_exc}")
    return None


# -----------------------------
# Data model
# -----------------------------


@dataclass
class Recipe:
    url: str
    title: str
    year: Optional[int]
    settlement: Optional[str]
    ingredients: List[str]


# -----------------------------
# Parsing helpers
# -----------------------------


def find_max_page(soup: BeautifulSoup) -> int:
    """Try to detect the max page number from pagination."""
    # Common WordPress pagination structures
    candidates = []
    for a in soup.select(".pagination a, .nav-links a, .page-numbers a, a.page-numbers"):
        txt = (a.get_text(" ", strip=True) or "").strip()
        if txt.isdigit():
            candidates.append(int(txt))
    if candidates:
        return max(candidates)

    # Fallback: look for last page link rel/title
    for a in soup.select("a[aria-label='Last'], a.last, a[rel='last']"):
        m = re.search(r"page/(\d+)/?", a.get("href", ""))
        if m:
            return int(m.group(1))

    return 1


def parse_listing_links(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: List[str] = []

    # Typical WP theme: h2.entry-title a
    for a in soup.select("h2.entry-title a[href]"):
        links.append(a["href"]) 

    # Additional fallbacks: article entries
    for a in soup.select("article a[href]"):
        href = a["href"]
        if not href:
            continue
        # Skip navigational anchors
        if href.startswith("#"):
            continue
        if BASE_URL not in href:
            # Convert relative to absolute if needed
            if href.startswith("/"):
                href = BASE_URL + href
            else:
                continue
        # Heuristic: avoid category/tag links in listing
        if "/kategoria/" in href or "/cimke/" in href:
            continue
        links.append(href)

    return unique(links)


def find_text_block_after_heading(content_root: Tag, heading_keywords: List[str]) -> List[str]:
    """Find list items or paragraphs after a heading that matches one of the keywords."""
    norm_keys = [normalize_text(k) for k in heading_keywords]
    # Look for headings h1-h6 and strong labels
    candidates = content_root.select("h1, h2, h3, h4, h5, h6, strong, b, p")
    for el in candidates:
        text = normalize_text(el.get_text(" ", strip=True))
        if any(k in text for k in norm_keys):
            # Gather subsequent sibling content until next heading
            items: List[str] = []
            cursor: Optional[Tag] = el
            while cursor is not None:
                cursor = cursor.find_next_sibling()
                if cursor is None:
                    break
                if cursor.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
                    break
                # Prefer list items
                for li in cursor.select("li"):
                    txt = clean_text(li.get_text(" ", strip=True))
                    if txt:
                        items.append(txt)
                # Fallback: split paragraphs by newlines, semicolons, commas
                if cursor.name in {"p", "div"} and not items:
                    raw = cursor.get_text("\n", strip=True)
                    # Heuristic split
                    parts = re.split(r"\n+|;|,", raw)
                    for part in parts:
                        txt = clean_text(part)
                        # Filter non-ingredient-ish fragments
                        if len(txt) > 2:
                            items.append(txt)
                if items:
                    # Stop once we collected some items from the immediate block
                    break
            return [i for i in (t.strip("-• ") for t in items) if i]
    return []


def extract_year(soup: BeautifulSoup, content_root: Optional[Tag]) -> Optional[int]:
    # 1) Look for explicit labels: Év: 2021
    haystacks: List[str] = []
    if content_root is not None:
        haystacks.append(content_root.get_text("\n", strip=True))
    # Meta time
    for t in soup.select("time, meta[property='article:published_time']"):
        if isinstance(t, Tag):
            dt = t.get("datetime") or t.get("content") or t.get_text(" ", strip=True)
            if dt:
                haystacks.append(dt)
    blob = "\n".join(haystacks)
    m = re.search(r"(?i)(?:év|dátum)\s*[:–-]?\s*(20\d{2}|19\d{2})", blob)
    if m:
        return int(m.group(1))
    # 2) Any year-like number in the blob
    m2 = re.search(r"\b(20\d{2}|19\d{2})\b", blob)
    if m2:
        return int(m2.group(1))
    return None


def extract_settlement(
    soup: BeautifulSoup,
    content_root: Optional[Tag],
    settlements: List[str],
) -> Optional[str]:
    if not settlements:
        return None
    norm_map: Dict[str, str] = {normalize_text(s): s for s in settlements}

    texts: List[str] = []
    # Title
    title_el = soup.select_one("h1.entry-title, .entry-title")
    if title_el:
        texts.append(title_el.get_text(" ", strip=True))
    # Breadcrumbs and taxonomies
    for a in soup.select("nav.breadcrumbs a, .cat-links a, .tags-links a, a[rel='category tag']"):
        texts.append(a.get_text(" ", strip=True))
    # Content text (limit size for performance)
    if content_root is not None:
        texts.append(content_root.get_text(" ", strip=True)[:5000])

    blob = normalize_text(" \n ".join(texts))
    # Try full-word match first
    for norm_name, orig in norm_map.items():
        # Word boundary-ish: allow names with spaces or hyphens
        # Build regex to avoid partial matches inside words
        pattern = r"(?<!\w)" + re.escape(norm_name) + r"(?!\w)"
        if re.search(pattern, blob):
            return orig
    # Fallback: simple contains
    for norm_name, orig in norm_map.items():
        if norm_name in blob:
            return orig
    return None


def parse_recipe(session: requests.Session, url: str, settlements: List[str], delay: float = 0.5) -> Optional[Recipe]:
    html = fetch_html(session, url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    # Title
    title_el = soup.select_one("h1.entry-title, .entry-title")
    title = clean_text(title_el.get_text(" ", strip=True)) if title_el else ""

    # Content root
    content_root = soup.select_one(".entry-content, .post-content, article")

    # Ingredients
    ingredients = find_text_block_after_heading(
        content_root or soup, ["Hozzávalók", "Hozzavalok", "Hozzávaló"]
    )

    # Year
    year = extract_year(soup, content_root)

    # Settlement
    settlement = extract_settlement(soup, content_root, settlements)

    time.sleep(delay)
    return Recipe(url=url, title=title, year=year, settlement=settlement, ingredients=ingredients)


def iter_listing_pages(session: requests.Session, start_page: int, end_page: Optional[int]) -> Iterable[Tuple[int, str]]:
    # Fetch first page to detect max if needed
    first_url = LISTING_URL if start_page <= 1 else f"{LISTING_URL}page/{start_page}/"
    first_html = fetch_html(session, first_url)
    if not first_html:
        return
    soup = BeautifulSoup(first_html, "html.parser")
    max_page = find_max_page(soup)

    if end_page is None or end_page > max_page:
        end_page = max_page

    # Yield first page
    yield (start_page, first_html)

    # Remaining pages
    for p in range(start_page + 1, (end_page or 1) + 1):
        url = f"{LISTING_URL}page/{p}/"
        html = fetch_html(session, url)
        if html:
            yield (p, html)


def save_jsonl(path: str, rows: Iterable[Recipe]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            obj = asdict(r)
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def save_csv(path: str, rows: Iterable[Recipe]) -> None:
    rows = list(rows)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["url", "title", "year", "settlement", "ingredients"])
        for r in rows:
            w.writerow([
                r.url,
                r.title,
                r.year if r.year is not None else "",
                r.settlement or "",
                " | ".join(r.ingredients or []),
            ])


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Ízőrzők receptek scraper")
    parser.add_argument("--start-page", type=int, default=1, help="Kezdő oldalszám")
    parser.add_argument("--end-page", type=int, default=None, help="Utolsó oldalszám (auto, ha nincs megadva)")
    parser.add_argument("--delay", type=float, default=0.8, help="Késleltetés kérések között (másodperc)")
    parser.add_argument("--retries", type=int, default=3, help="Újrapróbálkozások száma")
    parser.add_argument("--out-json", type=str, default="receptek.jsonl", help="JSONL kimeneti fájl")
    parser.add_argument("--out-csv", type=str, default="receptek.csv", help="CSV kimeneti fájl")
    parser.add_argument(
        "--settlement-list",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "telepulesek_lista.txt"),
        help="Településnév-lista (egyezéshez)",
    )
    args = parser.parse_args(argv)

    settlements = read_settlements(args.settlement_list)
    session = make_session()

    all_links: List[str] = []
    print(f"Listing beolvasása: {LISTING_URL}")
    for page_num, html in iter_listing_pages(session, args.start_page, args.end_page):
        print(f"- Oldal #{page_num} feldolgozása…")
        links = parse_listing_links(html)
        print(f"  Talált linkek: {len(links)}")
        all_links.extend(links)
        time.sleep(args.delay)

    # Deduplicate while preserving order
    all_links = unique(all_links)
    print(f"Összes egyedi recept link: {len(all_links)}")

    recipes: List[Recipe] = []
    for i, url in enumerate(all_links, 1):
        print(f"[{i}/{len(all_links)}] Recept: {url}")
        recipe = parse_recipe(session, url, settlements, delay=args.delay)
        if recipe:
            recipes.append(recipe)

    # Mentés
    if args.out_json:
        save_jsonl(args.out_json, recipes)
        print(f"JSONL mentve: {args.out_json}")
    if args.out_csv:
        save_csv(args.out_csv, recipes)
        print(f"CSV mentve: {args.out_csv}")

    print("Kész.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Megszakítva.")
        raise


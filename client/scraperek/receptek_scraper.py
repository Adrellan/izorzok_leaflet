import argparse
import csv
import json
from urllib.parse import urlsplit
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


def normalize_spaces(s: str) -> str:
    """Collapse all whitespace to single spaces and trim."""
    return re.sub(r"\s+", " ", (s or "").strip())


def read_settlements(file_path: str) -> List[str]:
    settlements: List[str] = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                name = line.strip()
                if not name:
                    continue
                # Remove seasonal/holiday suffixes like " â€“ KarĂˇcsony"
                name = re.sub(r"\s+â€“\s+.*$", "", name)
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
    category_id: Optional[int] = None


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
    """Extract only recipe permalinks from the main listing content area.

    Avoids sidebars/related posts by limiting to `article` entries and
    `entry-title` links in the main content container.
    """
    soup = BeautifulSoup(html, "html.parser")
    links: List[str] = []

    container = soup.select_one("main, .site-main, #main, .content-area, .primary, #content, .archive") or soup

    def to_absolute(href: str) -> Optional[str]:
        if not href or href.startswith("#"):
            return None
        if href.startswith("/"):
            return BASE_URL + href
        if href.startswith(BASE_URL):
            return href
        return None

    def looks_like_post(href: str) -> bool:
        if any(seg in href for seg in ["/kategoria/", "/cimke/", "/tag/", "/kategoriak/"]):
            return False
        parts = urlsplit(href)
        # Accept simple `/{slug}/` pattern (1 non-empty segment)
        segs = [s for s in parts.path.split("/") if s]
        return len(segs) == 1

    # Primary: h2.entry-title a within article in container
    for article in container.select("article"):
        a = article.select_one("h2.entry-title a[href], .entry-title a[href], a[rel='bookmark']")
        if not a:
            continue
        href_abs = to_absolute(a.get("href"))
        if not href_abs:
            continue
        if looks_like_post(href_abs):
            links.append(href_abs)

    # Fallback: global titles if nothing found
    if not links:
        for a in soup.select("h2.entry-title a[href]"):
            href_abs = to_absolute(a.get("href"))
            if href_abs and looks_like_post(href_abs):
                links.append(href_abs)

    return unique(links)


def _parse_ingredients_from_text(text: str) -> List[str]:
    """Extract ingredients from a single paragraph that contains a label like 'HozzĂˇvalĂłk:'.

    Strategy:
    - Find the label (accent tolerant) and take the substring after it.
    - Prefer splitting by list-like separators; otherwise split by periods into groups.
    """
    if not text:
        return []
    # Match 'HozzĂˇvalĂłk' with accent tolerance
    m = re.search(r"(?i)Hozz[aĂˇ]val[oĂł]k\s*[:ďĽš]?", text)
    if not m:
        return []
    tail = text[m.end():].strip()
    if not tail:
        return []
    # Prefer to keep the entire tail as a single item unless clear separators exist.
    if "\n" in tail or "â€˘" in tail or ";" in tail:
        parts = re.split(r"\n+|â€˘|;", tail)
    else:
        parts = [tail]
    def _clean_labels(s: str) -> str:
        # Remove label segments ending with ':'; cut from previous '.' or ',' (if any) to ':'
        t = s
        while True:
            idx = t.find(":")
            if idx == -1:
                break
            # closest preceding '.' or ',' before ':'
            dot = t.rfind(".", 0, idx)
            comma = t.rfind(",", 0, idx)
            cut_from = max(dot, comma)
            if cut_from == -1:
                # remove from start to colon
                t = t[idx + 1 :]
            else:
                t = t[: cut_from + 1] + t[idx + 1 :]
        # Remove any parenthetical remarks like (1 nagyobb tepsihez)
        # Repeat to handle multiple occurrences
        prev = None
        while prev != t:
            prev = t
            t = re.sub(r"\([^()]*\)", "", t)
        # collapse spaces and trim leftover separators
        t = re.sub(r"\s+", " ", t).strip()
        t = t.strip(" ;|Â·â€˘")
        return t

    items: List[str] = []
    for part in parts:
        p = clean_text(part)
        p = _clean_labels(p)
        p = normalize_spaces(p)
        if not p:
            continue
        # Avoid capturing typical instruction openers if they slip in
        if re.match(r"(?i)A\s+s[uĂĽ]t[eĂ©]s|Elk[eĂ©]sz[iĂ­]t", p):
            continue
        items.append(p)
    # Ensure stable single-spacing of every item
    return [normalize_spaces(x) for x in items]


def _parse_ingredients_from_text_v2(text: str) -> List[str]:
    """Improved, accent-insensitive ingredient extraction from a single paragraph.

    - Detects the 'Hozzávalók' label by normalizing accents and case.
    - Uses the first delimiter (:, –, —, -) after the label to separate the tail.
    - Splits primarily on newlines/bullets/; otherwise on commas.
    - Removes nested sub-labels like 'A pácoláshoz:'.
    """
    if not text:
        return []

    norm = normalize_text(text)
    label = "hozzavalok"
    start_idx: Optional[int] = None
    for i in range(len(text)):
        if normalize_text(text[i : i + len(label)]) == label:
            start_idx = i
            break
    if start_idx is None and label not in norm:
        return []

    search_from = start_idx or 0
    tail = text[search_from:]
    m_delim = re.search(r"[:\-–—]", tail)
    if m_delim:
        tail = tail[m_delim.end():].strip()
    else:
        tail = text[search_from + (len(label) if start_idx is not None else 0):].strip()

    if not tail:
        return []

    if re.search(r"\n|\u2022|\u00B7|;|\|", tail):
        parts = re.split(r"\n+|\u2022|\u00B7|;|\|", tail)
    else:
        # Split by comma, or by a period that is likely to end a sentence
        # (i.e. followed by optional space and a capital letter).
        parts = re.split(r",|\.(?=\s*[A-ZÁÉÍÓÖŐÚÜŰ])", tail)

    def _clean_labels_v2(s: str) -> str:
        t = s
        prev = None
        while prev != t:
            prev = t
            t = re.sub(r"(^|[\s,.;])[^:]{1,40}?:\s*", r"\1", t)
        t = re.sub(r"\([^()]*\)", "", t)
        t = re.sub(r"\s+", " ", t).strip()
        t = t.strip(" ;|,")
        return t

    items: List[str] = []
    for part in parts:
        p = normalize_spaces(_clean_labels_v2(part))
        if not p:
            continue
        if re.match(r"(?i)^(a\s+f[oő]z[eé]s|elk[eé]sz[ií]t[eé]s)", p):
            continue
        items.append(p)

    return [normalize_spaces(x) for x in items if x]


def find_text_block_after_heading(content_root: Tag, heading_keywords: List[str]) -> List[str]:
    """Find ingredients near a heading/label matching keywords, including the same paragraph.

    - If the matched element itself contains 'HozzĂˇvalĂłk', extract from it.
    - Else, collect list items or paragraphs from following siblings until next heading.
    """
    norm_keys = [normalize_text(k) for k in heading_keywords]
    # Look for headings h1-h6 and strong labels
    candidates = content_root.select("h1, h2, h3, h4, h5, h6, strong, b, p")
    for el in candidates:
        text = normalize_text(el.get_text(" ", strip=True))
        if any(k in text for k in norm_keys):
            # First, try to parse ingredients from the same element (paragraph label case)
            same_text = el.get_text(" ", strip=True)
            items = _parse_ingredients_from_text_v2(same_text) or _parse_ingredients_from_text(same_text)
            if items:
                return [i for i in (t.strip("-â€˘ ") for t in items) if i]

            # Otherwise, gather subsequent sibling content until next heading
            items = []
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
                    # If the following paragraph itself contains the label, use that paragraph only
                    parsed_here = _parse_ingredients_from_text_v2(raw) or _parse_ingredients_from_text(raw)
                    if parsed_here:
                        return [i for i in parsed_here if i]
                    # Heuristic split: newlines / semicolons / commas / sentence-ending periods
                    parts = re.split(r"\n+|;|,|\.(?=\s*[A-ZÁÉÍÓÖŐÚÜŰ])", raw)
                    for part in parts:
                        txt = clean_text(part)
                        # Filter non-ingredient-ish fragments
                        if len(txt) > 2:
                            items.append(txt)
                if items:
                    # Stop once we collected some items from the immediate block
                    break
            return [i for i in (t.strip("-â€˘ ") for t in items) if i]
    return []


def _is_italic(el: Tag) -> bool:
    if el.name in {"em", "i"}:
        return True
    cls = " ".join(el.get("class", [])).lower()
    if "italic" in cls or "emphasis" in cls:
        return True
    style = (el.get("style") or "").lower()
    if "font-style: italic" in style:
        return True
    return False


def find_ingredients_by_italics(content_root: Tag) -> List[str]:
    """Prefer ingredients contained in an italic paragraph or inline block.

    The site often formats the whole 'HozzĂˇvalĂłk: â€¦' as italics. We
    look for italic elements containing the label and parse from there.
    """
    # 1) Direct italic elements
    for el in content_root.select("em, i, span, p"):
        try:
            if not _is_italic(el):
                continue
        except Exception:
            continue
        text = clean_text(el.get_text(" ", strip=True))
        if not text:
            continue
        items = _parse_ingredients_from_text_v2(text) or _parse_ingredients_from_text(text)
        if items:
            return [i for i in (t.strip("-â€˘ ") for t in items) if i]
    # 2) Paragraphs that contain an italic child with the label
    for p in content_root.select("p"):
        it = p.find(["em", "i"]) or p
        text = clean_text(p.get_text(" ", strip=True))
        items = _parse_ingredients_from_text_v2(text) or _parse_ingredients_from_text(text)
        if items:
            return [i for i in (t.strip("-â€˘ ") for t in items) if i]
    return []


def extract_year(soup: BeautifulSoup, content_root: Optional[Tag]) -> Optional[int]:
    # 1) Look for explicit labels: Ă‰v: 2021
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
    m = re.search(r"(?i)(?:Ă©v|dĂˇtum)\s*[:â€“-]?\s*(20\d{2}|19\d{2})", blob)
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


CATEGORY_ID_BY_NAME = {
    1: 'Eloetelek, levesek',
    2: 'Konnyu etelek',
    3: 'Haletelek',
    4: 'Szarnyas etelek',
    5: 'Serteshus etelek',
    6: 'Egyeb husetelek',
    7: 'Koretek',
    8: 'Sos etelek',
    9: 'Sos tesztak',
    10: 'Kukoricas etelek',
    11: 'Edes tesztak',
    12: 'Retesek, belesek',
    13: 'Sutemenyek, tortak',
}

_CATEGORY_NAME_TO_ID_NORM: Dict[str, int] = { normalize_text(v): k for k, v in CATEGORY_ID_BY_NAME.items() }


def extract_category_id(soup: BeautifulSoup) -> Optional[int]:
    texts: List[str] = []
    hrefs: List[str] = []
    for a in soup.select("nav.breadcrumbs a, .cat-links a, a[rel='category tag'], .categories a, .category a, .tags-links a"):
        txt = clean_text(a.get_text(" ", strip=True))
        href = a.get("href") or ""
        if txt:
            texts.append(txt)
        if href:
            hrefs.append(href)
    for h in hrefs:
        try:
            path = (urlsplit(h).path or "").strip('/').lower()
        except Exception:
            path = h.lower()
        slug_map = {
            'elotelek-levesek': 1,
            'konnyu-etelek': 2,
            'haletelek': 3,
            'szarnyas-etelek': 4,
            'sertes': 5,
            'egyeb-husetelek': 6,
            'koretek': 7,
            'sos-etelek': 8,
            'sos-tesztak': 9,
            'kukoricas-etelek': 10,
            'edes-tesztak': 11,
            'retesek-belesek': 12,
            'sutemenyek-tortak': 13,
        }
        for frag, cid in slug_map.items():
            if frag in path:
                return cid
    for t in texts:
        nt = normalize_text(t)
        norm_map = { normalize_text(v): k for k, v in CATEGORY_ID_BY_NAME.items() }
        if nt in norm_map:
            return norm_map[nt]
    for t in texts:
        nt = normalize_text(t)
        for key, cid in { normalize_text(v): k for k, v in CATEGORY_ID_BY_NAME.items() }.items():
            if key in nt or nt in key:
                return cid
    for meta in soup.select('.entry-meta, .post-meta, .postinfo, .post-info, .meta, .entry-footer, .entry-taxonomies'):
        raw = clean_text(meta.get_text(' ', strip=True))
        if not raw:
            continue
        for part in [p.strip() for p in raw.split(',') if p.strip()]:
            nt = normalize_text(part)
            for key, cid in { normalize_text(v): k for k, v in CATEGORY_ID_BY_NAME.items() }.items():
                if key in nt or nt in key:
                    return cid
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

    # Ingredients: prefer italic paragraph with 'HozzĂˇvalĂłk', then fallback to heading-based
    ingredients = find_ingredients_by_italics(content_root or soup)
    if not ingredients:
        ingredients = find_text_block_after_heading(
            content_root or soup, ["Hozzávalók", "Hozzavalok", "Hozzávalók"]
        )

    # Year
    year = extract_year(soup, content_root)

    # Settlement
    settlement = extract_settlement(soup, content_root, settlements)
    # Category
    category_id = extract_category_id(soup)

    time.sleep(delay)
    return Recipe(url=url, title=title, year=year, settlement=settlement, ingredients=ingredients, category_id=category_id)


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
        w.writerow(["url", "title", "year", "settlement", "ingredients", "category_id"])
        for r in rows:
            ingredients_str = normalize_spaces(" | ".join((r.ingredients or [])))
            w.writerow([
                normalize_spaces(r.url),
                normalize_spaces(r.title),
                r.year if r.year is not None else "",
                normalize_spaces(r.settlement or ""),
                ingredients_str,
                r.category_id if r.category_id is not None else "",
            ])


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Ízőrző receptek scraper")
    parser.add_argument("--start-page", type=int, default=1, help="Kezdő oldalszám")
    parser.add_argument("--end-page", type=int, default=None, help="Utolsó oldalszám (auto, ha nincs megadva)")
    parser.add_argument("--delay", type=float, default=0.8, help="Késleltetés kérdések között (másodperc)")
    parser.add_argument("--retries", type=int, default=3, help="Újrapróbálkozások száma")
    parser.add_argument("--out-json", type=str, default="receptek.jsonl", help="JSONL kimeneti fájl")
    parser.add_argument("--out-csv", type=str, default="receptek.csv", help="CSV kimeneti fájl")
    parser.add_argument("--single-url", type=str, default=None, help="Csak egy megadott recept URL feldolgozása")
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
    if args.single_url:
        all_links = [args.single_url]
        print(f"Egyetlen recept feldolgozása: {args.single_url}")
    else:
        print(f"Listing beolvasása: {LISTING_URL}")
        # fasz
        for page_num, html in iter_listing_pages(session, args.start_page, args.end_page):
            print(f"- Oldal #{page_num} feldolgozása...")
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

    # MentĂ©s
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

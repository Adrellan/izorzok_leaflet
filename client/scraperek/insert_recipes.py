import argparse
import csv
import json
import os
from typing import Iterable, List, Optional, Tuple

import psycopg2
import psycopg2.extras


def normalize_spaces(s: str) -> str:
    import re
    return re.sub(r"\s+", " ", (s or "").strip())


def read_csv(path: str) -> Iterable[Tuple[str, str, Optional[int], Optional[str], str]]:
    with open(path, "r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            url = normalize_spaces(row.get("url", ""))
            title = normalize_spaces(row.get("title", ""))
            year = row.get("year")
            year = int(year) if str(year).strip().isdigit() else None
            settlement = normalize_spaces(row.get("settlement", "") or "")
            ingredients = normalize_spaces(row.get("ingredients", ""))
            yield url, title, year, settlement or None, ingredients


def read_jsonl(path: str) -> Iterable[Tuple[str, str, Optional[int], Optional[str], str]]:
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            obj = json.loads(line)
            url = normalize_spaces(obj.get("url", ""))
            title = normalize_spaces(obj.get("title", ""))
            year = obj.get("year")
            year = int(year) if year is not None else None
            settlement = normalize_spaces(obj.get("settlement", "") or "") or None
            ingredients = normalize_spaces(" | ".join(obj.get("ingredients", [])))
            yield url, title, year, settlement, ingredients


def connect_pg(dsn: Optional[str], host: Optional[str], port: Optional[int], db: Optional[str], user: Optional[str], password: Optional[str]):
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host=host or os.getenv("PGHOST", "localhost"),
        port=port or int(os.getenv("PGPORT", "5469")),
        dbname=db or os.getenv("PGDATABASE"),
        user=user or os.getenv("PGUSER"),
        password=password or os.getenv("PGPASSWORD"),
    )


def ensure_schema(cur, schema_sql_path: str):
    with open(schema_sql_path, "r", encoding="utf-8") as f:
        cur.execute(f.read())


def lookup_settlement_id(cur, name: Optional[str]) -> Optional[int]:
    if not name:
        return None
    cur.execute('SELECT id FROM public."Settlement" WHERE name = %s LIMIT 1', (name,))
    row = cur.fetchone()
    if row:
        return int(row[0])
    # Fallback: ILIKE exact
    cur.execute('SELECT id FROM public."Settlement" WHERE name ILIKE %s LIMIT 1', (name,))
    row = cur.fetchone()
    return int(row[0]) if row else None


def load_st_model(model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name)


def embed_st(model, text: str) -> List[float]:
    import numpy as np
    vec = model.encode([text], normalize_embeddings=True)[0]
    return vec.astype(float).tolist()


def to_pgvector_literal(vec: List[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Load scraped recipes into Postgres + pgvector")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--csv", type=str, help="Path to receptek.csv")
    src.add_argument("--jsonl", type=str, help="Path to receptek.jsonl")
    p.add_argument("--init-schema", action="store_true", help="Create/ensure schema (uses scraperek/db_schema.sql)")
    p.add_argument("--dsn", type=str, default=None, help="Postgres DSN string")
    p.add_argument("--host", type=str, default=None)
    p.add_argument("--port", type=int, default=None)
    p.add_argument("--db", type=str, default=None)
    p.add_argument("--user", type=str, default=None)
    p.add_argument("--password", type=str, default=None)
    p.add_argument("--embed", choices=["none", "st"], default="st", help="Embedding method: none or sentence-transformers")
    p.add_argument("--st-model", type=str, default="sentence-transformers/all-MiniLM-L6-v2")
    args = p.parse_args(argv)

    rows_iter = read_csv(args.csv) if args.csv else read_jsonl(args.jsonl)

    conn = connect_pg(args.dsn, args.host, args.port, args.db, args.user, args.password)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            if args.init_schema:
                schema_sql = os.path.join(os.path.dirname(__file__), "db_schema.sql")
                ensure_schema(cur, schema_sql)
                conn.commit()

        st_model = None
        if args.embed == "st":
            st_model = load_st_model(args.st_model)

        with conn.cursor() as cur:
            for (url, title, year, settlement_name, ingredients_text) in rows_iter:
                # Lookup settlement_id by name
                settlement_id = lookup_settlement_id(cur, settlement_name)

                cur.execute(
                    'INSERT INTO public."Recipe" (url, title, year, settlement_id, settlement_name, ingredients_text)\n'
                    'VALUES (%s, %s, %s, %s, %s, %s)\n'
                    'ON CONFLICT (url) DO UPDATE SET\n'
                    '  title = EXCLUDED.title,\n'
                    '  year = EXCLUDED.year,\n'
                    '  settlement_id = EXCLUDED.settlement_id,\n'
                    '  settlement_name = EXCLUDED.settlement_name,\n'
                    '  ingredients_text = EXCLUDED.ingredients_text\n'
                    'RETURNING id',
                    (url, title, year, settlement_id, settlement_name, ingredients_text),
                )
                recipe_id = cur.fetchone()[0]

                if args.embed != "none":
                    text_for_embed = normalize_spaces(f"{title}. {ingredients_text}")
                    vec = embed_st(st_model, text_for_embed)
                    literal = to_pgvector_literal(vec)
                    cur.execute(
                        'INSERT INTO public."RecipeEmbedding" (recipe_id, model, dim, embedding)\n'
                        'VALUES (%s, %s, %s, %s::vector)\n'
                        'ON CONFLICT (recipe_id) DO UPDATE SET\n'
                        '  model = EXCLUDED.model,\n'
                        '  dim = EXCLUDED.dim,\n'
                        '  embedding = EXCLUDED.embedding',
                        (recipe_id, args.st_model, 384, literal),
                    )

        conn.commit()
        print("Insert kész.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

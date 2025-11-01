-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Core recipes table
CREATE TABLE IF NOT EXISTS public."Recipe" (
  id                BIGSERIAL PRIMARY KEY,
  url               TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  year              INT,
  settlement_id     BIGINT REFERENCES public."Settlement"(id),
  settlement_name   TEXT,
  ingredients_text  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Embedding table: choose 384 dims (all-MiniLM-L6-v2)
-- If you want a different model later, create another table/column with its dim.
CREATE TABLE IF NOT EXISTS public."RecipeEmbedding" (
  recipe_id  BIGINT PRIMARY KEY REFERENCES public."Recipe"(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,
  dim        INT NOT NULL CHECK (dim = 384),
  embedding  VECTOR(384) NOT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS recipe_year_idx ON public."Recipe"(year);

-- pgvector ANN index (requires setting ivfflat lists at session or here)
CREATE INDEX IF NOT EXISTS recipe_embedding_ivfflat_idx
  ON public."RecipeEmbedding" USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);


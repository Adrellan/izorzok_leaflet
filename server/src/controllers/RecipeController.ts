import { Router } from 'express';
import { getDataSource } from '../config/db';
import { Recipe } from '../entities/entities/Recipe';
import { Category } from '../entities/entities/Category';

export const RecipeController = Router();

// GET /api/recipes
// Optional query params:
//  - year: number
//  - settlementId: number
//  - categoryId: number
// Returns: { count: number, items: Array<{ url, title, year, settlement_id, category_id }> }
RecipeController.get('/', async (req, res) => {
  try {
    const ds = await getDataSource();

    const toNumArray = (v: string | string[] | undefined): number[] => {
      const parts = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(parts
        .flatMap((s) => String(s).split(','))
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n)) as number[]));
    };

    const years = toNumArray(req.query.year as any);
    const settlementIds = toNumArray(((req.query as any).settlementId ?? (req.query as any).settlement_id) as any);
    const categoryIds = toNumArray(((req.query as any).categoryId ?? (req.query as any).category_id) as any);

    const qb = ds
      .getRepository(Recipe)
      .createQueryBuilder('r')
      .select('r.url', 'url')
      .addSelect('r.title', 'title')
      .addSelect('r.year', 'year')
      .addSelect('r.category_id', 'category_id')
      .addSelect('r.settlement_id', 'settlement_id');

    if (years.length > 0) {
      qb.andWhere('r.year IN (:...years)', { years });
    }
    if (settlementIds.length > 0) {
      qb.andWhere('r.settlement_id IN (:...settlementIds)', { settlementIds });
    }
    if (categoryIds.length > 0) {
      qb.andWhere('r.category_id IN (:...categoryIds)', { categoryIds });
    }

    // Build a separate count query with identical filters
    const countQb = ds
      .getRepository(Recipe)
      .createQueryBuilder('r');
    if (years.length > 0) {
      countQb.andWhere('r.year IN (:...years)', { years });
    }
    if (settlementIds.length > 0) {
      countQb.andWhere('r.settlement_id IN (:...settlementIds)', { settlementIds });
    }
    if (categoryIds.length > 0) {
      countQb.andWhere('r.category_id IN (:...categoryIds)', { categoryIds });
    }

    const [rows, count] = await Promise.all([
      qb.getRawMany<{
        url: string;
        title: string;
        year: number | null;
        settlement_id: number | null;
        category_id: number | null;
      }>(),
      countQb.getCount(),
    ]);

    res.setHeader('X-Total-Count', String(count));
    res.json({ count, items: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// GET /api/recipes/categories
// Returns: Array<{ id, name }>
RecipeController.get('/categories', async (_req, res) => {
  try {
    const ds = await getDataSource();
    const rows = await ds
      .getRepository(Category)
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .orderBy('c.name', 'ASC')
      .getRawMany<{ id: number; name: string | null }>();

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

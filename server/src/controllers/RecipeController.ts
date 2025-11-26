import { Router } from 'express';
import { getDataSource } from '../config/db';
import { Recipe } from '../entities/entities/Recipe';
import { Settlement } from '../entities/entities/Settlement';
import { Category } from '../entities/entities/Category';

export const RecipeController = Router();

// GET /api/recipes
// Optional query params:
//  - year: number
//  - settlementId: number
//  - categoryId: number
//  - regionId: number
//  - ingredients: string[] (komma-szeparált vagy többször megadva)
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

    const toStrArray = (v: string | string[] | undefined): string[] => {
      const parts = Array.isArray(v) ? v : v ? [v] : [];
      return Array.from(new Set(parts
        .flatMap((s) => String(s).split(','))
        .map((s) => s.trim())
        .filter((s) => s.length > 0)));
    };

    const years = toNumArray(req.query.year as any);
    let settlementIds = toNumArray(((req.query as any).settlementId ?? (req.query as any).settlement_id) as any);
    const categoryIds = toNumArray(((req.query as any).categoryId ?? (req.query as any).category_id) as any);
    const regionIds = toNumArray(((req.query as any).regionId ?? (req.query as any).region_id) as any);
    const ingredients = toStrArray((req.query as any).ingredients as any);
    const reverseRaw = (req.query as any).reverse;
    const reverse =
      typeof reverseRaw === 'string'
        ? reverseRaw
        : Array.isArray(reverseRaw)
        ? reverseRaw[0]
        : undefined;
    const isReverseIngredientsFilter = !!reverse && ['1', 'true', 'yes', 'on'].includes(reverse.toLowerCase());
    const hadExplicitSettlementFilter = settlementIds.length > 0;
    let appliedRegionExpansion = false;

    // If region filter present, expand it to settlement IDs and merge with explicit settlement filter
    if (!hadExplicitSettlementFilter && regionIds.length > 0) {
      const srows = await ds
        .getRepository(Settlement)
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .where('s.regionid IN (:...regionIds)', { regionIds })
        .getRawMany<{ id: number }>();
      const regionSettlementIds = Array.from(new Set(srows.map((r) => r.id)));
      if (regionSettlementIds.length > 0) {
        settlementIds = Array.from(new Set([...(settlementIds ?? []), ...regionSettlementIds]));
      } else {
        // No settlements found for given regions -> force empty result
        settlementIds = [];
      }
      appliedRegionExpansion = true;
    }

    const qb = ds
      .getRepository(Recipe)
      .createQueryBuilder('r')
      .select('r.url', 'url')
      .addSelect('r.title', 'title')
      .addSelect('r.year', 'year')
      .addSelect('r.ingredients_text', 'ingredients_text')
      .addSelect('r.category_id', 'category_id')
      .addSelect('r.settlement_id', 'settlement_id');

    if (years.length > 0) {
      qb.andWhere('r.year IN (:...years)', { years });
    }
    // If only region filter was provided and it produced no settlements, force empty
    if (appliedRegionExpansion && settlementIds.length === 0) {
      qb.andWhere('1 = 0');
    }
    if (settlementIds.length > 0) {
      qb.andWhere('r.settlement_id IN (:...settlementIds)', { settlementIds });
    }
    if (categoryIds.length > 0) {
      qb.andWhere('r.category_id IN (:...categoryIds)', { categoryIds });
    }

    if (ingredients.length > 0) {
      ingredients.forEach((term, idx) => {
        const key = `ing${idx}`;
        if (isReverseIngredientsFilter) {
          qb.andWhere(`r.ingredients_text NOT ILIKE :${key}`, { [key]: `%${term}%` });
        } else {
          qb.andWhere(`r.ingredients_text ILIKE :${key}`, { [key]: `%${term}%` });
        }
      });
    }

    // Build a separate count query with identical filters
    const countQb = ds
      .getRepository(Recipe)
      .createQueryBuilder('r');
    if (years.length > 0) {
      countQb.andWhere('r.year IN (:...years)', { years });
    }
    if (appliedRegionExpansion && settlementIds.length === 0) {
      countQb.andWhere('1 = 0');
    }
    if (settlementIds.length > 0) {
      countQb.andWhere('r.settlement_id IN (:...settlementIds)', { settlementIds });
    }
    if (categoryIds.length > 0) {
      countQb.andWhere('r.category_id IN (:...categoryIds)', { categoryIds });
    }
    if (ingredients.length > 0) {
      ingredients.forEach((term, idx) => {
        const key = `ing${idx}`;
        if (isReverseIngredientsFilter) {
          countQb.andWhere(`r.ingredients_text NOT ILIKE :${key}`, { [key]: `%${term}%` });
        } else {
          countQb.andWhere(`r.ingredients_text ILIKE :${key}`, { [key]: `%${term}%` });
        }
      });
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

    // Build region_counts by mapping settlement_id -> regionid, then aggregating
    const settlementIdsForCount = Array.from(
      new Set(
        (rows || [])
          .map((r) => (r && r.settlement_id != null ? Number(r.settlement_id) : NaN))
          .filter((n) => Number.isFinite(n)) as number[]
      )
    );

    let regionCounts: Record<string, number> = {};
    if (settlementIdsForCount.length > 0) {
      const srows = await ds
        .getRepository(Settlement)
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .addSelect('s.regionid', 'regionid')
        .where('s.id IN (:...ids)', { ids: settlementIdsForCount })
        .getRawMany<{ id: number; regionid: number | null }>();

      const idToRegion = new Map<number, number | null>(srows.map((r) => [r.id, r.regionid] as const));

      const agg: Record<string, number> = {};
      for (const row of rows) {
        const sid = row.settlement_id;
        if (sid == null) continue;
        const rid = idToRegion.get(Number(sid));
        if (rid == null || !Number.isFinite(rid)) continue;
        const key = String(rid);
        agg[key] = (agg[key] ?? 0) + 1;
      }
      regionCounts = agg;
    }

    res.setHeader('X-Total-Count', String(count));
    res.json({ count, items: rows, region_counts: regionCounts });
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

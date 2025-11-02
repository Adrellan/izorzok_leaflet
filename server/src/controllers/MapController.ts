import { Router } from 'express';
import { getDataSource } from '../config/db';
import { Region } from '../entities/entities/Region';
import { Settlement } from '../entities/entities/Settlement';

export const MapController = Router();

// List regions with geometry as GeoJSON (geom)
MapController.get('/regions', async (req, res) => {
  try {
    const ds = await getDataSource();
    // Optional filter: regionId can be provided multiple times (?regionId=1&regionId=2)
    // or as comma-separated values ("1,2,3").
    const rawParam = req.query.regionId as undefined | string | string[];
    const rawList = Array.isArray(rawParam) ? rawParam : rawParam ? [rawParam] : [];
    const idList = Array.from(
      new Set(
        rawList
          .flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter((s) => s.length > 0)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n)) as number[]
      )
    );

    const qb = ds
      .getRepository(Region)
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .addSelect('r.name', 'name')
      .addSelect('ST_AsGeoJSON(r.geom)', 'geom')
      .orderBy('r.name', 'ASC');

    if (idList.length > 0) {
      qb.andWhere('r.id IN (:...ids)', { ids: idList });
    }

    const rows = await qb.getRawMany<{ id: number; name: string | null; geom: string | null }>();

    const regions = rows.map((r) => ({
      id: r.id,
      name: r.name,
      geom: r.geom ? JSON.parse(r.geom) : null,
    }));

    res.json(regions);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// List settlements with geometry as GeoJSON (geom)
MapController.get('/settlements', async (_req, res) => {
  try {
    const ds = await getDataSource();
    const rows = await ds
      .getRepository(Settlement)
      .createQueryBuilder('s')
      .select("s.id", 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.regionid', 'regionid')
      .addSelect('ST_AsGeoJSON(s.geom)', 'geom')
      .orderBy('s.name', 'ASC')
      .getRawMany<{ id: number; name: string | null; regionid: number | null; geom: string | null }>();

    const settlements = rows.map((r) => ({
      id: r.id,
      name: r.name,
      regionid: r.regionid,
      geom: r.geom ? JSON.parse(r.geom) : null,
    }));

    res.json(settlements);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

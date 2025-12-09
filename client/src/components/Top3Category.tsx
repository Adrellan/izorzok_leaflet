import React, { useMemo } from 'react';
import { Marker, Pane } from 'react-leaflet';
import L from 'leaflet';
import type {
  RegionWithGeom,
  SettlementWithGeom,
  RecipeListItem,
} from '../config/api/api';

type Props = {
  visible: boolean;
  regions: RegionWithGeom[];
  settlements: SettlementWithGeom[];
  settlementRecipes: Record<number, RecipeListItem[]>;
  categoryMap: Record<number, string>;
  zoom: number;
};

const computeCenter = (geom: any) => {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (
        node.length >= 2 &&
        typeof node[0] === 'number' &&
        typeof node[1] === 'number'
      ) {
        const [lng, lat] = node;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          sumLat += lat;
          sumLng += lng;
          count += 1;
        }
        return;
      }
      node.forEach(walk);
    }
  };

  walk(geom?.coordinates);
  if (count === 0) return null;
  return { lat: sumLat / count, lng: sumLng / count };
};

const Top3Category: React.FC<Props> = ({
  visible,
  regions,
  settlements,
  settlementRecipes,
  categoryMap,
  zoom,
}) => {
  // Scale cards/bars by zoom: smaller when zoomed out, larger when zoomed in
  const scale = Math.min(2.0, Math.max(0.45, 0.5 + (zoom - 6) * 0.16));
  const regionCenters = useMemo(() => {
    const centers = new Map<number, { lat: number; lng: number }>();
    (regions ?? []).forEach((r) => {
      if (typeof r.id !== 'number') return;
      const center = computeCenter((r as any)?.geom);
      if (center) {
        centers.set(r.id, center);
      }
    });
    return centers;
  }, [regions]);

  const settlementRegionMap = useMemo(() => {
    const map = new Map<number, number>();
    (settlements ?? []).forEach((s) => {
      if (typeof s.id !== 'number') return;
      const ridRaw = (s as any)?.regionid;
      const rid =
        typeof ridRaw === 'number'
          ? ridRaw
          : typeof ridRaw === 'string'
          ? Number(ridRaw)
          : NaN;
      if (Number.isFinite(rid)) {
        map.set(s.id, rid as number);
      }
    });
    return map;
  }, [settlements]);

  const regionCategoryCounts = useMemo(() => {
    const counts = new Map<number, Map<number, number>>();
    Object.entries(settlementRecipes || {}).forEach(([sidKey, recipes]) => {
      const sid = Number(sidKey);
      if (!Number.isFinite(sid)) return;
      const ridRaw = settlementRegionMap.get(sid);
      if (typeof ridRaw !== 'number' || !Number.isFinite(ridRaw)) return;
      const rid = ridRaw;
      const bucket = counts.get(rid) ?? new Map<number, number>();
      (recipes || []).forEach((rec) => {
        const raw = (rec as any)?.category_id;
        const cid =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
            ? Number(raw)
            : NaN;
        if (!Number.isFinite(cid)) return;
        bucket.set(cid, (bucket.get(cid) ?? 0) + 1);
      });
      counts.set(rid as number, bucket);
    });
    return counts;
  }, [settlementRecipes, settlementRegionMap]);

  const labelData = useMemo(() => {
    const list: {
      regionId: number;
      center: { lat: number; lng: number };
      items: { id: number; name: string; count: number }[];
    }[] = [];

    regionCenters.forEach((center, rid) => {
      const bucket = regionCategoryCounts.get(rid);
      if (!bucket || bucket.size === 0) return;
      const sorted = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
      const items = sorted.slice(0, 3).map(([cid, count]) => ({
        id: cid,
        name: categoryMap?.[cid] ?? `Kategória ${cid}`,
        count,
      }));
      list.push({ regionId: rid, center, items });
    });

    return list;
  }, [regionCenters, regionCategoryCounts, categoryMap]);

  if (!visible || labelData.length === 0) return null;

  return (
    <Pane name="top-categories" style={{ zIndex: 650 }}>
      {labelData.map((entry) => {
        const maxCount = Math.max(...entry.items.map((i) => i.count), 1);
        const colors = ['#38bdf8', '#a78bfa', '#f472b6'];
        const bars = entry.items.map((item, idx) => {
          const barHeight = Math.max(
            10 * scale,
            Math.round((item.count / maxCount) * (64 * scale))
          );
          const barWidth = Math.round(14 * scale);
          const displayName =
            item.name.length > 18 ? `${item.name.slice(0, 17)}…` : item.name;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:${4 * scale}px;min-width:0;">
            <div style="height:${barHeight}px;width:${barWidth}px;background:${colors[idx] ?? colors[0]};border-radius:${4 * scale}px ${4 * scale}px ${2 * scale}px ${2 * scale}px;box-shadow:0 2px 4px rgba(0,0,0,0.25);"></div>
            <div style="font-size:${9 * scale}px;color:#cbd5e1;max-width:${70 * scale}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform: rotate(-18deg);transform-origin:center top;line-height:1;opacity:0.95;margin-top:${2 * scale}px;" title="${item.name}">${displayName}</div>
            <div style="font-size:${10 * scale}px;color:#e2e8f0;">${item.count}</div>
          </div>`;
        });
        const maxBarHeight = Math.max(
          ...entry.items.map((i) =>
            Math.max(10 * scale, Math.round((i.count / maxCount) * (64 * scale)))
          ),
          10 * scale
        );
        const contentPadY = 8 * scale;
        const headerH = 16 * scale;
        const footerSpace = 20 * scale;
        const iconHeight = Math.max(
          70 * scale,
          maxBarHeight + contentPadY * 2 + headerH + footerSpace
        );
        const iconWidth = 200 * scale;
        return (
          <Marker
            key={`top3-${entry.regionId}`}
            position={[entry.center.lat, entry.center.lng]}
            interactive={false}
            pane="top-categories"
            icon={L.divIcon({
              className: '',
              html: `<div style="padding:${8 * scale}px ${10 * scale}px;background:rgba(15,23,42,0.92);color:#e2e8f0;border:1px solid #1f2937;border-radius:${10 * scale}px;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-size:${12 * scale}px;line-height:1.35;max-width:${iconWidth}px;backdrop-filter: blur(4px);">
                  <div style="font-weight:700;font-size:${12 * scale}px;margin-bottom:${6 * scale}px;">Top 3 kategória</div>
                  <div style="display:flex;gap:${10 * scale}px;align-items:flex-end;justify-content:space-between;">${bars.join(
                    ''
                  )}</div>
                </div>`,
              iconSize: [iconWidth, iconHeight],
              iconAnchor: [iconWidth / 2, Math.max(20 * scale, iconHeight / 2)],
            })}
          />
        );
      })}
    </Pane>
  );
};

export default Top3Category;

import React, { useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { useAppSelector } from '../../hooks/hooks';
import type { SettlementWithGeom, RecipeListItem } from '../../config/api/api';

type BucketId = 'min' | 'avg' | 'max';

type Bucket = {
  id: BucketId;
  label: string;
  ingredientCount: number;
  recipes: RecipeMatch[];
};

type RecipeMatch = {
  title: string;
  url?: string;
  year?: number | null;
  settlementName?: string | null;
  ingredientCount: number;
};

const BAD_INGREDIENT_DATA_URLS = new Set<string>([
  'https://www.izorzok.hu/zoldbableves-krumpligomboccal/',
  'https://www.izorzok.hu/klari-kulonleges-meggyes-retese/'
]);

const normalizeIngredient = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.includes('(') && !text.includes(')')) return '';
  text = text.replace(/[.,;:!?]+$/g, '').trim();
  const parts = text.split(/\s+/);
  if (!parts.length) return '';
  const last = parts[parts.length - 1] || '';
  const key = last.toLowerCase();
  if (!key || /^-?\d+([.,]\d+)?$/.test(key)) return '';
  return key;
};

const splitIngredientsText = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return String(text)
    .split('|')
    .map((p) => normalizeIngredient(p))
    .filter((p) => p.length > 0);
};

const MinMaxIngredientsChart: React.FC = () => {
  const settlements =
    useAppSelector((s) => (s.geo as any).settlements as SettlementWithGeom[] | undefined) ??
    [];
  const settlementRecipes =
    useAppSelector(
      (s) => (s.map as any).settlementRecipes as Record<number, RecipeListItem[]> | undefined,
    ) ?? {};
  const selectedRegionIds =
    useAppSelector((s) => (s.map as any).selectedRegionIds as number[] | undefined) ?? [];
  const selectedSettlementIds =
    useAppSelector((s) => (s.map as any).selectedSettlementIds as number[] | undefined) ?? [];

  const [selectedBucketId, setSelectedBucketId] = useState<BucketId | null>('avg');

  const buckets = useMemo<Bucket[]>(() => {
    if (!settlements.length) return [];

    const settlementById = new Map<number, SettlementWithGeom>();
    settlements.forEach((s) => {
      if (typeof s.id === 'number' && Number.isFinite(s.id)) {
        settlementById.set(s.id, s);
      }
    });

    const hasSelectedSettlements = selectedSettlementIds.length > 0;
    const selectedSettlementSet = hasSelectedSettlements
      ? new Set(selectedSettlementIds)
      : undefined;
    const hasSelectedRegions = selectedRegionIds.length > 0;
    const selectedRegionSet = hasSelectedRegions ? new Set(selectedRegionIds) : undefined;

    const recipesByCount = new Map<number, RecipeMatch[]>();
    let totalIngredientCount = 0;
    let totalRecipes = 0;

    for (const [sidKey, recipes] of Object.entries(settlementRecipes || {})) {
      const sid = Number(sidKey);
      if (!Number.isFinite(sid)) continue;

      const settlement = settlementById.get(sid);
      if (!settlement) continue;

      if (selectedSettlementSet && !selectedSettlementSet.has(sid)) continue;

      const regionId =
        typeof (settlement as any).regionid === 'number'
          ? (settlement as any).regionid
          : Number.NaN;
      if (selectedRegionSet && (!Number.isFinite(regionId) || !selectedRegionSet.has(regionId))) {
        continue;
      }

      for (const recipe of recipes || []) {
        const url = (recipe as any)?.url as string | undefined;
        if (url && BAD_INGREDIENT_DATA_URLS.has(url)) continue;

        const ingredientsText = (recipe as any)?.ingredients_text as string | undefined;
        const ingredients = splitIngredientsText(ingredientsText);
        const ingredientCount = ingredients.length;
        if (!ingredientCount) continue;

        totalIngredientCount += ingredientCount;
        totalRecipes += 1;

        let list = recipesByCount.get(ingredientCount);
        if (!list) {
          list = [];
          recipesByCount.set(ingredientCount, list);
        }
        list.push({
          title: (recipe as any)?.title ?? 'Ismeretlen recept',
          url: (recipe as any)?.url,
          year: (recipe as any)?.year ?? null,
          settlementName: settlement.name ?? null,
          ingredientCount,
        });
      }
    }

    if (!recipesByCount.size || totalRecipes === 0) return [];

    const distinctCounts = Array.from(recipesByCount.keys()).sort((a, b) => a - b);
    const minCount = distinctCounts[0];
    const maxCount = distinctCounts[distinctCounts.length - 1];
    const average = totalIngredientCount / totalRecipes;

    let avgCount = distinctCounts[0];
    let bestDist = Math.abs(avgCount - average);
    for (const c of distinctCounts) {
      const d = Math.abs(c - average);
      if (d < bestDist) {
        bestDist = d;
        avgCount = c;
      }
    }

    const buckets: Bucket[] = [
      {
        id: 'min',
        label: `Legkevesebb hozzávaló (${minCount})`,
        ingredientCount: minCount,
        recipes: recipesByCount.get(minCount) ?? [],
      },
      {
        id: 'avg',
        label: `Átlagos hozzávaló (${avgCount})`,
        ingredientCount: avgCount,
        recipes: recipesByCount.get(avgCount) ?? [],
      },
      {
        id: 'max',
        label: `Legtöbb hozzávaló (${maxCount})`,
        ingredientCount: maxCount,
        recipes: recipesByCount.get(maxCount) ?? [],
      },
    ];

    return buckets;
  }, [settlements, settlementRecipes, selectedRegionIds, selectedSettlementIds]);

  const selectedBucket =
    selectedBucketId != null
      ? buckets.find((b) => b.id === selectedBucketId) ?? buckets[1] ?? buckets[0]
      : buckets[1] ?? buckets[0];

  const ChartInner: React.FC<{ width: number; height: number }> = ({ width, height }) => {
    const [hoveredId, setHoveredId] = useState<BucketId | null>(null);
    const margin = { top: 24, right: 24, bottom: 40, left: 48 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    if (!buckets.length || xMax <= 0 || yMax <= 0) {
      return (
        <svg width={width} height={height}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={14}
          >
            Nincs adat a kiválasztott szűrők alapján.
          </text>
        </svg>
      );
    }

    const maxIngredientCount = Math.max(...buckets.map((b) => b.ingredientCount), 1);

    const x = scaleBand<BucketId>({
      domain: buckets.map((b) => b.id),
      range: [0, xMax],
      padding: 0.4,
    });

    const y = scaleLinear<number>({
      domain: [0, maxIngredientCount],
      range: [yMax, 0],
      nice: true,
    });

    const axisColor = '#94a3b8';

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {buckets.map((bucket) => {
            const xBand = x(bucket.id);
            if (xBand == null) return null;
            const value = bucket.ingredientCount;
            const yValue = y(value);
            const yZero = y(0);
            const barHeight = Math.max(0, (yZero ?? 0) - (yValue ?? 0));
            const barY = yValue ?? 0;
            const isHovered = hoveredId === bucket.id;
            const isSelected = selectedBucketId === bucket.id;
            const labelY = Math.max(12, Math.min((yZero ?? 0) - 8, (yValue ?? 0) - 8));
            const fillColor = isSelected ? '#f97316' : isHovered ? '#0ea5e9' : '#38bdf8';

            return (
              <Group key={bucket.id} left={xBand}>
                <Bar
                  x={0}
                  y={barY}
                  width={x.bandwidth()}
                  height={barHeight}
                  fill={fillColor}
                  tabIndex={0}
                  aria-label={`${bucket.label}, hozzávalók száma ${value}`}
                  onMouseEnter={() => setHoveredId(bucket.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(bucket.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() =>
                    setSelectedBucketId((prev) => (prev === bucket.id ? null : bucket.id))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedBucketId((prev) => (prev === bucket.id ? null : bucket.id));
                    }
                  }}
                />
                <text
                  x={x.bandwidth() / 2}
                  y={labelY}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={11}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {value}
                </text>
              </Group>
            );
          })}

          <AxisLeft
            scale={y}
            stroke={axisColor}
            tickStroke={axisColor}
            tickLabelProps={() => ({
              fill: '#e2e8f0',
              fontSize: 11,
              textAnchor: 'end',
              dx: -4,
            })}
          />

          <AxisBottom
            top={yMax}
            scale={x}
            stroke={axisColor}
            tickStroke={axisColor}
            tickFormat={(id: BucketId) => {
              if (id === 'min') return 'Legkevesebb';
              if (id === 'max') return 'Legtöbb';
              return 'Átlagos';
            }}
            tickLabelProps={() => ({
              fill: '#e2e8f0',
              fontSize: 11,
              textAnchor: 'middle',
              dy: 12,
            })}
          />
        </Group>
      </svg>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minHeight: 260 }}>
        <ParentSize>
          {({ width, height }) => (
            <ChartInner width={Math.max(480, width)} height={Math.max(260, height)} />
          )}
        </ParentSize>
      </div>
      <div
        style={{
          marginTop: 8,
          maxHeight: 180,
          overflowY: 'auto',
          background: '#020617',
          borderRadius: 8,
          border: '1px solid #1f2937',
          padding: '8px 12px',
        }}
      >
        {selectedBucket && selectedBucket.recipes.length > 0 ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                {selectedBucket.label}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                {selectedBucket.recipes.length} recept
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {selectedBucket.recipes.map((r, index) => (
                <li
                  key={`${selectedBucket.id}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={r.title}
                  >
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#38bdf8', textDecoration: 'none' }}
                      >
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </span>
                  <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {r.settlementName ?? ''}
                    {r.settlementName && r.year ? ' · ' : ''}
                    {r.year ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <span style={{ color: '#64748b', fontSize: 12 }}>
            Kattints egy oszlopra, hogy lásd a hozzá tartozó recepteket.
          </span>
        )}
      </div>
    </div>
  );
};

export default MinMaxIngredientsChart;

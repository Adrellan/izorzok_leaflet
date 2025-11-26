import React, { useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { Chips } from 'primereact/chips';
import { useAppSelector } from '../../hooks/hooks';
import type {
  RegionWithGeom,
  SettlementWithGeom,
  RecipeListItem,
} from '../../config/api/api';

type RegionTopIngredient = {
  regionId: number;
  regionName: string;
  ingredientName: string;
  count: number;
};

type PieSegment = {
  name: string;
  value: number;
};

const palette = [
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
  '#ec4899',
  '#8b5cf6',
  '#0f766e',
  '#facc15',
  '#7c3aed',
  '#ea580c',
  '#1d4ed8',
  '#16a34a',
  '#e11d48',
  '#0891b2',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
];

// Use the last "word" of the ingredient text as key.
// Examples:
//  "90 dkg liszt"            -> "liszt"
//  "a deszka szorásához liszt" -> "liszt"
//  "2 gerezd fokhagyma"     -> "fokhagyma"
//  "10 dkg ecetes uborka"   -> "uborka"
//  "rozmaring ág"           -> "rozmaring ág" (special case for "ág")
const normalizeIngredient = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Ignore ingredients that contain '(' but no matching ')'
  if (text.includes('(') && !text.includes(')')) return '';

  // Drop trailing basic punctuation
  text = text.replace(/[.,;:!?]+$/g, '').trim();

  const parts = text.split(/\s+/);
  if (!parts.length) return '';

  const letterClass = 'A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű';
  const leadingNonLetters = new RegExp(`^[^${letterClass}]+`);
  const trailingNonLetters = new RegExp(`[^${letterClass}]+$`);

  const cleanToken = (token: string): string =>
    token.replace(leadingNonLetters, '').replace(trailingNonLetters, '');

  const lastToken = cleanToken(parts[parts.length - 1] || '');
  const prevToken = parts.length >= 2 ? cleanToken(parts[parts.length - 2] || '') : '';

  let key = lastToken.toLowerCase();

  // If the last word is only "ág", treat as "<prev> ág"
  if ((key === 'ág' || key === 'alja' || key === 'bl' || key === 'alap' || key === 'fehérje' || 
    key === 'alaplé' || key === 'aroma' || key === 'befőtt') && parts.length >= 2) {
    key = `${prevToken.toLowerCase()} ${key}`;
  }

  if (!key || /^-?\d+([.,]\d+)?$/.test(key)) {
    return '';
  }

  return key;
};

const splitIngredientsText = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return String(text)
    .split('|')
    .map((p) => normalizeIngredient(p))
    .filter((p) => p.length > 0);
};

const RegionMostCommonIngredientChart: React.FC = () => {
  const regions =
    useAppSelector((s) => (s.geo as any).regions as RegionWithGeom[] | undefined) ?? [];
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
  const categoryMap =
    useAppSelector(
      (s) => (s.map as any).categoryMap as Record<number, string> | undefined,
    ) ?? {};

  const [showRarest, setShowRarest] = useState(false);
  const [hoveredIngredient, setHoveredIngredient] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);

  const categoryOptions = useMemo(
    () =>
      Object.entries(categoryMap)
        .map(([id, name]) => ({
          id: Number(id),
          label: name || `Kategoria ${id}`,
        }))
        .sort((a, b) =>
          a.label.localeCompare(b.label, 'hu-HU', { sensitivity: 'base' }),
        ),
    [categoryMap],
  );

  const { regionItems, pieSegments } = useMemo(() => {
    if (!regions.length || !settlements.length) {
      return { regionItems: [] as RegionTopIngredient[], pieSegments: [] as PieSegment[] };
    }

    const regionNameById = new Map<number, string>();
    regions.forEach((r) => {
      if (typeof r.id === 'number') {
        regionNameById.set(r.id, r.name ?? `Vármegye ${r.id}`);
      }
    });

    const settlementToRegion = new Map<number, { regionId: number; regionName: string }>();
    settlements.forEach((s) => {
      const sid = typeof s.id === 'number' ? s.id : NaN;
      const rid = typeof s.regionid === 'number' ? s.regionid : NaN;
      if (!Number.isFinite(sid) || !Number.isFinite(rid)) return;
      settlementToRegion.set(sid, {
        regionId: rid,
        regionName: regionNameById.get(rid) ?? `Vármegye ${rid}`,
      });
    });

    const regionBuckets = new Map<
      number,
      {
        name: string;
        ingredientCounts: Map<string, number>;
      }
    >();
    const globalCounts = new Map<string, number>();

    const excludedSet = new Set(
      excludedIngredients
        .map((name) => normalizeIngredient(name))
        .filter((name) => name.length > 0),
    );

    const hasSelectedSettlements = selectedSettlementIds.length > 0;
    const selectedSettlementSet = hasSelectedSettlements
      ? new Set(selectedSettlementIds)
      : undefined;
    const hasSelectedRegions = selectedRegionIds.length > 0;
    const selectedRegionSet = hasSelectedRegions ? new Set(selectedRegionIds) : undefined;

    for (const [sidKey, recipes] of Object.entries(settlementRecipes || {})) {
      const sid = Number(sidKey);
      if (!Number.isFinite(sid)) continue;
      if (selectedSettlementSet && !selectedSettlementSet.has(sid)) continue;
      const mapping = settlementToRegion.get(sid);
      if (!mapping) continue;
      if (selectedRegionSet && !selectedRegionSet.has(mapping.regionId)) continue;

      let bucket = regionBuckets.get(mapping.regionId);
      if (!bucket) {
        bucket = {
          name: mapping.regionName,
          ingredientCounts: new Map<string, number>(),
        };
        regionBuckets.set(mapping.regionId, bucket);
      }

      for (const recipe of recipes || []) {
        const catRaw = (recipe as any)?.category_id;
        const catId =
          typeof catRaw === 'number'
            ? catRaw
            : typeof catRaw === 'string'
            ? Number(catRaw)
            : NaN;
        if (selectedCategoryId != null && catId !== selectedCategoryId) {
          continue;
        }

        const ingredientsText = (recipe as any)?.ingredients_text as string | undefined;
        const ingredients = splitIngredientsText(ingredientsText);
        for (const ing of ingredients) {
          if (excludedSet.has(ing)) continue;
          const prevRegion = bucket.ingredientCounts.get(ing) ?? 0;
          bucket.ingredientCounts.set(ing, prevRegion + 1);
          const prevGlobal = globalCounts.get(ing) ?? 0;
          globalCounts.set(ing, prevGlobal + 1);
        }
      }
    }

    const sortDir = showRarest ? 1 : -1;

    const regionItems: RegionTopIngredient[] = Array.from(regionBuckets.entries())
      .map(([regionId, bucket]) => {
        if (bucket.ingredientCounts.size === 0) return null;
        const sortedIngredients = Array.from(bucket.ingredientCounts.entries()).sort(
          (a, b) => {
            if (a[1] === b[1]) {
              return a[0].localeCompare(b[0], 'hu-HU', { sensitivity: 'base' });
            }
            return sortDir * (a[1] - b[1]);
          },
        );
        const [ingredientName, count] = sortedIngredients[0];
        return {
          regionId,
          regionName: bucket.name,
          ingredientName,
          count,
        } as RegionTopIngredient;
      })
      .filter((x): x is RegionTopIngredient => !!x)
      .sort((a, b) => {
        if (a.count === b.count) {
          return a.regionName.localeCompare(b.regionName, 'hu-HU', {
            sensitivity: 'base',
          });
        }
        return sortDir * (a.count - b.count);
      });

    const pieSegments: PieSegment[] = Array.from(globalCounts.entries())
      .sort((a, b) => {
        if (a[1] === b[1]) {
          return a[0].localeCompare(b[0], 'hu-HU', { sensitivity: 'base' });
        }
        return sortDir * (a[1] - b[1]);
      })
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return { regionItems, pieSegments };
  }, [
    regions,
    settlements,
    settlementRecipes,
    selectedRegionIds,
    selectedSettlementIds,
    showRarest,
    selectedCategoryId,
    excludedIngredients,
  ]);

  const PieInner = ({ width, height }: { width: number; height: number }) => {
    const margin = { top: 40, right: 32, bottom: 40, left: 32 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);
    const radius = Math.min(xMax, yMax) / 2;

    if (pieSegments.length === 0 || radius <= 0) {
      return (
        <svg width={width} height={height}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={14}
          >
            Nincs adat
          </text>
        </svg>
      );
    }

    const total = pieSegments.reduce((sum, seg) => sum + (seg.value || 0), 0) || 1;

    return (
      <svg width={width} height={height}>
        <Group left={margin.left + xMax / 2} top={margin.top + yMax / 2 + 40}>
          <Pie<PieSegment>
            data={pieSegments}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={radius * 0.4}
          >
            {(pie) =>
              pie.arcs.map((arcDatum, index) => {
                const path = pie.path(arcDatum);
                if (!path) return null;
                const seg = arcDatum.data;
                const isHovered = hoveredIngredient === seg.name;
                const color = palette[index % palette.length];
                return (
                  <g key={`slice-${seg.name}`}>
                    <path
                      d={path}
                      fill={color}
                      stroke="#0f172a"
                      strokeWidth={isHovered ? 3 : 1}
                      opacity={hoveredIngredient && !isHovered ? 0.5 : 1}
                    />
                  </g>
                );
              })
            }
          </Pie>
        </Group>
        <Group left={margin.left} top={margin.top}>
          {pieSegments.map((seg, idx) => {
            const percentage = ((seg.value || 0) / total) * 100;
            const isHovered = hoveredIngredient === seg.name;
            return (
              <g key={`legend-${seg.name}`} transform={`translate(0, ${idx * 18})`}>
                <rect
                  x={0}
                  y={0}
                  width={12}
                  height={12}
                  fill={palette[idx % palette.length]}
                  stroke={isHovered ? '#f97316' : '#0f172a'}
                  strokeWidth={isHovered ? 2 : 1}
                />
                <text
                  x={18}
                  y={10}
                  fill="#e2e8f0"
                  fontSize={11}
                  style={{ pointerEvents: 'none' }}
                >
                  {`${seg.name} (${Math.round(percentage)}%)`}
                </text>
              </g>
            );
          })}
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
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span style={{ color: '#e2e8f0', fontSize: 13 }}>Vármegye → hozzávaló</span>
          <button
            type="button"
            onClick={() => setShowRarest((prev) => !prev)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              background: showRarest ? '#f97316' : 'transparent',
              color: showRarest ? '#0f172a' : '#f97316',
            }}
          >
            {showRarest ? 'Leggyakoribbak' : 'Legritkábbak'}
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 4,
            borderRadius: 8,
            background: '#020617',
            border: '1px solid #1f2937',
          }}
        >
          {regionItems.length === 0 ? (
            <div
              style={{
                padding: '8px 10px',
                color: '#94a3b8',
                fontSize: 12,
              }}
            >
              Nincs adat a szurok alapjan.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {regionItems.map((item) => (
                <li
                  key={item.regionId}
                  onMouseEnter={() => setHoveredIngredient(item.ingredientName)}
                  onMouseLeave={() => setHoveredIngredient(null)}
                  style={{
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    borderBottom: '1px solid #0f172a',
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                >
                  <span
                    style={{
                      flex: 1.5,
                      whiteSpace: 'normal',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.regionName}
                  </span>
                  <span
                    style={{
                      flex: 1.4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#f97316',
                      textAlign: 'right',
                    }}
                  >
                    {item.ingredientName}
                  </span>
                  <span
                    style={{
                      width: 32,
                      textAlign: 'right',
                      color: '#94a3b8',
                    }}
                  >
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <ParentSize>
            {({ width, height }) => (
              <PieInner width={Math.max(750, width)} height={Math.max(450, height)} />
            )}
          </ParentSize>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            width: 240,
          }}
        >
          <Chips
            value={excludedIngredients}
            onChange={(e) => setExcludedIngredients(e.value || [])}
            placeholder="Írj be hozzávalót, majd Enter"
            allowDuplicate={false}
            className="route-ms w-full"
            style={{ width: '100%' }}
          />
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedCategoryId(value ? Number(value) : null);
            }}
            style={{
              background: '#020617',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              width: '100%',
            }}
          >
            <option value=''>Minden kategoria</option>
            {categoryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default RegionMostCommonIngredientChart;

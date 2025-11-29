import React, { useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { Chips } from 'primereact/chips';
import { useAppSelector } from '../../hooks/hooks';
import type { SettlementWithGeom, RecipeListItem } from '../../config/api/api';

type CategoryCount = {
  id: number;
  name: string;
  count: number;
};

const BAD_INGREDIENT_DATA_URLS = new Set<string>([
  'https://www.izorzok.hu/klari-kulonleges-meggyes-retese/',
  'https://www.izorzok.hu/zoldbableves-krumpligomboccal/',
]);

type CategoryMatch = {
  title: string;
  url?: string;
  year?: number | null;
  settlementName?: string | null;
};

// Egyszeru normalizalas: utolso szo kisbetusen
const normalizeIngredient = (raw: string | undefined | null): string => {
  if (!raw) return '';
  let text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Lezaratlan zarojel eseten dobjuk
  if (text.includes('(') && !text.includes(')')) return '';
  // Vegerol alap irasjelek lecsapasa
  text = text.replace(/[.,;:!?]+$/g, '').trim();
  const parts = text.split(/\s+/);
  if (!parts.length) return '';
  const last = parts[parts.length - 1] || '';
  const key = last.toLowerCase();
  // Ha csak szam, azt is dobjuk
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

const FindRecipesByIngredients: React.FC = () => {
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

  const [ingredients, setIngredients] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const normalizedSearchIngredients = useMemo(
    () =>
      ingredients
        .map((name) => normalizeIngredient(name))
        .filter((name) => name.length > 0),
    [ingredients],
  );

  const { categoryCounts, recipesByCategoryId } = useMemo(() => {
    const recipesByCategoryId = new Map<number, CategoryMatch[]>();
    if (!settlements.length) {
      return { categoryCounts: [] as CategoryCount[], recipesByCategoryId };
    }

    const settlementById = new Map<number, SettlementWithGeom>();
    settlements.forEach((s) => {
      if (typeof s.id === 'number' && Number.isFinite(s.id)) {
        settlementById.set(s.id, s);
      }
    });

    const requiredIngredients = new Set(normalizedSearchIngredients);

    const hasSelectedSettlements = selectedSettlementIds.length > 0;
    const selectedSettlementSet = hasSelectedSettlements
      ? new Set(selectedSettlementIds)
      : undefined;
    const hasSelectedRegions = selectedRegionIds.length > 0;
    const selectedRegionSet = hasSelectedRegions ? new Set(selectedRegionIds) : undefined;

    const counts = new Map<number, number>();

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
        const recipeIngredients = splitIngredientsText(ingredientsText);
        if (!recipeIngredients.length && requiredIngredients.size > 0) continue;

        const ingredientSet = new Set(recipeIngredients);

        const matches =
          requiredIngredients.size === 0
            ? true
            : Array.from(requiredIngredients).every((ing) => ingredientSet.has(ing));

        if (!matches) continue;

        const rawCategory = (recipe as any)?.category_id;
        const categoryId =
          typeof rawCategory === 'number'
            ? rawCategory
            : typeof rawCategory === 'string'
            ? Number(rawCategory)
            : Number.NaN;
        if (!Number.isFinite(categoryId)) continue;

        counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);

        let listForCategory = recipesByCategoryId.get(categoryId);
        if (!listForCategory) {
          listForCategory = [];
          recipesByCategoryId.set(categoryId, listForCategory);
        }
        listForCategory.push({
          title: (recipe as any)?.title ?? 'Ismeretlen recept',
          url: (recipe as any)?.url,
          year: (recipe as any)?.year ?? null,
          settlementName: settlement.name ?? null,
        });
      }
    }

    const result: CategoryCount[] = Array.from(counts.entries()).map(([id, count]) => {
      const name = categoryMap[id] || `Kategoria ${id}`;
      return { id, name, count };
    });

    result.sort((a, b) => {
      if (a.count === b.count) {
        return a.name.localeCompare(b.name, 'hu-HU', { sensitivity: 'base' });
      }
      return b.count - a.count;
    });

    return { categoryCounts: result, recipesByCategoryId };
  }, [
    settlements,
    settlementRecipes,
    selectedRegionIds,
    selectedSettlementIds,
    normalizedSearchIngredients,
    categoryMap,
  ]);

  const totalMatches = useMemo(
    () => categoryCounts.reduce((sum, c) => sum + c.count, 0),
    [categoryCounts],
  );

  const selectedCategory = categoryCounts.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedRecipes: CategoryMatch[] =
    selectedCategoryId != null ? recipesByCategoryId.get(selectedCategoryId) ?? [] : [];

  const ChartInner: React.FC<{ width: number; height: number }> = ({ width, height }) => {
    const [hovered, setHovered] = useState<{ name: string; count: number } | null>(null);
    const margin = { top: 24, right: 24, bottom: 80, left: 48 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    if (!categoryCounts.length || xMax <= 0 || yMax <= 0) {
      return (
        <svg width={width} height={height}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={14}
          >
            Nincs adat a megadott hozzavalok alapjan.
          </text>
        </svg>
      );
    }

    const x = scaleBand<string>({
      domain: categoryCounts.map((c) => c.name),
      range: [0, xMax],
      padding: 0.35,
    });
    const maxCount = Math.max(...categoryCounts.map((c) => c.count), 1);
    const y = scaleLinear<number>({
      domain: [0, maxCount],
      range: [yMax, 0],
      nice: true,
    });

    const axisColor = '#94a3b8';

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {categoryCounts.map((cat) => {
            const xBand = x(cat.name);
            if (xBand == null) return null;
            const value = cat.count;
            const yValue = y(value);
            const yZero = y(0);
            const barHeight = Math.max(0, (yZero ?? 0) - (yValue ?? 0));
            const barY = yValue ?? 0;
            const isHovered = hovered?.name === cat.name;
            const isSelected = selectedCategoryId === cat.id;
            const labelY = Math.max(12, Math.min((yZero ?? 0) - 8, (yValue ?? 0) - 8));
            const fillColor = isSelected ? '#f97316' : isHovered ? '#0ea5e9' : '#38bdf8';

            return (
              <Group key={cat.id} left={xBand}>
                <Bar
                  x={0}
                  y={barY}
                  width={x.bandwidth()}
                  height={barHeight}
                  fill={fillColor}
                  tabIndex={0}
                  aria-label={`Kategoria ${cat.name}, receptszam ${value}`}
                  onMouseEnter={() => setHovered({ name: cat.name, count: value })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ name: cat.name, count: value })}
                  onBlur={() => setHovered(null)}
                  onClick={() =>
                    setSelectedCategoryId((prev) => (prev === cat.id ? null : cat.id))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCategoryId((prev) => (prev === cat.id ? null : cat.id));
                    }
                  }}
                />
                {isHovered ? (
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
                ) : null}
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
            tickLabelProps={() => ({
              fill: '#e2e8f0',
              fontSize: 10,
              textAnchor: 'middle',
            })}
            tickComponent={(tickProps: any) => {
              const { x: tickX, y: tickY, formattedValue } = tickProps;
              if (tickX == null || tickY == null) return null;
              return (
                <g transform={`translate(${tickX},${tickY})`}>
                  <line x1={0} x2={0} y1={0} y2={6} stroke={axisColor} />
                  <text
                    x={0}
                    y={10}
                    transform="rotate(-25)"
                    fill="#e2e8f0"
                    fontSize={10}
                    textAnchor="end"
                  >
                    {formattedValue}
                  </text>
                </g>
              );
            }}
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span style={{ color: '#e2e8f0', fontSize: 13 }}>
          Adj meg hozzávaló(ka)t (Enter a felvételhez).
        </span>
        <Chips
          value={ingredients}
          onChange={(e) => setIngredients(e.value || [])}
          placeholder="Pl.: liszt, cukor, tej... (Enter)"
          allowDuplicate={false}
          className="route-ms w-full"
          style={{ width: '100%' }}
        />
        <span style={{ color: '#94a3b8', fontSize: 12 }}>
          {totalMatches > 0
            ? `Találat: ${totalMatches} recept a megadott hozzávalókkal.`
            : 'Nincs találat a megadott hozzávalók alapján.'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 260 }}>
        <ParentSize>
          {({ width, height }) => (
            <ChartInner width={Math.max(520, width)} height={Math.max(320, height)} />
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
        {selectedCategory && selectedRecipes.length > 0 ? (
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
                {selectedCategory.name}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>
                {selectedRecipes.length} recept
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
              {selectedRecipes.map((r, index) => (
                <li
                  key={`${selectedCategory.id}-${index}`}
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

export default FindRecipesByIngredients;

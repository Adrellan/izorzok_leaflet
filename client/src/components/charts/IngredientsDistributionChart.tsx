import React, { useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Line } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { useAppSelector } from '../../hooks/hooks';
import type { SettlementWithGeom, RecipeListItem } from '../../config/api/api';

type CategoryBox = {
  id: number;
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
};

const BAD_INGREDIENT_DATA_URLS = new Set<string>([
  'https://www.izorzok.hu/zoldbableves-krumpligomboccal/',
  'https://www.izorzok.hu/klari-kulonleges-meggyes-retese/',
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

const computeBoxStats = (values: number[]): Omit<CategoryBox, 'id' | 'name' | 'count'> | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const median = (arr: number[]): number => {
    const m = arr.length;
    if (m === 0) return 0;
    const mid = Math.floor(m / 2);
    if (m % 2 === 0) return (arr[mid - 1] + arr[mid]) / 2;
    return arr[mid];
  };

  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.slice(n % 2 === 0 ? mid : mid + 1);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const med = median(sorted);
  const q1 = median(lower);
  const q3 = median(upper);

  return { min, q1, median: med, q3, max };
};

const IngredientsDistributionChart: React.FC = () => {
  const settlements =
    useAppSelector((s) => (s.geo as any).settlements as SettlementWithGeom[] | undefined) ?? [];
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

  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);

  const boxes = useMemo<CategoryBox[]>(() => {
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

    const valuesByCategory = new Map<number, number[]>();

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

        const rawCategory = (recipe as any)?.category_id;
        const categoryId =
          typeof rawCategory === 'number'
            ? rawCategory
            : typeof rawCategory === 'string'
            ? Number(rawCategory)
            : Number.NaN;
        if (!Number.isFinite(categoryId)) continue;

        const ingredientsText = (recipe as any)?.ingredients_text as string | undefined;
        const ingredients = splitIngredientsText(ingredientsText);
        const count = ingredients.length;
        if (!count) continue;

        const list = valuesByCategory.get(categoryId) ?? [];
        list.push(count);
        valuesByCategory.set(categoryId, list);
      }
    }

    const result: CategoryBox[] = [];
    for (const [categoryId, values] of valuesByCategory.entries()) {
      if (values.length < 2) continue;
      const stats = computeBoxStats(values);
      if (!stats) continue;
      const name = categoryMap[categoryId] || `Kategoria ${categoryId}`;
      result.push({
        id: categoryId,
        name,
        count: values.length,
        ...stats,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name, 'hu-HU', { sensitivity: 'base' }));
    return result;
  }, [
    settlements,
    settlementRecipes,
    selectedRegionIds,
    selectedSettlementIds,
    categoryMap,
  ]);

  const ChartInner: React.FC<{ width: number; height: number }> = ({ width, height }) => {
    const margin = { top: 24, right: 24, bottom: 80, left: 48 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    if (!boxes.length || xMax <= 0 || yMax <= 0) {
      return (
        <svg width={width} height={height}>
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={14}
          >
            Nincs adat a szűrők alapján.
          </text>
        </svg>
      );
    }

    const maxValue = Math.max(...boxes.map((b) => b.max), 1);

    const x = scaleBand<number>({
      domain: boxes.map((b) => b.id),
      range: [0, xMax],
      padding: 0.3,
    });

    const y = scaleLinear<number>({
      domain: [0, maxValue],
      range: [yMax, 0],
      nice: true,
    });

    const axisColor = '#94a3b8';

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {boxes.map((box) => {
            const xBand = x(box.id);
            if (xBand == null) return null;
            const cx = xBand + x.bandwidth() / 2;
            const boxWidth = x.bandwidth() * 0.6;

            const yMin = y(box.min);
            const yMaxVal = y(box.max);
            const yQ1 = y(box.q1);
            const yQ3 = y(box.q3);
            const yMed = y(box.median);

            const isHovered = hoveredCategoryId === box.id;
            const strokeColor = isHovered ? '#f97316' : '#e2e8f0';
            const fillColor = isHovered ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.25)';

            return (
              <Group
                key={box.id}
                onMouseEnter={() => setHoveredCategoryId(box.id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
              >
                {/* whisker line */}
                <Line
                  from={{ x: cx, y: yMaxVal }}
                  to={{ x: cx, y: yMin }}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
                {/* min & max caps */}
                <Line
                  from={{ x: cx - boxWidth * 0.3, y: yMaxVal }}
                  to={{ x: cx + boxWidth * 0.3, y: yMaxVal }}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
                <Line
                  from={{ x: cx - boxWidth * 0.3, y: yMin }}
                  to={{ x: cx + boxWidth * 0.3, y: yMin }}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
                {/* IQR box */}
                <rect
                  x={cx - boxWidth / 2}
                  width={boxWidth}
                  y={yQ3}
                  height={Math.max(0, yQ1 - yQ3)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={1}
                  rx={4}
                />
                {/* median */}
                <Line
                  from={{ x: cx - boxWidth / 2, y: yMed }}
                  to={{ x: cx + boxWidth / 2, y: yMed }}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
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
              const id = Number(formattedValue);
              const label = boxes.find((b) => b.id === id)?.name ?? String(formattedValue);
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
                    {label}
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
    <div style={{ width: '100%', height: '100%' }}>
      <ParentSize>
        {({ width, height }) => (
          <ChartInner width={Math.max(640, width)} height={Math.max(320, height)} />
        )}
      </ParentSize>
    </div>
  );
};

export default IngredientsDistributionChart;

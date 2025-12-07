import React, { useEffect, useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinePath } from '@visx/shape';
import { scaleLinear, scalePoint } from '@visx/scale';

export type CategoryYearCountDatum = {
  year: number;
  categoryId: number;
  categoryName: string;
  count: number;
};

type SeriesPoint = {
  year: number;
  value: number | null;
};

type Series = {
  categoryId: number;
  categoryName: string;
  total: number;
  points: SeriesPoint[];
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

const CategorCountsPerYears: React.FC<{ data: CategoryYearCountDatum[] }> = ({ data }) => {
  const { series, years, maxValue, colorMap } = useMemo(() => {
    if (!Array.isArray(data)) {
      return { series: [] as Series[], years: [] as number[], maxValue: 1, colorMap: new Map<number, string>() };
    }

    const yearsSet = new Set<number>();
    const grouped = new Map<number, { name: string; byYear: Map<number, number>; total: number }>();

    data.forEach((entry) => {
      const rawYear = (entry as any)?.year;
      const year = typeof rawYear === 'number' ? rawYear : Number(rawYear);
      if (!Number.isFinite(year)) return;
      yearsSet.add(year);

      const rawCategoryId = (entry as any)?.categoryId;
      const categoryId =
        typeof rawCategoryId === 'number'
          ? rawCategoryId
          : typeof rawCategoryId === 'string'
          ? Number(rawCategoryId)
          : Number.NaN;
      if (!Number.isFinite(categoryId)) return;

      const rawCount = (entry as any)?.count;
      const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
      if (!Number.isFinite(count)) return;

      const categoryName = (entry as any)?.categoryName || `Kategoria ${categoryId}`;
      const bucket = grouped.get(categoryId) ?? {
        name: categoryName,
        byYear: new Map<number, number>(),
        total: 0,
      };
      bucket.byYear.set(year, (bucket.byYear.get(year) ?? 0) + count);
      bucket.total += count;
      grouped.set(categoryId, bucket);
    });

    const years = Array.from(yearsSet).sort((a, b) => a - b);

    const series: Series[] = Array.from(grouped.entries()).map(([categoryId, info]) => ({
      categoryId,
      categoryName: info.name,
      total: info.total,
      points: years.map((year) => ({
        year,
        value: info.byYear.get(year) ?? null,
      })),
    }));

    series.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.categoryName.localeCompare(b.categoryName, 'hu-HU', { sensitivity: 'base' });
    });

    const maxValue =
      series.length === 0
        ? 1
        : Math.max(
            1,
            ...series.map((s) => Math.max(...s.points.map((p) => (p.value ?? 0)))),
          );

    const colorMap = new Map<number, string>();
    series.forEach((s, idx) => {
      colorMap.set(s.categoryId, palette[idx % palette.length]);
    });

    return { series, years, maxValue, colorMap };
  }, [data]);

  const [visibleCategories, setVisibleCategories] = useState<Set<number>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<{
    year: number;
    categoryId: number;
    categoryName: string;
    value: number;
  } | null>(null);

  useEffect(() => {
    const defaults = new Set(series.slice(0, 6).map((s) => s.categoryId));
    setVisibleCategories(defaults);
  }, [series]);

  const toggleCategory = (id: number) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const showAll = () => {
    setVisibleCategories(new Set(series.map((s) => s.categoryId)));
  };

  const hideAll = () => {
    setVisibleCategories(new Set());
  };

  const ChartInner = ({ width, height }: { width: number; height: number }) => {
    const margin = { top: 32, right: 16, bottom: 56, left: 52 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    if (!series.length || !years.length || xMax <= 0 || yMax <= 0) {
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

    const x = scalePoint<number>({
      domain: years,
      range: [0, xMax],
      padding: 0.5,
    });

    const y = scaleLinear<number>({
      domain: [0, maxValue],
      range: [yMax, 0],
      nice: true,
    });

    const axisColor = '#94a3b8';
    const visibleSeries = series.filter((s) => visibleCategories.has(s.categoryId));
    const yTicks = y.ticks(5);

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {yTicks.map((tick) => {
            const yPos = y(tick);
            if (!Number.isFinite(yPos)) return null;
            return (
              <line
                key={`y-grid-${tick}`}
                x1={0}
                x2={xMax}
                y1={yPos}
                y2={yPos}
                stroke="#1f2937"
                strokeWidth={1}
              />
            );
          })}
          {years.map((year) => {
            const xPos = x(year);
            if (xPos == null) return null;
            return (
              <line
                key={`x-grid-${year}`}
                x1={xPos}
                x2={xPos}
                y1={0}
                y2={yMax}
                stroke="#1f2937"
                strokeWidth={1}
              />
            );
          })}

          {visibleSeries.map((serie) => {
            const color = colorMap.get(serie.categoryId) ?? '#0ea5e9';
            return (
              <g key={`serie-${serie.categoryId}`}>
                <LinePath<SeriesPoint>
                  data={serie.points}
                  defined={(d) => d.value != null}
                  x={(d) => {
                    const v = x(d.year);
                    return v == null ? 0 : v;
                  }}
                  y={(d) => y(d.value ?? 0)}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  shapeRendering="geometricPrecision"
                />
                {serie.points.map((point) => {
                  if (point.value == null) return null;
                  const cx = x(point.year);
                  const cy = y(point.value);
                  if (cx == null || !Number.isFinite(cy)) return null;
                  return (
                    <circle
                      key={`${serie.categoryId}-${point.year}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          year: point.year,
                          categoryId: serie.categoryId,
                          categoryName: serie.categoryName,
                          value: point.value ?? 0,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <title>{`${serie.categoryName} - ${point.year}: ${point.value}`}</title>
                    </circle>
                  );
                })}
              </g>
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
            tickValues={years}
            tickLabelProps={() => ({
              fill: '#e2e8f0',
              fontSize: 11,
              textAnchor: 'end',
              transform: 'rotate(-35deg)',
              dy: 8,
            })}
          />
        </Group>
        {hoveredPoint ? (
          <text
            x={margin.left + xMax / 2}
            y={18}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={13}
          >
            {`${hoveredPoint.categoryName} - ${hoveredPoint.year}: ${hoveredPoint.value}`}
          </text>
        ) : null}
      </svg>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <ParentSize>
          {({ width, height }) => (
            <ChartInner width={Math.max(640, width)} height={Math.max(360, height)} />
          )}
        </ParentSize>
      </div>
      <div
        style={{
          width: '240px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={showAll}
            style={{
              flex: 1,
              background: '#0ea5e9',
              color: '#0b1224',
              border: 'none',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Mindet mutat
          </button>
          <button
            type="button"
            onClick={hideAll}
            style={{
              flex: 1,
              background: '#1f2937',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Mindet elrejt
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid #1f2937',
            borderRadius: 8,
            padding: '6px',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '6px',
          }}
        >
          {series.map((serie, idx) => {
            const active = visibleCategories.has(serie.categoryId);
            const color = colorMap.get(serie.categoryId) ?? palette[idx % palette.length];
            return (
              <button
                key={serie.categoryId}
                type="button"
                onClick={() => toggleCategory(serie.categoryId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: active ? '1px solid #0ea5e9' : '1px solid #1f2937',
                  background: active ? 'rgba(14, 165, 233, 0.16)' : '#0b1224',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      background: color,
                      border: '1px solid #0f172a',
                    }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                      display: 'inline-block',
                    }}
                    title={serie.categoryName}
                  >
                    {serie.categoryName}
                  </span>
                </span>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{serie.total}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategorCountsPerYears;




import React, { useEffect, useMemo, useState } from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { arc } from 'd3-shape';
import type { DefaultArcObject } from 'd3-shape';
import { useAppSelector } from '../../hooks/hooks';

export type RegionCategoryChartDatum = {
  year: number;
  region: string;
  regionId: number;
  settlementId?: number;
  settlementName?: string;
  categoryId: number;
  categoryName: string;
  count: number;
};

type ChartSegment = {
  id: number;
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

const RegionMostCommonCategoryChart: React.FC<{ data: RegionCategoryChartDatum[] }> = ({
  data,
}) => {
  const selectedRegionIds = useAppSelector(
    (s) => ((s.map as any).selectedRegionIds as number[]) ?? []
  );
  const selectedSettlementIds = useAppSelector(
    (s) => ((s.map as any).selectedSettlementIds as number[]) ?? []
  );
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [hoveredSliceCategory, setHoveredSliceCategory] = useState<number | null>(null);
  const [hoveredBarCategory, setHoveredBarCategory] = useState<number | null>(null);
  const [regionHoverHighlight, setRegionHoverHighlight] = useState<{
    categoryId: number;
    portion: number;
  } | null>(null);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    if (selectedSettlementIds.length > 0) {
      const allowed = new Set(selectedSettlementIds);
      return data.filter((entry) => allowed.has(entry.settlementId ?? -1));
    }
    if (selectedRegionIds.length > 0) {
      const allowed = new Set(selectedRegionIds);
      return data.filter((entry) => allowed.has(entry.regionId));
    }
    return data;
  }, [data, selectedRegionIds, selectedSettlementIds]);

  const mainSegments = useMemo(() => {
    const map = new Map<number, ChartSegment>();
    filteredData.forEach((entry) => {
      const value = map.get(entry.categoryId);
      map.set(entry.categoryId, {
        id: entry.categoryId,
        name: entry.categoryName ?? `Kategória ${entry.categoryId}`,
        value: (value?.value ?? 0) + entry.count,
      });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const mainSegmentMap = useMemo(() => {
    const map = new Map<number, number>();
    mainSegments.forEach((segment) => {
      map.set(segment.id, segment.value);
    });
    return map;
  }, [mainSegments]);

  const regionCategoryMap = useMemo(() => {
    const map = new Map<
      number,
      {
        name: string;
        categories: Map<number, ChartSegment>;
      }
    >();
    filteredData.forEach((entry) => {
      if (!Number.isFinite(entry.regionId)) return;
      const bucket = map.get(entry.regionId) ?? {
        name: entry.region ?? `Vármegye ${entry.regionId}`,
        categories: new Map<number, ChartSegment>(),
      };
      const cat = bucket.categories.get(entry.categoryId);
      bucket.categories.set(entry.categoryId, {
        id: entry.categoryId,
        name: entry.categoryName ?? `Kategória ${entry.categoryId}`,
        value: (cat?.value ?? 0) + entry.count,
      });
      map.set(entry.regionId, bucket);
    });
    return map;
  }, [filteredData]);

  const [selectedRegionA, setSelectedRegionA] = useState<number | null>(null);
  const [selectedRegionB, setSelectedRegionB] = useState<number | null>(null);

  const regionList = useMemo(
    () =>
      Array.from(regionCategoryMap.entries())
        .map(([id, { name }]) => ({
          id,
          name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'hu-HU', { sensitivity: 'base' })),
    [regionCategoryMap]
  );

  useEffect(() => {
    if (regionList.length === 0) {
      setSelectedRegionA(null);
      setSelectedRegionB(null);
      return;
    }
    setSelectedRegionA((prev) => (prev != null && regionCategoryMap.has(prev) ? prev : regionList[0].id));
    setSelectedRegionB((prev) => {
      if (prev != null && regionCategoryMap.has(prev)) return prev;
      return regionList[1]?.id ?? regionList[0].id;
    });
  }, [regionList, regionCategoryMap]);

  const getRegionSegments = (regionId: number | null): ChartSegment[] => {
    if (!regionId) return [];
    const entry = regionCategoryMap.get(regionId);
    if (!entry) return [];
    return Array.from(entry.categories.values()).sort((a, b) => b.value - a.value);
  };

  const categoryColorMap = useMemo(() => {
    const map = new Map<number, string>();
    mainSegments.forEach((segment, index) => {
      map.set(segment.id, palette[index % palette.length]);
    });
    return map;
  }, [mainSegments]);

  const getCategoryColor = (id: number, fallbackIndex: number) =>
    categoryColorMap.get(id) ?? palette[fallbackIndex % palette.length];

  const ChartInner = ({ width, height }: { width: number; height: number }) => {
    const margin = { top: 32, right: 24, bottom: 32, left: 24 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);
    const radius = Math.min(xMax, yMax) / 2;
    const maxSegmentValue = Math.max(...mainSegments.map((seg) => seg.value), 1);

    if (mainSegments.length === 0 || radius <= 0) {
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

    const hoveredSegment = mainSegments.find((seg) => seg.id === hoveredSliceCategory);
    const computeOuterRadius = (value: number) =>
      radius * (0.4 + 0.6 * ((value || 0) / maxSegmentValue));

    return (
      <svg width={width} height={height}>
        <Group left={margin.left + xMax / 2} top={margin.top + yMax / 2}>
          <Pie
            data={mainSegments}
            pieValue={(d) => d.value}
            outerRadius={(arcDatum) =>
              computeOuterRadius((arcDatum.data?.value ?? 0))
            }
            innerRadius={radius * 0.25}
          >
            {(pie) =>
              pie.arcs.map((arcDatum, index) => {
                const path = pie.path(arcDatum);
                if (!path) return null;
                const segment = arcDatum.data;
                const isHovered = hoveredCategory === segment.id;
                const arcOuterRadius = computeOuterRadius(segment.value);
                const highlightPortion =
                  regionHoverHighlight?.categoryId === segment.id
                    ? Math.min(Math.max(regionHoverHighlight.portion, 0), 1)
                    : 0;
                let highlightPath: string | null = null;
                if (highlightPortion > 0) {
                  const highlightGenerator = arc<DefaultArcObject>()
                    .innerRadius(radius * 0.25)
                    .outerRadius(arcOuterRadius);
                  highlightPath = highlightGenerator({
                    startAngle: arcDatum.startAngle,
                    endAngle:
                      arcDatum.startAngle +
                      (arcDatum.endAngle - arcDatum.startAngle) * highlightPortion,
                  } as DefaultArcObject);
                }
                return (
                  <g key={`main-${segment.id}`}>
                    <path
                      d={path}
                      fill={getCategoryColor(segment.id, index)}
                      stroke={isHovered ? '#000000' : '#0f172a'}
                      strokeWidth={isHovered ? 5 : 1}
                      onMouseEnter={() => {
                        setHoveredCategory(segment.id);
                        setHoveredSliceCategory(segment.id);
                      }}
                      onMouseLeave={() => {
                        setHoveredCategory(null);
                        setHoveredSliceCategory(null);
                      }}
                    />
                    {highlightPath ? (
                      <path
                        d={highlightPath}
                        fill="rgba(220, 38, 38, 0.75)"
                        stroke="#000"
                        strokeWidth={1}
                      />
                    ) : null}
                  </g>
                );
              })
            }
          </Pie>
        </Group>
        {hoveredSegment ? (
          <text
            x={width / 2}
            y={margin.top - 12}
            fill="#e2e8f0"
            fontSize={13}
            textAnchor="middle"
          >
            {`${hoveredSegment.name}: ${hoveredSegment.value}`}
          </text>
        ) : null}
      </svg>
    );
  };

  const renderRegionChart = (
    label: string,
    regionId: number | null,
    onRegionChange: (id: number | null) => void
  ) => {
    const segments = getRegionSegments(regionId);
    const sorted = [...segments].sort((a, b) => b.value - a.value);
    const chartWidth = 260;
    const chartHeight = 200;
    const margin = { top: 12, right: 12, bottom: 36, left: 32 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const maxValue = sorted.length ? Math.max(...sorted.map((seg) => seg.value)) : 0;
    const x = scaleBand<string>({
      domain: sorted.map((seg) => seg.name),
      range: [0, innerWidth],
      padding: 0.35,
    });
    const y = scaleLinear<number>({
      domain: [0, maxValue || 1],
      range: [innerHeight, 0],
      nice: true,
    });

    return (
      <div
        style={{
          background: '#0f172a',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minHeight: '260px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{label}</span>
          <select
            value={regionId ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              onRegionChange(value ? Number(value) : null);
            }}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '4px',
              padding: '4px 8px',
              width: '170px',
              maxWidth: '100%',
            }}
          >
            <option value="">Válassz vármegyét</option>
            {regionList.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {sorted.length === 0 ? (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Nincs adat</span>
          ) : (
            <svg width={chartWidth} height={chartHeight}>
              <Group left={margin.left} top={margin.top}>
                <rect x={0} y={innerHeight} width={innerWidth} height={1} fill="#475569" />
                {sorted.map((segment, index) => {
                  const xPos = x(segment.name);
                  if (xPos == null) return null;
                  const yValue = y(segment.value);
                  const barHeight = innerHeight - yValue;
                  const mainValue = mainSegmentMap.get(segment.id) ?? 0;
                  const portion = mainValue > 0 ? Math.min(segment.value / mainValue, 1) : 0;
                  const showCount =
                    hoveredBarCategory === segment.id || hoveredCategory === segment.id;
                  const isBarHighlighted = hoveredCategory === segment.id;
                  return (
                    <g key={`bar-${segment.id}-${index}`}>
                      <rect
                        x={xPos}
                        y={yValue}
                        width={x.bandwidth()}
                        height={barHeight}
                        fill={getCategoryColor(segment.id, index)}
                        stroke={isBarHighlighted ? '#000' : '#0f172a'}
                        strokeWidth={isBarHighlighted ? 2 : 1}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          setHoveredBarCategory(segment.id);
                          setRegionHoverHighlight(
                            portion > 0
                              ? { categoryId: segment.id, portion }
                              : null
                          );
                        }}
                        onMouseLeave={() => {
                          setHoveredBarCategory(null);
                          setRegionHoverHighlight(null);
                        }}
                      />
                      {showCount ? (
                        <text
                          x={xPos + x.bandwidth() / 2}
                          y={yValue - 4}
                          fill="#e2e8f0"
                          fontSize={11}
                          textAnchor="middle"
                        >
                          {segment.value}
                        </text>
                      ) : null}
                      <title>{`${segment.name}: ${segment.value}`}</title>
                    </g>
                  );
                })}
              </Group>
            </svg>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', height: '100%', gap: '20px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <ParentSize>
              {({ width, height }) => (
                <ChartInner width={Math.max(360, width)} height={Math.max(360, height)} />
              )}
            </ParentSize>
          </div>
          <div
            style={{
              marginTop: '12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '10px',
            }}
          >
            {mainSegments.map((segment, idx) => (
              <div
                key={`legend-${segment.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredCategory(segment.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    background: getCategoryColor(segment.id, idx),
                    borderRadius: '4px',
                    border:
                      hoveredCategory === segment.id ? '2px solid #dc2626' : '1px solid #0f172a',
                  }}
                />
                <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{segment.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {renderRegionChart('Vármegye 1', selectedRegionA, setSelectedRegionA)}
          {renderRegionChart('Vármegye 2', selectedRegionB, setSelectedRegionB)}
        </div>
      </div>
    </div>
  );
};

export default RegionMostCommonCategoryChart;

import React from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { Bar } from '@visx/shape';

type DataPoint = {
  year: number;
  region: string;
  count: number;
};

type Props = {
  data: DataPoint[];
};

const RegionYearRecipeChart: React.FC<Props> = ({ data }) => {
  const ChartInner = ({ width, height }: { width: number; height: number }) => {
    const [hovered, setHovered] = React.useState<{ year: number; value: number } | null>(
      null
    );
    const margin = { top: 24, right: 24, bottom: 28, left: 48 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    if (!data || data.length === 0 || xMax <= 0 || yMax <= 0) {
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

    // Aggregate total counts per year (ignore region)
    const totalsByYear = new Map<number, number>();
    for (const d of data) {
      const year = d.year;
      if (!Number.isFinite(year)) continue;
      totalsByYear.set(year, (totalsByYear.get(year) ?? 0) + d.count);
    }

    const distinctYears = Array.from(totalsByYear.keys()).sort((a, b) => a - b);
    if (distinctYears.length === 0) {
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

    const minYear = distinctYears[0];
    const maxYear = distinctYears[distinctYears.length - 1];
    const years: number[] = [];
    for (let yv = minYear; yv <= maxYear; yv++) {
      years.push(yv);
      if (!totalsByYear.has(yv)) {
        totalsByYear.set(yv, 0);
      }
    }

    const maxTotal = Math.max(1, ...Array.from(totalsByYear.values()));

    const x = scaleBand<number>({
      domain: years,
      range: [0, xMax],
      padding: 0.2,
    });
    const y = scaleLinear<number>({
      domain: [0, maxTotal],
      range: [yMax, 0],
      nice: true,
    });

    const axisColor = '#94a3b8';

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {years.map((year) => {
            const xBand = x(year);
            if (xBand == null) return null;
            const value = totalsByYear.get(year) ?? 0;
            const yValue = y(value);
            const yZero = y(0);
            const barHeight = Math.max(0, (yZero ?? 0) - (yValue ?? 0));
            const barY = (yValue ?? 0);
            const labelY = Math.max(
              12,
              Math.min((yZero ?? 0) - 8, (yValue ?? 0) - 8)
            );
            const isHovered = hovered?.year === year;

            return (
              <Group key={`year-${year}`} left={xBand}>
                <Bar
                  x={0}
                  y={barY}
                  width={x.bandwidth()}
                  height={barHeight}
                  fill={isHovered ? '#0ea5e9' : '#38bdf8'}
                  tabIndex={0}
                  aria-label={`Ev ${year}, receptszam ${value}`}
                  onMouseEnter={() => setHovered({ year, value })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ year, value })}
                  onBlur={() => setHovered(null)}
                />
                {isHovered ? (
                  <text
                    x={x.bandwidth() / 2}
                    y={labelY}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize={12}
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
            tickValues={years}
            stroke={axisColor}
            tickStroke={axisColor}
            tickFormat={(v) => String(v)}
            tickLabelProps={() => ({
              fill: '#e2e8f0',
              fontSize: 11,
              textAnchor: 'middle',
              dy: 4,
            })}
          />
        </Group>

      </svg>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ParentSize>
        {({ width, height }) => (
          <ChartInner width={Math.max(640, width)} height={height} />
        )}
      </ParentSize>
    </div>
  );
};

export default RegionYearRecipeChart;

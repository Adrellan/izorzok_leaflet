import React from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { Bar } from '@visx/shape';

type DataPoint = {
  name: string;
  count: number;
};

type Props = {
  data: DataPoint[];
};

const RegionCountCharts: React.FC<Props> = ({ data }) => {
  const ChartInner = ({ width, height }: { width: number; height: number }) => {
    const margin = { top: 20, right: 40, bottom: 40, left: 220 } as const;
    const xMax = Math.max(0, width - margin.left - margin.right);
    const yMax = Math.max(0, height - margin.top - margin.bottom);

    const names = data.map((d) => d.name);
    const max = Math.max(1, ...data.map((d) => d.count));

    const x = scaleLinear<number>({ domain: [0, max], range: [0, xMax], nice: true });
    const y = scaleBand<string>({ domain: names, range: [0, yMax], padding: 0.2 });

    const axisColor = '#94a3b8';

    if (!data.length) {
      return (
        <svg width={width} height={height}>
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#e2e8f0">
            Nincs adat
          </text>
        </svg>
      );
    }

    return (
      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {data.map((d) => {
            const barWidth = x(d.count);
            const barY = y(d.name) ?? 0;
            const barHeight = y.bandwidth();
            return (
              <Group key={`bar-${d.name}`}>
                <Bar x={0} y={barY} width={barWidth} height={barHeight} fill="#38bdf8" />
                <text 
                  x={barWidth + 6} 
                  y={barY + barHeight / 2} 
                  fill="#e2e8f0" 
                  dominantBaseline="middle" 
                  fontSize={12}
                >
                  {d.count}
                </text>
              </Group>
            );
          })}
          <AxisBottom 
            top={yMax} 
            scale={x} 
            stroke={axisColor} 
            tickStroke={axisColor} 
            tickLabelProps={() => ({ fill: '#e2e8f0', fontSize: 12, textAnchor: 'middle' })} 
          />
        </Group>
        <Group left={margin.left} top={margin.top}>
          <AxisLeft 
            scale={y} 
            stroke={axisColor} 
            tickStroke={axisColor}
            hideTicks={false}
            hideAxisLine={false}
            numTicks={data.length}
            tickFormat={(value) => value}
            tickLabelProps={() => ({ 
              fill: '#e2e8f0', 
              fontSize: 12, 
              textAnchor: 'end',
              dx: -8,
              dy: 3
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
          <ChartInner width={Math.max(640, width)} height={Math.max(400, height)} />
        )}
      </ParentSize>
    </div>
  );
};

export default RegionCountCharts;
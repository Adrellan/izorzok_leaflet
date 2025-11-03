import React, { useEffect, useMemo, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import * as d3 from 'd3';
import { useMapviewer } from '../hooks/useMapViewer';

type Props = {
  visible: boolean;
  onHide: () => void;
};

const StatsDialog: React.FC<Props> = ({ visible, onHide }) => {
  const { regions, settlements } = useMapviewer();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Build dataset: settlements count per region
  const dataset = useMemo(() => {
    if (!regions?.length || !settlements?.length) return [] as { name: string; count: number }[];
    const byRegion = new Map<number, number>();
    for (const s of settlements) {
      const rid = (s.regionid ?? -1) as number;
      if (rid === -1) continue;
      byRegion.set(rid, (byRegion.get(rid) || 0) + 1);
    }
    return regions
      .map((r) => ({ name: r.name ?? `Regio ${r.id}`, count: byRegion.get(r.id) || 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => d3.descending(a.count, b.count));
  }, [regions, settlements]);

  useEffect(() => {
    if (!visible) return;

    const draw = () => {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();

      const parent = (svgEl.parentElement as HTMLElement) || svgEl;
      const rect = parent.getBoundingClientRect();
      let width = Math.max(600, Math.floor(rect.width)) || 800;
      let height = Math.max(300, Math.floor(rect.height)) || 400;
      if (height <= 0 || !Number.isFinite(height)) {
        const approx = 24 * Math.max(1, dataset.length) + 120;
        height = Math.max(320, approx);
      }

      const margin = { top: 24, right: 24, bottom: 48, left: 140 } as const;
      const innerW = Math.max(0, width - margin.left - margin.right);
      const minBarsH = Math.max(1, dataset.length) * 22;
      const innerH = Math.max(minBarsH, height - margin.top - margin.bottom);

      svg.attr('viewBox', `0 0 ${width} ${height}`);

      if (!dataset.length) {
        svg
          .append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#e2e8f0')
          .style('font-size', '16px')
          .text('Nincs adat a kivalasztashoz');
        return;
      }

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const y = d3
        .scaleBand<string>()
        .domain(dataset.map((d) => d.name))
        .range([0, innerH])
        .padding(0.2);

      const x = d3
        .scaleLinear()
        .domain([0, d3.max(dataset, (d) => d.count)!])
        .nice()
        .range([0, innerW]);

      const axisColor = '#94a3b8';

      const yAxis = g.append('g').call(d3.axisLeft(y));
      yAxis.selectAll('text').attr('fill', '#e2e8f0').style('font-size', '14px');
      yAxis.selectAll('.domain,line').attr('stroke', axisColor);

      const xAxis = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat((d) => String(d)));
      xAxis.selectAll('text').attr('fill', '#e2e8f0').style('font-size', '14px');
      xAxis.selectAll('.domain,line').attr('stroke', axisColor);

      g
        .selectAll('.bar')
        .data(dataset)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', (d) => y(d.name)!)
        .attr('width', (d) => x(d.count))
        .attr('height', y.bandwidth())
        .attr('fill', '#38bdf8');

      g
        .selectAll('.label')
        .data(dataset)
        .enter()
        .append('text')
        .attr('x', (d) => x(d.count) + 6)
        .attr('y', (d) => y(d.name)! + y.bandwidth() / 2)
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#e2e8f0')
        .style('font-size', '14px')
        .text((d) => d.count);
    };

    const raf = requestAnimationFrame(draw);
    const onResize = () => requestAnimationFrame(draw);
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [dataset, visible]);

  return (
    <Dialog
      header="Statisztikak"
      visible={visible}
      onHide={onHide}
      modal
      className="dashboard-dialog"
      contentStyle={{ height: 'calc(100vh - 56px)', padding: 0 }}
    >
      <div style={{ 
        width: '100%', 
        height: '100%', 
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h3 style={{ marginBottom: 24, color: '#e2e8f0', fontSize: '20px' }}>
          Bejárt helyszínek régiónként
        </h3>
        <svg ref={svgRef} style={{ width: '100%', maxWidth: '900px', height: '600px' }} />
      </div>
    </Dialog>
  );
};

export default StatsDialog;

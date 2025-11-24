import React, { useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { Button } from 'primereact/button';
import { useMapviewer } from '../hooks/useMapViewer';
import { useAppSelector } from '../hooks/hooks';
import RegionCountCharts from './charts/RegionCountCharts';
import RegionMostCommonCategoryChart, { type RegionCategoryChartDatum } from './charts/RegionMostCommonCategoryChart';
import RegionYearRecipeChart from './charts/RegionYearRecipeChart';
import ChartCard from './ChartCard';
import './StatsDialog.css';
import type { RecipeListItem } from '../config/api/api';

type Props = {
  visible: boolean;
  onHide: () => void;
};

const StatsDialog: React.FC<Props> = ({ visible, onHide }) => {
  const { regions, settlements } = useMapviewer();
  const settlementRecipes = useAppSelector(
    (s) => (s.map as any).settlementRecipes as Record<number, RecipeListItem[]>
  );
  const categoryMap = useAppSelector(
    (s) => (s.map as any).categoryMap as Record<number, string>
  );
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const regionData = useMemo(() => {
    if (!regions?.length || !settlements?.length) return [];

    const byRegion = new Map<number, number>();
    for (const s of settlements) {
      const rid = (s.regionid ?? -1) as number;
      if (rid === -1) continue;
      byRegion.set(rid, (byRegion.get(rid) || 0) + 1);
    }

    const uniqueRegions = new Map<number, (typeof regions)[number]>();
    for (const r of regions) {
      if (!uniqueRegions.has(r.id)) {
        uniqueRegions.set(r.id, r);
      }
    }

    const data = Array.from(uniqueRegions.values())
      .map((r) => ({
        name: r.name ?? `Regio ${r.id}`,
        count: byRegion.get(r.id) || 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    return data;
  }, [regions, settlements]);

  const regionYearData = useMemo<RegionCategoryChartDatum[]>(() => {
    if (!regions?.length || !settlements?.length) return [];

    const regionIdToName = new Map<number, string>();
    regions.forEach((r) => {
      if (typeof r.id === 'number') {
        regionIdToName.set(r.id, r.name ?? `Regio ${r.id}`);
      }
    });

    const settlementInfo = new Map<number, { regionId: number; name: string }>();
    settlements.forEach((s) => {
      const sid = s.id;
      if (!Number.isFinite(sid)) return;
      const regionId = typeof s.regionid === 'number' ? s.regionid : -1;
      settlementInfo.set(sid, {
        regionId,
        name: s.name ?? `Telepules ${sid}`,
      });
    });

    const aggregated = new Map<string, RegionCategoryChartDatum>();
    for (const [sidKey, list] of Object.entries(settlementRecipes || {})) {
      const sid = Number(sidKey);
      if (!Number.isFinite(sid)) continue;
      const settlement = settlementInfo.get(sid);
      if (!settlement) continue;
      const regionId = settlement.regionId;
      if (!Number.isFinite(regionId)) continue;
      const regionName = regionIdToName.get(regionId) ?? `Regio ${regionId}`;

      for (const entry of list || []) {
        const rawYear = (entry as any)?.year;
        const year = typeof rawYear === 'number' ? rawYear : Number(rawYear);
        if (!Number.isFinite(year)) continue;
        const rawCategory = (entry as any)?.category_id;
        const categoryId =
          typeof rawCategory === 'number'
            ? rawCategory
            : typeof rawCategory === 'string'
            ? Number(rawCategory)
            : Number.NaN;
        if (!Number.isFinite(categoryId)) continue;
        const categoryName = categoryMap?.[categoryId] ?? `Kategória ${categoryId}`;
        const key = `${year}|${regionId}|${sid}|${categoryId}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          aggregated.set(key, {
            year,
            region: regionName,
            regionId,
            settlementId: sid,
            settlementName: settlement.name,
            categoryId,
            categoryName,
            count: 1,
          });
        }
      }
    }

    return Array.from(aggregated.values());
  }, [regions, settlements, settlementRecipes, categoryMap]);

  const renderGridView = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: '20px',
        padding: '20px',
        width: '100%',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <ChartCard
        title="Települések száma régiónként"
        onClick={() => setExpandedChart('region-settlements')}
      >
        <RegionCountCharts data={regionData} />
      </ChartCard>

      <ChartCard
        title="Receptek év/megye bontásban"
        onClick={() => setExpandedChart('year-region-recipes')}
      >
        <RegionYearRecipeChart data={regionYearData} />
      </ChartCard>

      <ChartCard
        title="Leggyakoribb kategóriák"
        onClick={() => setExpandedChart('category-most-common')}
      >
        <RegionMostCommonCategoryChart data={regionYearData} />
      </ChartCard>
    </div>
  );

  const renderExpandedView = () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e293b',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <Button
          icon="pi pi-arrow-left"
          label="Vissza"
          onClick={() => setExpandedChart(null)}
          className="p-button-text"
          style={{ color: '#e2e8f0' }}
        />
        <h3 style={{ color: '#e2e8f0', margin: 0 }}>
          {expandedChart === 'region-settlements' && 'Telep?l?sek sz?ma r?gi?nk?nt'}
          {expandedChart === 'year-region-recipes' && 'Receptek ?v/megye bont?sban'}
          {expandedChart === 'category-most-common' && 'Leggyakoribb kategóriák'}
        </h3>
        <div style={{ width: '100px' }} />
      </div>

      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {expandedChart === 'region-settlements' && <RegionCountCharts data={regionData} />}
        {expandedChart === 'year-region-recipes' && (
          <RegionYearRecipeChart data={regionYearData} />
        )}
        {expandedChart === 'category-most-common' && (
          <RegionMostCommonCategoryChart data={regionYearData} />
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      header="Statisztikák"
      visible={visible}
      onHide={onHide}
      modal
      className="dashboard-dialog stats-dialog"
      contentStyle={{
        height: 'calc(100vh - 120px)',
        padding: 0,
        backgroundColor: '#1e293b',
      }}
      style={{ width: '90vw', maxWidth: '1400px' }}
    >
      <div
        className="stats-tabview-wrapper"
        style={{ height: '100%', backgroundColor: '#1e293b' }}
      >
        <TabView style={{ height: '100%', backgroundColor: '#1e293b' }}>
          <TabPanel header="Vármegyei statisztikák" style={{ backgroundColor: '#1e293b' }}>
            <div
              style={{
                width: '100%',
                height: 'calc(100vh - 240px)',
                backgroundColor: '#1e293b',
                overflow: 'hidden',
              }}
            >
              {expandedChart ? renderExpandedView() : renderGridView()}
            </div>
          </TabPanel>
          <TabPanel header="Recept statisztikák" style={{ backgroundColor: '#1e293b' }}>
            <div
              style={{
                width: '100%',
                height: 'calc(100vh - 240px)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1e293b',
              }}
            >
              <p style={{ color: '#94a3b8', fontSize: '16px' }}>
                Recept statisztikák hamarosan...
              </p>
            </div>
          </TabPanel>
        </TabView>
      </div>
    </Dialog>
  );
};

export default StatsDialog;

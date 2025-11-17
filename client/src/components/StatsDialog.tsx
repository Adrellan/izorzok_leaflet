import React, { useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { Button } from 'primereact/button';
import { useMapviewer } from '../hooks/useMapViewer';
import RegionCharts from './charts/RegionCountCharts';
import ChartCard from './ChartCard';
import './StatsDialog.css';
import RegionCountCharts from './charts/RegionCountCharts';

type Props = {
  visible: boolean;
  onHide: () => void;
};

const StatsDialog: React.FC<Props> = ({ visible, onHide }) => {
  const { regions, settlements } = useMapviewer();
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  const regionData = useMemo(() => {
    if (!regions?.length || !settlements?.length) return [];
    
    const byRegion = new Map<number, number>();
    for (const s of settlements) {
      const rid = (s.regionid ?? -1) as number;
      if (rid === -1) continue;
      byRegion.set(rid, (byRegion.get(rid) || 0) + 1);
    }
    
    const uniqueRegions = new Map<number, typeof regions[0]>();
    for (const r of regions) {
      if (!uniqueRegions.has(r.id)) {
        uniqueRegions.set(r.id, r);
      }
    }
    
    const data = Array.from(uniqueRegions.values())
      .map((r) => ({ 
        name: r.name ?? `Regio ${r.id}`, 
        count: byRegion.get(r.id) || 0 
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
    
    return data;
  }, [regions, settlements]);

  const renderGridView = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
      gap: '20px',
      padding: '20px',
      width: '100%',
      height: '100%',
      overflow: 'auto'
    }}>
      <ChartCard 
        title="Települések száma régiónként"
        onClick={() => setExpandedChart('region-settlements')}
      >
        <RegionCountCharts data={regionData} />
      </ChartCard>
      
      {/* További chart card-ok ide jönnek */}
      <ChartCard 
        title="Másik statisztika"
        onClick={() => setExpandedChart('other-stat')}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8'
        }}>
          Hamarosan...
        </div>
      </ChartCard>
    </div>
  );

  const renderExpandedView = () => (
    <div style={{ 
      width: '100%', 
      height: '100%',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e293b'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <Button 
          icon="pi pi-arrow-left" 
          label="Vissza"
          onClick={() => setExpandedChart(null)}
          className="p-button-text"
          style={{ color: '#e2e8f0' }}
        />
        <h3 style={{ color: '#e2e8f0', margin: 0 }}>
          {expandedChart === 'region-settlements' && 'Települések száma régiónként'}
          {expandedChart === 'other-stat' && 'Másik statisztika'}
        </h3>
        <div style={{ width: '100px' }} /> {/* Spacer for centering */}
      </div>
      
      <div style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        {expandedChart === 'region-settlements' && <RegionCharts data={regionData} />}
        {expandedChart === 'other-stat' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: '#94a3b8'
          }}>
            Hamarosan...
          </div>
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
      contentStyle={{ height: 'calc(100vh - 120px)', padding: 0, backgroundColor: '#1e293b' }}
      style={{ width: '90vw', maxWidth: '1400px' }}
    >
      <div className="stats-tabview-wrapper" style={{ height: '100%', backgroundColor: '#1e293b' }}>
        <TabView style={{ height: '100%', backgroundColor: '#1e293b' }}>
          <TabPanel header="Vármegyei statisztikák" style={{ backgroundColor: '#1e293b' }}>
            <div style={{ 
              width: '100%', 
              height: 'calc(100vh - 240px)', 
              backgroundColor: '#1e293b',
              overflow: 'hidden'
            }}>
              {expandedChart ? renderExpandedView() : renderGridView()}
            </div>
          </TabPanel>
          <TabPanel header="Recept statisztikák" style={{ backgroundColor: '#1e293b' }}>
            <div style={{ 
              width: '100%', 
              height: 'calc(100vh - 240px)', 
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1e293b'
            }}>
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
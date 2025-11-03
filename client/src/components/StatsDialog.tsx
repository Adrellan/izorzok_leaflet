import React, { useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { useMapviewer } from '../hooks/useMapViewer';
import RegionCharts from './RegionCharts';
import './StatsDialog.css';

type Props = {
  visible: boolean;
  onHide: () => void;
};

const StatsDialog: React.FC<Props> = ({ visible, onHide }) => {
  const { regions, settlements } = useMapviewer();

  const regionData = useMemo(() => {
    if (!regions?.length || !settlements?.length) return [];
    
    // Számoljuk meg a településeket régiónként
    const byRegion = new Map<number, number>();
    for (const s of settlements) {
      const rid = (s.regionid ?? -1) as number;
      if (rid === -1) continue;
      byRegion.set(rid, (byRegion.get(rid) || 0) + 1);
    }
    
    // Deduplikáljuk a régiókat ID alapján
    const uniqueRegions = new Map<number, typeof regions[0]>();
    for (const r of regions) {
      if (!uniqueRegions.has(r.id)) {
        uniqueRegions.set(r.id, r);
      }
    }
    
    // Készítsük el az adathalmazt
    const data = Array.from(uniqueRegions.values())
      .map((r) => ({ 
        name: r.name ?? `Regio ${r.id}`, 
        count: byRegion.get(r.id) || 0 
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
    
    return data;
  }, [regions, settlements]);

  return (
    <Dialog
      header="Statisztikák"
      visible={visible}
      onHide={onHide}
      modal
      className="dashboard-dialog stats-dialog"
      contentStyle={{ height: 'calc(100vh - 120px)', padding: 0, backgroundColor: '#1e293b' }}
      style={{ width: '90vw', maxWidth: '1200px', textAlign: 'center' }}
    >
      <div className="stats-tabview-wrapper" style={{ height: '100%', backgroundColor: '#1e293b' }}>
        <TabView style={{ height: '100%', backgroundColor: '#1e293b' }}>
          <TabPanel header="Vármegyei statisztikák" style={{ backgroundColor: '#1e293b' }}>
            <div style={{ 
              width: '100%', 
              height: 'calc(100vh - 240px)', 
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#1e293b'
            }}>
              <h3 style={{ marginBottom: 12, color: '#e2e8f0' }}>
                Települések száma régiónként
              </h3>
              <div style={{ width: '100%', height: 'calc(100% - 44px)', maxWidth: '1100px' }}>
                <RegionCharts data={regionData} />
              </div>
            </div>
          </TabPanel>
          <TabPanel header="Recept statisztikák" style={{ backgroundColor: '#1e293b' }}>
            
          </TabPanel>
        </TabView>
      </div>
    </Dialog>
  );
};

export default StatsDialog;
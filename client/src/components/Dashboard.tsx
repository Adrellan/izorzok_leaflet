import { useState } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import { Button } from 'primereact/button';
import './Dashboard.css';
import { useDashboard } from '../hooks/useDashboard';
import StatsDialog from './StatsDialog';

export default function Dashboard() {
  const [statsOpen, setStatsOpen] = useState(false);

  const asideStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    height: '100vh',
    width: '320px',
    background: '#0f172a',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #1f2937',
    overflow: 'hidden',
  };

  const brandStyle: React.CSSProperties = {
    padding: '16px 20px 5px 20px',
    fontWeight: 600,
    fontSize: 18,
    borderBottom: '1px solid #1f2937',
  };

  const selectWrapStyle: React.CSSProperties = {
    padding: '12px 8px',
  };

  const {
    regionOptions,
    settlementOptions,
    selectedRegionIds,
    selectedSettlementIds,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
  } = useDashboard();

  return (
    <aside style={asideStyle}>
      <div style={brandStyle}>Ízőrzők</div>
      <div style={selectWrapStyle}>
        <div style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 12 }}>Régiók</div>
        <div style={{ padding: '0 8px 12px 8px' }}>
          <MultiSelect
            options={regionOptions}
            value={selectedRegionIds}
            onChange={(e) => handleRegionSelectionChange(e.value || [])}
            optionLabel="label"
            optionValue="value"
            display="chip"
            placeholder="Válassz régiókat..."
            filter
            panelClassName="route-ms-panel"
            className="route-ms w-full"
          />
        </div>

        <div style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 12 }}>Települések</div>
        <div style={{ padding: '0 8px' }}>
          <MultiSelect
            options={settlementOptions}
            value={selectedSettlementIds}
            onChange={(e) => handleSettlementSelectionChange(e.value || [])}
            optionLabel="label"
            optionValue="value"
            display="chip"
            placeholder="Válassz településeket..."
            filter
            panelClassName="route-ms-panel"
            className="route-ms w-full"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, padding: '0 8px' }}>
          <Button
            type="button"
            label="Vármegyei statisztikák"
            className="w-full custom-sidebar-button"
            onClick={() => setStatsOpen(true)}
          />
          <Button
            type="button"
            label="Receptek"
            className="w-full custom-sidebar-button"
          />
        </div>
      </div>

      <StatsDialog visible={statsOpen} onHide={() => setStatsOpen(false)} />
    </aside>
  );
}

import { useState } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import { Dropdown } from 'primereact/dropdown';
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
    categoryOptions,
    selectedRegionIds,
    selectedSettlementIds,
    selectedCategory,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
    handleCategorySelectionChange,
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

        <div style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 12, marginTop: '10px' }}>Kategóriák</div>
        <div style={{ padding: '0 8px' }}>
          <Dropdown
            options={categoryOptions}
            value={selectedCategory}
            onChange={(e) => handleCategorySelectionChange(e.value ?? null)}
            optionLabel="label"
            optionValue="value"
            placeholder="Válassz kategóriát"
            className="route-ms w-full"
            filter
            panelClassName="route-ms-panel"
          />
        </div>

        <Button
          type="button"
          label="Vármegyei statisztikák"
          className="w-full custom-sidebar-button"
          style={{ "marginTop": "3vh" }}
          onClick={() => setStatsOpen(true)}
        />

      </div>

      <StatsDialog visible={statsOpen} onHide={() => setStatsOpen(false)} />
    </aside>
  );
}

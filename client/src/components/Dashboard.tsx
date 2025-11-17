import { useState } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import { Chips } from 'primereact/chips';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import './Dashboard.css';
import { useDashboard } from '../hooks/useDashboard';
import StatsDialog from './StatsDialog';
import { useAppDispatch, useAppSelector } from '../hooks/hooks';
import { toggleHeatmap } from '../store/map/map.store';

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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const selectWrapStyle: React.CSSProperties = {
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  };

  const {
    regionOptions,
    settlementOptions,
    categoryOptions,
    yearOptions,
    selectedRegionIds,
    selectedSettlementIds,
    selectedCategory,
    selectedYear,
    ingredients,
    ingredientsReverse,
    recipes,
    recipeCount,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
    handleCategorySelectionChange,
    handleYearSelectionChange,
    handleIngredientsChange,
    toggleIngredientsReverse,
  } = useDashboard();

  const dispatch = useAppDispatch();
  const heatmapEnabled = useAppSelector((s) => s.map.heatmapEnabled);

  return (
    <aside style={asideStyle}>
      <div style={brandStyle}>
        <span>Ízőrzők</span>
        <button
          type="button"
          aria-pressed={heatmapEnabled}
          aria-label="Hőtérkép kapcsoló"
          className={`brand-toggle ${heatmapEnabled ? 'active' : ''}`}
          onClick={() => dispatch(toggleHeatmap())}
        >
          <span className="brand-toggle-icon" />
        </button>
      </div>

      <div style={selectWrapStyle}>
        <div style={{ flexShrink: 0 }}>
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

          <div style={{ padding: '6px 12px', color: '#94a3b8', fontSize: 12, marginTop: '10px' }}>Évek</div>
          <div style={{ padding: '0 8px' }}>
            <Dropdown
              options={yearOptions}
              value={selectedYear}
              onChange={(e) => handleYearSelectionChange(e.value ?? null)}
              optionLabel="label"
              optionValue="value"
              placeholder="Válassz évet"
              className="route-ms w-full"
              filter
              panelClassName="route-ms-panel"
            />
          </div>

          <div
            style={{
              padding: '6px 12px',
              color: '#94a3b8',
              fontSize: 12,
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>Hozzávalók</span>
            <button
              type="button"
              onClick={toggleIngredientsReverse}
              aria-pressed={ingredientsReverse}
              aria-label="Hozzávalók szűrésének megfordítása"
              style={{
                border: 'none',
                background: ingredientsReverse ? '#f97316' : 'transparent',
                color: ingredientsReverse ? '#0f172a' : '#f97316',
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              REV
            </button>
          </div>
          <div style={{ padding: '0 8px' }}>
            <Chips
              value={ingredients}
              onChange={(e) => handleIngredientsChange(e.value || [])}
              placeholder="Gépeljen, majd nyomjon entert"
              allowDuplicate={false}
              className="route-ms w-full"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            background: '#020617',
            borderRadius: 8,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '4px 4px 6px 4px', color: '#94a3b8', fontSize: 12 }}>
            Receptek{typeof recipeCount === 'number' ? ` (${recipeCount})` : ''}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
            {recipes && recipes.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {recipes.map((r, idx) => {
                  const title = r.title ?? r.url ?? 'Ismeretlen recept';
                  const url = r.url;
                  return (
                    <li
                      key={`${url ?? 'recipe'}-${idx}`}
                      onDoubleClick={() => {
                        if (url) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        marginBottom: 4,
                        borderRadius: 6,
                        background: '#020617',
                        border: '1px solid #1e293b',
                        cursor: url ? 'pointer' : 'default',
                        fontSize: 12,
                        color: '#e2e8f0',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                      }}
                      title={url ? `${title} – duplakatt: megnyitás` : title}
                    >
                      {title}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div style={{ fontSize: 12, color: '#64748b', padding: '4px 8px' }}>
                Nincs recept a szűrők alapján.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 8px 16px 8px' }}>
        <Button
          type="button"
          label="Vármegyei statisztikák"
          className="w-full custom-sidebar-button"
          onClick={() => setStatsOpen(true)}
        />
      </div>

      <StatsDialog visible={statsOpen} onHide={() => setStatsOpen(false)} />
    </aside>
  );
}
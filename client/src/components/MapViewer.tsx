import React, { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import { useMapviewer } from '../hooks/useMapViewer';
import { MapZoomHandler } from './MapZoomHandler';
import { useMapStatePersist } from '../hooks/useMapStatePersist';
import { useAppSelector } from '../hooks/hooks';

// Fix Leaflet default marker icon issue
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapViewer: React.FC = () => {
  useMapStatePersist();
  
  const { coordinates, zoom, regions, settlements }  = useMapviewer();
  const choroplethRenderer = useMemo(() => {
    try { return L.svg({ pane: 'choropleth' }); } catch { return undefined as any; }
  }, []);
  const heatmapEnabled = useAppSelector((s) => s.map.heatmapEnabled);
  const regionCounts = useAppSelector((s) => s.map.regionCounts);
  const selectedCategoryId = useAppSelector((s) => s.map.selectedCategoryId);
  const selectedYear = useAppSelector((s) => s.map.selectedYear);
  const categoryMap = useAppSelector((s) => (s.map as any).categoryMap as Record<number, string>);
  const settlementCounts = useAppSelector((s) => (s.map as any).settlementCounts as Record<number, number>);

  const featureCollection = useMemo(() => {
    const features = (regions ?? [])
      .filter(r => r.geom)
      .map((r) => ({
        type: 'Feature',
        geometry: r.geom as any,
        properties: { id: r.id, name: r.name ?? '' },
      }));

    return {
      type: 'FeatureCollection',
      features,
    } as any;
  }, [regions]);

  const geoJsonKey = useMemo(() => {
    return (regions ?? []).map(r => r.id).join(',') || 'empty';
  }, [regions]);

  const rcKey = useMemo(() => {
    const entries = Object.entries(regionCounts || {}).sort(([a],[b]) => Number(a) - Number(b));
    return entries.map(([k,v]) => `${k}:${v}`).join('|') || 'none';
  }, [regionCounts]);

  // Heatmap color scale setup
  const heatmapMeta = useMemo(() => {
    if (!heatmapEnabled || !regionCounts) return null as null | { bins: number[]; colors: string[]; min: number; max: number };
    const values = Object.values(regionCounts || {}).filter((v) => typeof v === 'number' && v > 0) as number[];
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins: number[] = [];
    if (min !== max) {
      const step = (max - min) / 5;
      for (let i = 1; i <= 5; i++) bins.push(Math.round(min + i * step));
    } else {
      bins.push(min);
    }
    const colors = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
    return { bins, colors, min, max };
  }, [heatmapEnabled, regionCounts]);

  const getFillForRegion = (id?: number) => {
    if (!id) return { fill: false, fillColor: undefined, fillOpacity: 0 };
    if (!heatmapMeta || !heatmapEnabled) {
      // keep clickable interior with nearly invisible fill (SVG needs >0 to receive events)
      return { fill: true, fillColor: '#000000', fillOpacity: 0.001 };
    }
    const v = regionCounts?.[id] ?? 0;
    if (!(typeof v === 'number') || v <= 0) {
      // clickable but visually invisible
      return { fill: true, fillColor: '#000000', fillOpacity: 0.001 };
    }
    const { bins, colors } = heatmapMeta;
    let colorIdx: number;
    if (heatmapMeta.min === heatmapMeta.max) {
      colorIdx = colors.length - 1;
    } else {
      let idx = 0;
      while (idx < bins.length && v > bins[idx]) idx++;
      colorIdx = Math.min(idx, colors.length - 1);
    }
    const color = colors[colorIdx];
    return { fill: true, fillColor: color, fillOpacity: 0.7 };
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={zoom}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {featureCollection.features?.length ? (
            <Pane name="choropleth" style={{ zIndex: 350 }}>
              <GeoJSON pane="choropleth" interactive
                key={`${geoJsonKey}-${rcKey}-${selectedCategoryId ?? 'cnull'}-${selectedYear ?? 'ynull'}`}
                data={featureCollection as any}
                style={(feature: any) => {
                  const id = (feature?.properties?.id as number) || undefined;
                  const heat = getFillForRegion(id);
                  return {
                    color: '#000000ff',
                    weight: 1.5,
                    fill: heat.fill,
                    fillOpacity: heat.fillOpacity,
                    fillColor: heat.fillColor,
                    className: 'region-polygon',
                    interactive: true,
                  } as L.PathOptions;
                }}
                onEachFeature={(feature: any, layer: L.Layer) => {
                  const rid = (feature?.properties?.id as number) || undefined;
                  if (!rid) return;
                  const count = regionCounts?.[rid] ?? 0;
                  const parts: string[] = [];
                  if (selectedCategoryId != null) {
                    const cname = categoryMap?.[selectedCategoryId] ?? `Kategória ${selectedCategoryId}`;
                    parts.push(`${cname}`);
                  }
                  if (selectedYear != null) parts.push(`${selectedYear}`);
                  const filtersText = parts.length > 0 ? parts.join(', ') : 'nincs';
                  const html = `<div style="font-size:12px;line-height:1.3">
                      <div><strong>Receptek:</strong> ${count}</div>
                      <div><strong>Szűrők:</strong> ${filtersText}</div>
                    </div>`;
                  (layer as any).bindPopup(html, { maxWidth: 240, autoPan: true, className: 'region-popup' });
                  try {
                    (layer as any).options.interactive = true;
                    const el = (layer as any).getElement?.();
                    if (el) {
                      (el as HTMLElement).style.pointerEvents = 'auto';
                      (el as HTMLElement).style.cursor = 'pointer';
                      el.classList?.add('region-polygon');
                    }
                    (layer as any).on('click', () => (layer as any).openPopup?.());
                    (layer as any).on('mouseover', (e: any) => {
                      try {
                        const map = e && e.target && e.target._map ? e.target._map : null;
                        const el = map && typeof map.getContainer === 'function' ? map.getContainer() : null;
                        if (el) { (el as HTMLElement).style.cursor = 'pointer'; }
                      } catch {}
                    });
                    (layer as any).on('mouseout', (e: any) => {
                      try {
                        const map = e && e.target && e.target._map ? e.target._map : null;
                        const el = map && typeof map.getContainer === 'function' ? map.getContainer() : null;
                        if (el) { (el as HTMLElement).style.cursor = ''; }
                      } catch {}
                    });
                  } catch {}
                }}
              />
            </Pane>
          ) : null}

          {settlements?.length ? (
            <Pane name="settlement-markers" style={{ zIndex: 450 }}>
              {settlements.map((s) => {
                const recipesHere = settlementCounts?.[s.id] ?? 0;
                if (!(typeof recipesHere === 'number') || recipesHere <= 0) {
                  return null; // hide settlements without any matching recipe
                }
                const g: any = s.geom as any;
                if (!g) return null;
                let lat: number | null = null;
                let lng: number | null = null;
                if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
                  lng = g.coordinates[0];
                  lat = g.coordinates[1];
                } else if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
                  let count = 0; let sumLat = 0; let sumLng = 0;
                  (g.coordinates as number[][]).forEach((ring: any) => {
                    (ring as number[][]).forEach((pt) => {
                      if (pt.length >= 2) { sumLng += pt[0]; sumLat += pt[1]; count++; }
                    });
                  });
                  if (count > 0) { lng = sumLng / count; lat = sumLat / count; }
                } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
                  let count = 0; let sumLat = 0; let sumLng = 0;
                  (g.coordinates as number[][][]).forEach((poly: any) => {
                    (poly as number[][]).forEach((ring: any) => {
                      (ring as number[][]).forEach((pt) => {
                        if (pt.length >= 2) { sumLng += pt[0]; sumLat += pt[1]; count++; }
                      });
                    });
                  });
                  if (count > 0) { lng = sumLng / count; lat = sumLat / count; }
                }
                if (lat == null || lng == null) return null;
                return (
                  <CircleMarker
                    key={`s-${s.id}`}
                    center={[lat, lng]}
                    radius={3}
                    pathOptions={{ color: '#e53935', weight: 1, fillColor: '#e57373', fillOpacity: 0.9 }}
                    eventHandlers={{
                      click: (e: any) => {
                        const count = recipesHere;
                        const parts: string[] = [];
                        if (selectedCategoryId != null) {
                          const cname = categoryMap?.[selectedCategoryId] ?? `Kategória ${selectedCategoryId}`;
                          parts.push(`${cname}`);
                        }
                        if (selectedYear != null) parts.push(`${selectedYear}`);
                        const filtersText = parts.length > 0 ? parts.join(', ') : 'nincs';
                        const html = `<div style=\"font-size:12px;line-height:1.3\">\n                          <div><strong>Receptek:</strong> ${count}</div>\n                          <div><strong>Szűrők:</strong> ${filtersText}</div>\n                        </div>`;
                        const map: any = e?.target?._map;
                        if (map) {
                          L.popup().setLatLng(e.latlng).setContent(html).openOn(map);
                        }
                      }
                    }}
                  >
                    <Tooltip>{s.name ?? `Település ${s.id}`}</Tooltip>
                  </CircleMarker>
                );
              })}
            </Pane>
          ) : null}

          <MapZoomHandler />
        </MapContainer>
        {/* Legend overlay */}
        {heatmapEnabled && heatmapMeta ? (
          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #1f2937',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              zIndex: 1000,
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Jelmagyarázat</div>
            {(heatmapMeta.min === heatmapMeta.max)
              ? (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 14, height: 14, background: heatmapMeta.colors[heatmapMeta.colors.length - 1], display: 'inline-block', border: '1px solid #1f2937', marginRight: 6 }} />
                  <span>{heatmapMeta.min}</span>
                </div>
              )
              : heatmapMeta.colors.map((c, i) => {
                  if (i >= heatmapMeta.bins.length) return null;
                  const from = i === 0 ? (heatmapMeta.min) : (heatmapMeta.bins[i - 1] + 1);
                  const to = heatmapMeta.bins[i];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ width: 14, height: 14, background: c, display: 'inline-block', border: '1px solid #1f2937', marginRight: 6 }} />
                      <span>{from} – {to}</span>
                    </div>
                  );
                })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MapViewer;

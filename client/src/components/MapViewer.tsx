import React, { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import { useMapviewer } from '../hooks/useMapViewer';
import { MapZoomHandler } from './MapZoomHandler';
import { useMapStatePersist } from '../hooks/useMapStatePersist';

// Fix Leaflet default marker icon issue
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapViewer: React.FC = () => {
  useMapStatePersist();
  
  const { coordinates, zoom, regions, settlements }  = useMapviewer();

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

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={zoom}
          preferCanvas
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {featureCollection.features?.length ? (
            <GeoJSON
              key={geoJsonKey}
              data={featureCollection as any}
              style={() => ({
                color: '#000000ff',
                weight: 2,
                fill: false,
              })}
              // onEachFeature={(feature, layer) => {
              //   const name = (feature?.properties as any)?.name ?? '';
              //   if (name) {
              //     layer.bindTooltip(name);
              //   }
              // }}
            />
          ) : null}

          {settlements?.length ? (
            <>
              {settlements.map((s) => {
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
                  >
                    <Tooltip>{s.name ?? `Település ${s.id}`}</Tooltip>
                  </CircleMarker>
                );
              })}
            </>
          ) : null}

          <MapZoomHandler />
        </MapContainer>
      </div>
    </div>
  );
};

export default MapViewer;

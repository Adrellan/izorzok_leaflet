import { useMemo } from "react";
import { useAppSelector } from "./hooks";
import type { RegionWithGeom, SettlementWithGeom } from "../config/api/api";

export const useMapviewer = () => {
  const { coordinates, zoom, selectedRegionIds, selectedSettlementIds } = useAppSelector((state) => state.map);
  const allRegions = useAppSelector((state) => state.geo.regions) as RegionWithGeom[];
  const allSettlements = useAppSelector((state) => state.geo.settlements) as SettlementWithGeom[];

  const regions = useMemo(() => {
    if (!allRegions) return [] as RegionWithGeom[];
    if (!selectedRegionIds || selectedRegionIds.length === 0) return allRegions;
    const allowed = new Set(selectedRegionIds);
    return allRegions.filter((r) => allowed.has(r.id));
  }, [allRegions, selectedRegionIds]);

  const settlements = useMemo(() => {
    if (!allSettlements) return [] as SettlementWithGeom[];
    if (selectedSettlementIds && selectedSettlementIds.length > 0) {
      const allowed = new Set(selectedSettlementIds);
      return allSettlements.filter((s) => allowed.has(s.id));
    }
    if (selectedRegionIds && selectedRegionIds.length > 0) {
      const allowedRegions = new Set(selectedRegionIds);
      return allSettlements.filter((s) => s.regionid != null && allowedRegions.has(s.regionid as number));
    }
    return allSettlements;
  }, [allSettlements, selectedRegionIds, selectedSettlementIds]);

  return {
    coordinates,
    zoom,
    regions,
    settlements,
  };
};

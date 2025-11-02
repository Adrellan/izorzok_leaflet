import { useEffect, useState } from "react";
import { useAppSelector } from "./hooks";
import { MapsApi } from "../config/api/api";
import type { RegionWithGeom, SettlementWithGeom } from "../config/api/api";

export const useMapviewer = () => {
  const { coordinates, zoom, selectedRegionIds, selectedSettlementIds } = useAppSelector((state) => state.map);
  const [regions, setRegions] = useState<RegionWithGeom[]>([]);
  const [settlements, setSettlements] = useState<SettlementWithGeom[]>([]);

  useEffect(() => {
    const api = new MapsApi();
    const regionIdsArg = (selectedRegionIds && selectedRegionIds.length > 0) ? selectedRegionIds : undefined;
    api.apiMapsRegionsGet(regionIdsArg)
      .then((res) => {
        setRegions(res.data ?? []);
      })
      .catch(() => {});
  }, [selectedRegionIds]);

  useEffect(() => {
    const api = new MapsApi();
    api.apiMapsSettlementsGet()
      .then((res) => {
        setSettlements(res.data ?? []);
      })
      .catch(() => {});
  }, []);

  return {
    coordinates,
    zoom,
    regions,
    settlements,
  };
};

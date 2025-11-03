import { useEffect, useState } from "react";
import { useAppSelector } from "./hooks";
import { MapsApi } from "../config/api/api";
import type { RegionWithGeom, SettlementWithGeom } from "../config/api/api";
import axios from "axios";
import { BASE_PATH } from "../config/api/base";

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
    const params: any = {};
    if (selectedRegionIds && selectedRegionIds.length > 0) {
      // send as CSV to match backend parsing
      params.regionId = selectedRegionIds.join(',');
    }
    if (selectedSettlementIds && selectedSettlementIds.length > 0) {
      // send as CSV to ensure backend parsing regardless of client serializer
      params.settlementid = selectedSettlementIds.join(',');
    }

    axios
      .get(`${BASE_PATH}/api/maps/settlements`, { params })
      .then((res) => setSettlements(res.data ?? []))
      .catch(() => {});
  }, [selectedRegionIds, selectedSettlementIds]);

  return {
    coordinates,
    zoom,
    regions,
    settlements,
  };
};

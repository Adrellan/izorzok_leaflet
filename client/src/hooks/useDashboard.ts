import { useEffect, useMemo, useState } from "react";
import { setSelectedRegionIds, setSelectedSettlementIds } from "../store/map/map.store";
import { useAppDispatch, useAppSelector } from "./hooks";
import { MapsApi } from "../config/api/api";
import type { RegionWithGeom, SettlementWithGeom } from "../config/api/api";

export const useDashboard = () => {
  const dispatch = useAppDispatch();
  const { selectedRegionIds, selectedSettlementIds } = useAppSelector((state) => state.map);
  const [regions, setRegions] = useState<RegionWithGeom[]>([]);
  const [settlements, setSettlements] = useState<SettlementWithGeom[]>([]);

  useEffect(() => {
    const api = new MapsApi();
    api.apiMapsRegionsGet()
      .then((res) => setRegions(res.data ?? []))
      .catch(() => {});
    api.apiMapsSettlementsGet()
      .then((res) => setSettlements(res.data ?? []))
      .catch(() => {});
  }, []);

  const regionOptions = useMemo(
    () => (regions ?? []).map((r) => ({ label: r.name ?? `Régió ${r.id}`, value: r.id })),
    [regions]
  );
  const settlementOptions = useMemo(
    () => (settlements ?? []).map((s) => ({ label: s.name ?? `Település ${s.id}`, value: s.id })),
    [settlements]
  );

  const handleRegionSelectionChange = (ids: number[]) => {
    dispatch(setSelectedRegionIds(ids));
  };

  const handleSettlementSelectionChange = (ids: number[]) => {
    dispatch(setSelectedSettlementIds(ids));
  };

  return {
    regionOptions,
    settlementOptions,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
    selectedRegionIds,
    selectedSettlementIds,
  };
};


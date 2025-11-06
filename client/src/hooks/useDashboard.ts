import { useEffect, useMemo, useRef, useState } from "react";
import { setSelectedRegionIds, setSelectedSettlementIds } from "../store/map/map.store";
import { useAppDispatch, useAppSelector } from "./hooks";
import { MapsApi, RecipesApi } from "../config/api/api";
import type { RegionWithGeom, SettlementWithGeom, Category, RecipeListItem } from "../config/api/api";
import { setRegions as setRegionsStore, setSettlements as setSettlementsStore } from "../store/geo/geo.store";

export const useDashboard = () => {
  const dispatch = useAppDispatch();
  const { selectedRegionIds, selectedSettlementIds } = useAppSelector((state) => state.map);
  const regions = useAppSelector((state) => state.geo.regions) as RegionWithGeom[];
  const settlements = useAppSelector((state) => state.geo.settlements) as SettlementWithGeom[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [recipeCount, setRecipeCount] = useState<number>(0);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const api = new MapsApi();
    if (!regions || regions.length === 0) {
      api.apiMapsRegionsGet()
        .then((res) => dispatch(setRegionsStore(res.data ?? [])))
        .catch(() => {});
    }
    if (!settlements || settlements.length === 0) {
      api.apiMapsSettlementsGet()
        .then((res) => dispatch(setSettlementsStore(res.data ?? [])))
        .catch(() => {});
    }
    // Load categories via generated client
    const recipesApi = new RecipesApi();
    recipesApi
      .apiRecipesCategoriesGet()
      .then((res) => setCategories(res.data ?? []))
      .catch(() => {});

    // Initial recipes will be loaded by the filter-driven effect
  }, []);

  // Refetch recipes when category, year, settlements or regions change
  const lastFilterRef = useRef<string>("__init__");
  useEffect(() => {
    // avoid duplicate fetches if effect runs twice with same value (dev strict/hmr)
    const key = `${selectedCategory ?? 'null'}|${selectedYear ?? 'null'}|${(selectedSettlementIds && selectedSettlementIds.length > 0) ? selectedSettlementIds.join(',') : 'none'}|${(selectedRegionIds && selectedRegionIds.length > 0) ? selectedRegionIds.join(',') : 'none'}`;
    if (lastFilterRef.current === key) return;
    lastFilterRef.current = key;
    const recipesApi = new RecipesApi();
    const categoryArg: number[] = selectedCategory != null ? [selectedCategory] : [];
    const yearArg: number[] = selectedYear != null ? [selectedYear] : [];
    // Use explicit settlements only; regionIds are forwarded as query param via options
    const settlementArg: number[] = (selectedSettlementIds && selectedSettlementIds.length > 0) ? selectedSettlementIds : [];
    const regionArg: number[] = (selectedRegionIds && selectedRegionIds.length > 0) ?selectedRegionIds : [];

    const handleData = (count: number | undefined, items: any[]) => {
      const list = items ?? [];
      setRecipeCount(count ?? 0);
      setRecipes(list);
      const distinctYears = Array.from(
        new Set(
          list
            .map((r: any) => r.year)
            .filter((y: any): y is number => typeof y === 'number' && Number.isFinite(y))
        )
      ).sort((a, b) => b - a);
      setYears(distinctYears);
    };

    const options: any = {};

    recipesApi
      .apiRecipesGet(regionArg, yearArg, settlementArg, categoryArg, options)
      .then((res) => handleData(res.data?.count, res.data?.items ?? []))
      .catch(() => {});
  }, [selectedCategory, selectedYear, selectedSettlementIds, selectedRegionIds]);

  const regionOptions = useMemo(
    () => (regions ?? []).map((r) => ({ label: r.name ?? `Régió ${r.id}`, value: r.id })),
    [regions]
  );
  const filteredSettlements = useMemo(() => {
    if (!settlements) return [] as SettlementWithGeom[];
    if (!selectedRegionIds || selectedRegionIds.length === 0) return settlements;
    const allowed = new Set(selectedRegionIds);
    return settlements.filter((s) => (s.regionid ?? -1) !== -1 && allowed.has(s.regionid as number));
  }, [settlements, selectedRegionIds]);

  const settlementOptions = useMemo(
    () => filteredSettlements.map((s) => ({ label: s.name ?? `Település ${s.id}`, value: s.id })),
    [filteredSettlements]
  );

  const categoryOptions = useMemo(
    () => [
      { label: 'Válassz kategóriát', value: null as number | null },
      ...((categories ?? []).map((c) => ({ label: c.name ?? `Kategória ${c.id}`, value: c.id })))
    ],
    [categories]
  );

  const yearOptions = useMemo(
    () => [
      { label: 'Válassz évet', value: null as number | null },
      ...years.map((y) => ({ label: String(y), value: y }))
    ],
    [years]
  );

  // Ensure selected settlements remain valid when region filter changes
  useEffect(() => {
    if (!selectedSettlementIds || selectedSettlementIds.length === 0) return;
    const allowedIds = new Set(filteredSettlements.map((s) => s.id));
    const next = selectedSettlementIds.filter((id) => allowedIds.has(id));
    if (next.length !== selectedSettlementIds.length) {
      dispatch(setSelectedSettlementIds(next));
    }
  }, [filteredSettlements]);

  const handleRegionSelectionChange = (ids: number[]) => {
    dispatch(setSelectedRegionIds(ids));
  };

  const handleSettlementSelectionChange = (ids: number[]) => {
    dispatch(setSelectedSettlementIds(ids));
  };

  const handleCategorySelectionChange = (id: number | null) => {
    setSelectedCategory(id);
  };

  const handleYearSelectionChange = (id: number | null) => {
    setSelectedYear(id);
  };

  return {
    regionOptions,
    settlementOptions,
    categoryOptions,
    yearOptions,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
    handleCategorySelectionChange,
    handleYearSelectionChange,
    selectedRegionIds,
    selectedSettlementIds,
    selectedCategory,
    selectedYear,
    recipes,
    recipeCount,
  };
};

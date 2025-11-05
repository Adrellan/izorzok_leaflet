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
    // Recipes are fetched by the category-driven effect to avoid duplicate calls on mount
  }, []);

  // Refetch recipes when category changes (via generated client)
  const lastCategoryRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    // avoid duplicate fetches if effect runs twice with same value (dev strict/hmr)
    if (lastCategoryRef.current === selectedCategory) return;
    lastCategoryRef.current = selectedCategory;
    const recipesApi = new RecipesApi();
    const categoryArg = selectedCategory != null ? [selectedCategory] : undefined;
    recipesApi
      .apiRecipesGet(undefined, undefined, categoryArg)
      .then((res) => {
        setRecipeCount(res.data?.count ?? 0);
        setRecipes(res.data?.items ?? []);
      })
      .catch(() => {});
  }, [selectedCategory]);

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

  return {
    regionOptions,
    settlementOptions,
    categoryOptions,
    handleRegionSelectionChange,
    handleSettlementSelectionChange,
    handleCategorySelectionChange,
    selectedRegionIds,
    selectedSettlementIds,
    selectedCategory,
    recipes,
    recipeCount,
  };
};

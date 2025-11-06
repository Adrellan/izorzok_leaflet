import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export function getLocalStorageData() {
	const data = localStorage.getItem('mapState');
	if (!data) return null;
	const parsed = JSON.parse(data);
	return parsed;
}

interface MapState {
	coordinates: {
		lat: number,
		lng: number,
	},
	zoom: number,
	selectedRegionIds: number[],
	selectedSettlementIds: number[],
  heatmapEnabled: boolean,
  regionCounts: Record<number, number>,
  selectedCategoryId: number | null,
  selectedYear: number | null,
  categoryMap: Record<number, string>,
  settlementCounts: Record<number, number>,
}


const defaults: MapState = {
	coordinates: {
		lat: 47.1625, // Magyarország középpontja
		lng: 19.5033, // Magyarország középpontja
	},
	zoom: 8,
	selectedRegionIds: [],
	selectedSettlementIds: [],
  heatmapEnabled: false,
  regionCounts: {},
  selectedCategoryId: null,
  selectedYear: null,
  categoryMap: {},
  settlementCounts: {},
};

const initialState: MapState = { ...defaults, ...(getLocalStorageData() || {}) };

export const mapSlice = createSlice({
	name: 'map',
	initialState,
	reducers: {
		setCoordinates(state, {payload}: PayloadAction<typeof initialState.coordinates>){
			state.coordinates = payload;
		},
		setZoom(state, { payload }: PayloadAction<number>) {
			state.zoom = payload;
		},
		setSelectedRegionIds(state, { payload }: PayloadAction<number[]>) {
			state.selectedRegionIds = payload;
		},
		setSelectedSettlementIds(state, { payload }: PayloadAction<number[]>) {
			state.selectedSettlementIds = payload;
		},
    setHeatmapEnabled(state, { payload }: PayloadAction<boolean>) {
      state.heatmapEnabled = payload;
    },
    toggleHeatmap(state) {
      state.heatmapEnabled = !state.heatmapEnabled;
    },
    setRegionCounts(state, { payload }: PayloadAction<Record<number, number>>) {
      state.regionCounts = payload || {};
    },
    setSelectedCategoryId(state, { payload }: PayloadAction<number | null>) {
      state.selectedCategoryId = payload ?? null;
    },
    setSelectedYear(state, { payload }: PayloadAction<number | null>) {
      state.selectedYear = payload ?? null;
    },
    setCategoryMap(state, { payload }: PayloadAction<Record<number, string>>) {
      state.categoryMap = payload || {};
    },
    setSettlementCounts(state, { payload }: PayloadAction<Record<number, number>>) {
      state.settlementCounts = payload || {};
    },
	},
})

export const { setCoordinates, setZoom, setSelectedRegionIds, setSelectedSettlementIds, setHeatmapEnabled, toggleHeatmap, setRegionCounts, setSelectedCategoryId, setSelectedYear, setCategoryMap, setSettlementCounts } = mapSlice.actions
export const mapReducer = mapSlice.reducer;

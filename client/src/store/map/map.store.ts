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
	},
})

export const { setCoordinates, setZoom, setSelectedRegionIds, setSelectedSettlementIds, setHeatmapEnabled, toggleHeatmap } = mapSlice.actions
export const mapReducer = mapSlice.reducer;

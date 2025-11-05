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
}


const initialState: MapState = getLocalStorageData() || {
	coordinates: {
		lat: 47.1625, // Magyarország középpontja
		lng: 19.5033, // Magyarország középpontja
	},
	zoom: 8,
	selectedRegionIds: [],
	selectedSettlementIds: [],
};

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
	},
})

export const { setCoordinates, setZoom, setSelectedRegionIds, setSelectedSettlementIds } = mapSlice.actions
export const mapReducer = mapSlice.reducer;

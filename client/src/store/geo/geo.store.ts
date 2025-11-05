import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RegionWithGeom, SettlementWithGeom } from '../../config/api/api'

interface GeoState {
  regions: RegionWithGeom[]
  settlements: SettlementWithGeom[]
}

const initialState: GeoState = {
  regions: [],
  settlements: [],
}

export const geoSlice = createSlice({
  name: 'geo',
  initialState,
  reducers: {
    setRegions(state, { payload }: PayloadAction<RegionWithGeom[]>) {
      state.regions = payload
    },
    setSettlements(state, { payload }: PayloadAction<SettlementWithGeom[]>) {
      state.settlements = payload
    },
  },
})

export const { setRegions, setSettlements } = geoSlice.actions
export const geoReducer = geoSlice.reducer


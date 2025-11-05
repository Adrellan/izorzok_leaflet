import { configureStore } from '@reduxjs/toolkit'
import { mapReducer } from './map/map.store'
import { geoReducer } from './geo/geo.store'

export const store = configureStore({
	reducer: {
		map: mapReducer,
		geo: geoReducer,
	},
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

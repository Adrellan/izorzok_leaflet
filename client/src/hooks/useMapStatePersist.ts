import { useEffect } from 'react'
import { useAppSelector } from './hooks';

export function useMapStatePersist() {
    const mapState = useAppSelector(state => state.map);
    useEffect(() => {
            const { settlementRecipes, ...rest } = mapState as any;
            const persistedMapState = { ...rest };
            localStorage.setItem('mapState', JSON.stringify(persistedMapState));
    }, [mapState]);
}

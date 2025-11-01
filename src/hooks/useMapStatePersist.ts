import { useEffect } from 'react'
import { useAppSelector } from './hooks';

export function useMapStatePersist() {
    const mapState = useAppSelector(state => state.map);
    useEffect(() => {
            const persistedMapState = { ...mapState };
            localStorage.setItem('mapState', JSON.stringify(persistedMapState));
    }, [mapState]);
}
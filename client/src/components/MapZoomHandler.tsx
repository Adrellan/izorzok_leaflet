import { useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { setCoordinates, setZoom } from "../store/map/map.store";
import { useAppDispatch } from "../hooks/hooks";

export const MapZoomHandler = () => {
    const map = useMap();
    const dispatch = useAppDispatch();

    const coords = useCallback(() => {
        const center = map.getCenter();
        dispatch(setCoordinates({ lat: center.lat, lng: center.lng }));
    }, [map, dispatch]); // 🔧 dispatch is függőség

    const zoom = useCallback(() => {
        const currentZoom = map.getZoom();
        dispatch(setZoom(currentZoom)); // Ha zoom kezelést is szeretnénk
    }, [map, dispatch]);

    useMapEvents({
        moveend: () => {
            coords();
        },
        zoomend: () => {
            zoom();
        }
    });
    return null;
}

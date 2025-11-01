import { useAppSelector } from "./hooks";

export const useMapviewer = () => {
  const { coordinates, zoom } = useAppSelector((state) => state.map);

  return {
    coordinates,
    zoom,
  };
};

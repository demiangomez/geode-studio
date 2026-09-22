import { boundingExtent, type Extent } from "ol/extent";
import { clamp } from "ol/math";
import { fromLonLat, get as getProjection } from "ol/proj";
import type { Coordinate } from "ol/coordinate";

const LAST_ZOOM_KEY = "lastZoomLevel";
const LAST_POSITION_KEY = "lastPosition";

export const getLastZoom = (fallback = 8): number => {
    const stored = localStorage.getItem(LAST_ZOOM_KEY);
    const parsed = stored ? parseInt(stored) : NaN;
    return Number.isNaN(parsed) ? fallback : parsed;
};

// Returns [lon, lat] (OL order), or null if nothing was saved yet
export const getLastCenterLonLat = (): [number, number] | null => {
    const stored = localStorage.getItem(LAST_POSITION_KEY);
    if (!stored) return null;
    const parts = stored.split(",").map(parseFloat);
    if (
        parts.length === 2 &&
        !Number.isNaN(parts[0]) &&
        !Number.isNaN(parts[1])
    ) {
        return [parts[1], parts[0]];
    }
    return null;
};

export const saveLastView = (
    centerLonLat: [number, number],
    zoom: number,
): void => {
    const [lon, lat] = centerLonLat;
    localStorage.setItem(LAST_POSITION_KEY, `${lat},${lon}`);
    localStorage.setItem(LAST_ZOOM_KEY, zoom.toString());
};

const WORLD = getProjection("EPSG:3857")!.getExtent();

// Mercator no acota la Y cerca de los polos: una estacion a -89.99 (Amundsen-Scott)
// cae a y≈-72M cuando el mundo termina en ±20M, y centrar o encuadrar ahi deja
// la vista donde no hay tiles. Se recorta cada punto al borde del mundo.
export const toWorldCoordinate = (lonLat: [number, number]): Coordinate => {
    const [x, y] = fromLonLat(lonLat);
    return [clamp(x, WORLD[0], WORLD[2]), clamp(y, WORLD[1], WORLD[3])];
};

export const worldExtentOf = (lonLats: [number, number][]): Extent =>
    boundingExtent(lonLats.map(toWorldCoordinate));

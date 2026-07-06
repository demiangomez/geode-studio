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

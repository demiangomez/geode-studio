import { useCallback, useState } from "react";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";

import { StationData, EarthquakeData } from "@types";

interface UseTooltipOptions {
    tooltipOverlay: React.RefObject<Overlay | null>;
}

type TooltipState =
    | { kind: "station"; data: StationData }
    | { kind: "earthquake"; data: EarthquakeData }
    | null;

interface UseTooltipReturn {
    tooltipStation: StationData | null;
    tooltipEarthquake: EarthquakeData | null;
    showStationTooltip: (station: StationData) => void;
    showEarthquakeTooltip: (earthquake: EarthquakeData) => void;
    hideTooltip: () => void;
}

export const useTooltip = ({
    tooltipOverlay,
}: UseTooltipOptions): UseTooltipReturn => {
    const [tooltip, setTooltip] = useState<TooltipState>(null);

    // Derived values — no extra state, no extra re-renders
    const tooltipStation = tooltip?.kind === "station" ? tooltip.data : null;
    const tooltipEarthquake =
        tooltip?.kind === "earthquake" ? tooltip.data : null;

    const showStationTooltip = useCallback(
        (station: StationData) => {
            setTooltip({ kind: "station", data: station });
            const coord = fromLonLat([station.lon, station.lat]);
            tooltipOverlay.current?.setPosition(coord);
        },
        [tooltipOverlay],
    );

    const showEarthquakeTooltip = useCallback(
        (earthquake: EarthquakeData) => {
            setTooltip({ kind: "earthquake", data: earthquake });
            const coord = fromLonLat([earthquake.lon, earthquake.lat]);
            tooltipOverlay.current?.setPosition(coord);
        },
        [tooltipOverlay],
    );

    const hideTooltip = useCallback(() => {
        setTooltip(null);
        tooltipOverlay.current?.setPosition(undefined);
    }, [tooltipOverlay]);

    return {
        tooltipStation,
        tooltipEarthquake,
        showStationTooltip,
        showEarthquakeTooltip,
        hideTooltip,
    };
};

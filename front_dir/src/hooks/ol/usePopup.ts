import { useCallback, useState } from "react";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";

import { StationData } from "@types";

interface UsePopupOptions {
    popupOverlay: React.RefObject<Overlay | null>;
    onStationClick?: (station: StationData) => void;
}

// Discriminated union — station and kml popups are mutually exclusive.
// Single setState avoids the double-setState that two independent pieces
// of state would cause (anti-pattern #1 from react-useeffect skill).
type PopupState =
    | { kind: "station"; data: StationData }
    | { kind: "kml"; description: string; coordinate: number[] }
    | null;

interface UsePopupReturn {
    selectedStation: StationData | null;
    selectedKmlPoint: { description: string; coordinate: number[] } | null;
    showStationPopup: (station: StationData) => void;
    showKmlPopup: (description: string, coordinate: number[]) => void;
    hidePopup: () => void;
}

export const usePopup = ({
    popupOverlay,
    onStationClick,
}: UsePopupOptions): UsePopupReturn => {
    const [popup, setPopup] = useState<PopupState>(null);

    // Derived — no extra state needed (react-useeffect skill: "calculate during render")
    const selectedStation = popup?.kind === "station" ? popup.data : null;
    const selectedKmlPoint =
        popup?.kind === "kml"
            ? { description: popup.description, coordinate: popup.coordinate }
            : null;

    const showStationPopup = useCallback(
        (station: StationData) => {
            const coord = fromLonLat([station.lon, station.lat]);
            popupOverlay.current?.setPosition(coord);
            setPopup({ kind: "station", data: station });
            onStationClick?.(station);
        },
        [popupOverlay, onStationClick],
    );

    const showKmlPopup = useCallback(
        (description: string, coordinate: number[]) => {
            popupOverlay.current?.setPosition(coordinate);
            setPopup({ kind: "kml", description, coordinate });
        },
        [popupOverlay],
    );

    const hidePopup = useCallback(() => {
        popupOverlay.current?.setPosition(undefined);
        setPopup(null);
    }, [popupOverlay]);

    return {
        selectedStation,
        selectedKmlPoint,
        showStationPopup,
        showKmlPopup,
        hidePopup,
    };
};

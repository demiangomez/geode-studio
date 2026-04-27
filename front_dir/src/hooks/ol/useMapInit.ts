import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import Overlay from "ol/Overlay";
import "ol/ol.css";
import { fromLonLat } from "ol/proj";
import { ScaleLine, Zoom } from "ol/control";

interface UseMapInitOptions {
    center: [number, number];
    zoom: number;
    mapRef: React.RefObject<HTMLDivElement | null>;
    popupRef?: React.RefObject<HTMLDivElement | null>;
    tooltipRef?: React.RefObject<HTMLDivElement | null>;
    enableScaleControl?: boolean;
    enableZoomControl?: boolean;
    // zoomControlPosition?:
    //     | "top-left"
    //     | "top-right"
    //     | "bottom-left"
    //     | "bottom-right"; // reserved for future use
    topoMap?: boolean;
}

interface UseMapInitReturn {
    mapInstance: React.RefObject<Map | null>;
    popupOverlay: React.RefObject<Overlay | null>;
    tooltipOverlay: React.RefObject<Overlay | null>;
    isMapReady: boolean;
}

// const VIEW_EXTENT = transformExtent(
//     [-Infinity, -85, Infinity, 85],
//     "EPSG:4326",
//     "EPSG:3857",
// );

export const useMapInit = ({
    center,
    zoom,
    mapRef,
    popupRef,
    tooltipRef,
    enableScaleControl = false,
    enableZoomControl = false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // zoomControlPosition: _zoomControlPosition,
    topoMap = false,
}: UseMapInitOptions): UseMapInitReturn => {
    const mapInstance = useRef<Map | null>(null);
    const popupOverlay = useRef<Overlay | null>(null);
    const tooltipOverlay = useRef<Overlay | null>(null);
    const tileLayerRef = useRef<TileLayer | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        if (!mapRef.current) return;

        const overlays: Overlay[] = [];

        if (popupRef?.current) {
            const overlay = new Overlay({
                element: popupRef.current,
                autoPan: false,
                positioning: "bottom-center",
                offset: [0, -10],
            });
            popupOverlay.current = overlay;
            overlays.push(overlay);
        }

        if (tooltipRef?.current) {
            const tooltip = new Overlay({
                element: tooltipRef.current,
                autoPan: false,
                positioning: "top-center",
                offset: [0, -35],
                stopEvent: false,
            });
            tooltipOverlay.current = tooltip;
            overlays.push(tooltip);
        }

        const controls = [];
        if (enableScaleControl) {
            controls.push(new ScaleLine({ units: "metric" }));
        }
        if (enableZoomControl) {
            const zoomCtrl = new Zoom();
            controls.push(zoomCtrl);
        }

        const osmSource = new OSM({ wrapX: true });
        tileLayerRef.current = new TileLayer({ source: osmSource });

        const map = new Map({
            target: mapRef.current,
            layers: [tileLayerRef.current],
            view: new View({
                center: fromLonLat(center),
                zoom,
                minZoom: 3,
                // extent: VIEW_EXTENT,
                // Do NOT use multiWorld - it duplicates features causing severe performance issues
                multiWorld: true,
                constrainOnlyCenter: true,
            }),
            overlays,
            controls,
        });

        mapInstance.current = map;

        setIsMapReady(true);

        return () => {
            map.setTarget(undefined);
            mapInstance.current = null;
            popupOverlay.current = null;
            tooltipOverlay.current = null;
            tileLayerRef.current = null;
            setIsMapReady(false);
        };
        // Init only once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!tileLayerRef.current) return;

        const source = topoMap
            ? new OSM({
                  url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
                  wrapX: true,
              })
            : new OSM({ wrapX: true });

        tileLayerRef.current.setSource(source);
    }, [topoMap]);

    return { mapInstance, popupOverlay, tooltipOverlay, isMapReady };
};

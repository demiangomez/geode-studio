import { useEffect, useRef, useState } from "react";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import Overlay from "ol/Overlay";

import { fromLonLat } from "ol/proj";
import { ScaleLine, Zoom } from "ol/control";

export interface MapLayerState {
    topo: boolean;
    satellite: boolean;
    tectonicPlates: boolean;
}

// Zoom maximo de la View segun la capa base activa. ArcGIS World Imagery se queda sin
// imagen ~z18 y por encima devuelve el tile-placeholder "Map data not yet available", asi
// que topamos el zoom (scroll/pinch/botones) en satelite. Topo y osm no tienen ese problema
// y se dejan sin tope efectivo (over-zoom pixelado si hace falta).
const SATELLITE_MAX_ZOOM = 18;
const OPENTOPOMAP_MAX_ZOOM = 17; // maximo real que sirve opentopomap; over-zoom por encima
const DEFAULT_MAX_ZOOM = 28; // OL default: sin tope efectivo para osm/topo

export interface MapProjectionState {
    globe: boolean;
}

interface UseMapInitOptions {
    center: [number, number];
    zoom: number;
    mapRef: React.RefObject<HTMLDivElement | null>;
    popupRef?: React.RefObject<HTMLDivElement | null>;
    tooltipRef?: React.RefObject<HTMLDivElement | null>;
    enableScaleControl?: boolean;
    enableZoomControl?: boolean;
    mapLayerState?: MapLayerState;
}

interface UseMapInitReturn {
    mapInstance: React.RefObject<Map | null>;
    popupOverlay: React.RefObject<Overlay | null>;
    tooltipOverlay: React.RefObject<Overlay | null>;
    isMapReady: boolean;
}

export const useMapInit = ({
    center,
    zoom,
    mapRef,
    popupRef,
    tooltipRef,
    enableScaleControl = false,
    enableZoomControl = false,
    mapLayerState,
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
                offset: [0, -5],
            });
            popupOverlay.current = overlay;
            overlays.push(overlay);
        }

        if (tooltipRef?.current) {
            const tooltip = new Overlay({
                element: tooltipRef.current,
                autoPan: false,
                positioning: "top-center",
                offset: [0, -30],
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
                maxZoom: DEFAULT_MAX_ZOOM,
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

        let source;
        let maxZoom: number;
        if (mapLayerState?.satellite) {
            maxZoom = SATELLITE_MAX_ZOOM;
            source = new XYZ({
                url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                maxZoom,
                wrapX: true,
            });
        } else if (mapLayerState?.topo) {
            maxZoom = DEFAULT_MAX_ZOOM;
            source = new OSM({
                url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
                maxZoom: OPENTOPOMAP_MAX_ZOOM,
                wrapX: true,
            });
        } else {
            maxZoom = DEFAULT_MAX_ZOOM;
            source = new OSM({ wrapX: true });
        }

        const map = mapInstance.current;
        if (!map || !tileLayerRef.current) return;

        const view = map.getView();
        view.setMaxZoom(maxZoom);
        const currentZoom = view.getZoom();
        if (currentZoom !== undefined && currentZoom > maxZoom) {
            view.setZoom(maxZoom);
        }

        // necesario remover y agregar porque cesium no permite cambiar la capa desde el source
        // sino que necesita el evento explicito de eliminacion y agregado de la capa.

        map.removeLayer(tileLayerRef.current);

        const newLayer = new TileLayer({ source });
        // Insert at index 0 to ensure it remains the background base layer
        map.getLayers().insertAt(0, newLayer);
        tileLayerRef.current = newLayer;
    }, [mapLayerState?.topo, mapLayerState?.satellite]);

    return { mapInstance, popupOverlay, tooltipOverlay, isMapReady };
};

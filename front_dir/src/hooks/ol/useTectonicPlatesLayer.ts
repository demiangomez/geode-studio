import { useEffect, useRef } from "react";

import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Stroke, Style } from "ol/style";

import type { TectonicPlatesServiceData } from "@types";

const TECTONIC_PLATES_STYLE = new Style({
    stroke: new Stroke({ color: "rgba(255, 87, 34, 0.9)", width: 1 }),
});

interface UseTectonicPlatesLayerOptions {
    mapInstance: React.RefObject<Map | null>;
    enabled: boolean;
    data: TectonicPlatesServiceData | undefined;
    zIndex?: number;
}

interface UseTectonicPlatesLayerReturn {
    layerRef: React.RefObject<VectorLayer | null>;
}

export const useTectonicPlatesLayer = ({
    mapInstance,
    enabled,
    data,
    zIndex = 45,
}: UseTectonicPlatesLayerOptions): UseTectonicPlatesLayerReturn => {
    const layerRef = useRef<VectorLayer | null>(null);

    // se crea una vez por dato; el toggle solo cambia la visibilidad
    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !data || layerRef.current) return;

        const features = new GeoJSON().readFeatures(data, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
        });
        const layer = new VectorLayer({
            source: new VectorSource({ features, wrapX: true }),
            style: TECTONIC_PLATES_STYLE,
            zIndex,
            visible: enabled,
        });
        layerRef.current = layer;
        map.addLayer(layer);
    }, [mapInstance, data, zIndex, enabled]);

    useEffect(() => {
        layerRef.current?.setVisible(enabled);
    }, [enabled]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (layerRef.current && mapInstance.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                mapInstance.current.removeLayer(layerRef.current);
            }
            layerRef.current = null;
        };
    }, [mapInstance]);

    return { layerRef };
};

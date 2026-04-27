import { useEffect, useRef, useCallback } from "react";

import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import { getCenter } from "ol/extent";

import { parseKmlFromBase64, createKmlLayer, KmlLayerOptions } from "@olUtils";

interface UseKmlLayerOptions {
    mapInstance: React.RefObject<Map | null>;
}

interface UseKmlLayerReturn {
    loadKml: (base64Data: string, options?: KmlLayerOptions) => Promise<void>;
    clearKml: () => void;
    kmlLayerRef: React.RefObject<VectorLayer | null>;
}

export const useKmlLayer = ({
    mapInstance,
}: UseKmlLayerOptions): UseKmlLayerReturn => {
    const kmlLayerRef = useRef<VectorLayer | null>(null);

    const clearKml = useCallback(() => {
        if (kmlLayerRef.current && mapInstance.current) {
            mapInstance.current.removeLayer(kmlLayerRef.current);
            kmlLayerRef.current = null;
        }
    }, [mapInstance]);

    const loadKml = useCallback(
        async (base64Data: string, options: KmlLayerOptions = {}) => {
            if (!mapInstance.current) return;

            clearKml();

            try {
                const features = await parseKmlFromBase64(base64Data);
                const kmlLayer = createKmlLayer(features, options);

                kmlLayerRef.current = kmlLayer;
                mapInstance.current.addLayer(kmlLayer);

                if (options.fitView !== false && features.length > 0) {
                    const extent = kmlLayer.getSource()!.getExtent();
                    const view = mapInstance.current.getView();
                    const currentZoom =
                        view.getZoom() ??
                        parseInt(localStorage.getItem("lastZoomLevel") ?? "8");
                    view.animate({
                        center: getCenter(extent),
                        zoom: currentZoom,
                        duration: 0,
                    });
                }
            } catch (error) {
                console.error("Error loading KML:", error);
            }
        },
        [mapInstance, clearKml],
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearKml();
        };
    }, [clearKml]);

    return { loadKml, clearKml, kmlLayerRef };
};

// Multi-KML hook for MapStation which shows multiple visit KMLs at once
interface UseMultiKmlLayerOptions {
    mapInstance: React.RefObject<Map | null>;
}

interface UseMultiKmlLayerReturn {
    loadMultipleKml: (
        entries: { id: string | number; base64Data: string; color: string }[],
    ) => Promise<void>;
    clearAllKml: () => void;
}

export const useMultiKmlLayer = ({
    mapInstance,
}: UseMultiKmlLayerOptions): UseMultiKmlLayerReturn => {
    const kmlLayersRef = useRef<globalThis.Map<string | number, VectorLayer>>(
        new globalThis.Map(),
    );

    const clearAllKml = useCallback(() => {
        if (!mapInstance.current) return;
        kmlLayersRef.current.forEach((layer: VectorLayer) => {
            mapInstance.current!.removeLayer(layer);
        });
        kmlLayersRef.current.clear();
    }, [mapInstance]);

    const loadMultipleKml = useCallback(
        async (
            entries: {
                id: string | number;
                base64Data: string;
                color: string;
            }[],
        ) => {
            if (!mapInstance.current) return;
            clearAllKml();

            for (const entry of entries) {
                try {
                    const features = await parseKmlFromBase64(entry.base64Data);
                    const kmlLayer = createKmlLayer(features, {
                        defaultColor: entry.color,
                        hidePoints: true,
                        fitView: false,
                    });
                    kmlLayersRef.current.set(entry.id, kmlLayer);
                    mapInstance.current!.addLayer(kmlLayer);
                } catch (error) {
                    console.error(`Error loading KML ${entry.id}:`, error);
                }
            }
        },
        [mapInstance, clearAllKml],
    );

    useEffect(() => {
        return () => {
            clearAllKml();
        };
    }, [clearAllKml]);

    return { loadMultipleKml, clearAllKml };
};

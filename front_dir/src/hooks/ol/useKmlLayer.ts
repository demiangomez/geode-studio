import { useEffect, useRef, useCallback } from "react";

import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import { getCenter } from "ol/extent";

import {
    parseKmlFromBase64,
    createKmlLayer,
    KmlLayerOptions,
    getLastZoom,
} from "@olUtils";
import Feature, { FeatureLike } from "ol/Feature";
import { Geometry } from "ol/geom";

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
    // Invalida cargas en vuelo: un loadKml/clearKml posterior gana siempre,
    // si no un parse lento terminaba agregando una capa que ya nadie referencia
    const loadIdRef = useRef(0);

    const clearKml = useCallback(() => {
        loadIdRef.current++;
        if (kmlLayerRef.current && mapInstance.current) {
            mapInstance.current.removeLayer(kmlLayerRef.current);
            kmlLayerRef.current = null;
        }
    }, [mapInstance]);

    const loadKml = useCallback(
        async (base64Data: string, options: KmlLayerOptions = {}) => {
            if (!mapInstance.current) return;

            clearKml();
            const loadId = loadIdRef.current;

            try {
                const features = await parseKmlFromBase64(base64Data);
                if (loadId !== loadIdRef.current || !mapInstance.current) {
                    return;
                }
                const kmlLayer = createKmlLayer(features, options);

                kmlLayerRef.current = kmlLayer;
                mapInstance.current.addLayer(kmlLayer);

                if (options.fitView !== false && features.length > 0) {
                    const extent = kmlLayer.getSource()!.getExtent();
                    const view = mapInstance.current.getView();
                    const currentZoom = view.getZoom() ?? getLastZoom();
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
    zIndex?: number;
}

interface UseMultiKmlLayerReturn {
    loadMultipleKml: (
        entries: { id: string | number; base64Data: string; color?: string }[],
    ) => Promise<void>;
    clearAllKml: () => void;
    isKmlFeature: (feature: FeatureLike) => boolean;
}

export const useMultiKmlLayer = ({
    mapInstance,
    zIndex = 40,
}: UseMultiKmlLayerOptions): UseMultiKmlLayerReturn => {
    const multiKmlLayerRef = useRef<VectorLayer | null>(null);
    const lastCallIdRef = useRef<number>(0);

    const getLayer = useCallback(() => {
        if (!mapInstance.current) return null;
        if (!multiKmlLayerRef.current) {
            const layer = createKmlLayer([], {
                zIndex,
                fitView: false,
            });
            multiKmlLayerRef.current = layer;
            mapInstance.current.addLayer(layer);
        }
        return multiKmlLayerRef.current;
    }, [mapInstance, zIndex]);

    const clearAllKml = useCallback(() => {
        const layer = multiKmlLayerRef.current;
        if (layer) {
            layer.getSource()?.clear();
        }
    }, []);

    const isKmlFeature = useCallback((feature: FeatureLike) => {
        const source = multiKmlLayerRef.current?.getSource();
        if (!source) return false;
        return source.hasFeature(feature as Feature<Geometry>);
    }, []);

    const loadMultipleKml = useCallback(
        async (
            entries: {
                id: string | number;
                base64Data: string;
                color?: string;
            }[],
        ) => {
            const layer = getLayer();
            if (!layer) return;

            const currentCallId = ++lastCallIdRef.current;

            // Clear existing features immediately to reflect state
            layer.getSource()?.clear();

            for (const entry of entries) {
                try {
                    const features = await parseKmlFromBase64(entry.base64Data);

                    if (currentCallId !== lastCallIdRef.current) return;
                    if (!mapInstance.current) return;

                    // Set properties for dynamic styling and identification
                    features.forEach((f) => {
                        f.set("earthquakeId", entry.id);
                        if (entry.color) {
                            f.set("customColor", entry.color);
                        }
                    });

                    layer.getSource()?.addFeatures(features);
                } catch (error) {
                    console.error(`Error loading KML ${entry.id}:`, error);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [getLayer],
    );

    useEffect(() => {
        return () => {
            if (multiKmlLayerRef.current && mapInstance.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                mapInstance.current.removeLayer(multiKmlLayerRef.current);
            }
            multiKmlLayerRef.current = null;
        };
    }, [mapInstance]);

    return { loadMultipleKml, clearAllKml, isKmlFeature };
};

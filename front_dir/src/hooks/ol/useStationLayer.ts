import { useEffect, useRef, useCallback } from "react";
import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Icon from "ol/style/Icon";
import { Style } from "ol/style";
import { fromLonLat } from "ol/proj";
import type { Geometry } from "ol/geom";

import { StationData } from "@types";
import {
    iconUrl,
    iconClass,
    getCachedColoredIcon,
    getIconScale,
} from "../../components/map/ol/utils/iconUtils";

// Process icons in batches to avoid blocking the main thread
// while still leveraging cache hits from getCachedColoredIcon
const BATCH_SIZE = 50;

interface UseStationLayerOptions {
    mapInstance: React.RefObject<Map | null>;
    isMapReady: boolean;
    stations: StationData[];
    types: { image: string; name: string }[];
    statuses: { color: string; name: string }[];
}

interface UseStationLayerReturn {
    vectorSource: React.RefObject<VectorSource<Feature<Geometry>>>;
    vectorLayer: React.RefObject<VectorLayer>;
    refreshFeatures: () => void;
}

export const useStationLayer = ({
    mapInstance,
    isMapReady,
    stations,
    types,
    statuses,
}: UseStationLayerOptions): UseStationLayerReturn => {
    const vectorSource = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const vectorLayer = useRef<VectorLayer>(
        new VectorLayer({ source: vectorSource.current }),
    );
    const layerAdded = useRef(false);

    // Add layer to map once ready
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || layerAdded.current) return;
        mapInstance.current.addLayer(vectorLayer.current);
        layerAdded.current = true;

        return () => {
            if (mapInstance.current && layerAdded.current) {
                mapInstance.current.removeLayer(vectorLayer.current);
                layerAdded.current = false;
            }
        };
    }, [isMapReady, mapInstance]);

    // Resolve icon src + scale for a single station
    const resolveStationIcon = useCallback(
        async (
            station: StationData,
        ): Promise<{ src: string; scale: number }> => {
            const iconSrc = iconUrl(station, types);
            const cssClass = iconClass(station, statuses);
            const hasIssues = station.has_gaps || !station.has_stationinfo;

            let finalIconSrc = iconSrc;
            if (cssClass && !hasIssues) {
                finalIconSrc = await getCachedColoredIcon(iconSrc, cssClass);
            }

            let scale = await getIconScale(finalIconSrc);
            if (hasIssues) {
                scale = scale * 0.7;
            }

            return { src: finalIconSrc, scale };
        },
        [types, statuses],
    );

    // Build features in batches, yielding between batches so the
    // browser can paint frames and respond to user input.
    const buildFeatures = useCallback(
        async (
            stationList: StationData[],
            signal: { cancelled: boolean },
        ): Promise<Feature<Geometry>[]> => {
            const features: Feature<Geometry>[] = [];

            for (let i = 0; i < stationList.length; i += BATCH_SIZE) {
                if (signal.cancelled) return features;

                const batch = stationList.slice(i, i + BATCH_SIZE);

                // Resolve all icons in the batch concurrently
                const results = await Promise.all(
                    batch.map((station) => resolveStationIcon(station)),
                );

                if (signal.cancelled) return features;

                for (let j = 0; j < batch.length; j++) {
                    const station = batch[j];
                    const { src, scale } = results[j];

                    const feature = new Feature({
                        geometry: new Point(
                            fromLonLat([station.lon, station.lat]),
                        ),
                    });
                    feature.set("station", station);
                    feature.setStyle(
                        new Style({
                            image: new Icon({
                                src,
                                scale,
                                anchor: [0.5, 1],
                                crossOrigin: "anonymous",
                            }),
                        }),
                    );
                    features.push(feature);
                }

                // Yield to the main thread between batches so the UI
                // stays responsive during large station loads (~5 000+)
                if (i + BATCH_SIZE < stationList.length) {
                    await new Promise((r) => setTimeout(r, 0));
                }
            }

            return features;
        },
        [resolveStationIcon],
    );

    // Populate features when data changes
    useEffect(() => {
        if (!isMapReady) return;

        const signal = { cancelled: false };

        vectorSource.current.clear();

        buildFeatures(stations, signal).then((features) => {
            if (!signal.cancelled && features.length > 0) {
                vectorSource.current.addFeatures(features);
            }
        });

        return () => {
            signal.cancelled = true;
        };
    }, [isMapReady, stations, buildFeatures]);

    // Imperative refresh for callers that need to re-render icons
    // (e.g. after types/statuses arrive late)
    const refreshFeatures = useCallback(() => {
        if (!isMapReady) return;

        const signal = { cancelled: false };
        vectorSource.current.clear();

        buildFeatures(stations, signal).then((features) => {
            if (!signal.cancelled && features.length > 0) {
                vectorSource.current.addFeatures(features);
            }
        });
    }, [isMapReady, stations, buildFeatures]);

    return { vectorSource, vectorLayer, refreshFeatures };
};

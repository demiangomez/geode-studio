import { useEffect, useRef, useMemo } from "react";

import Map from "ol/Map";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Overlay from "ol/Overlay";
import { Style } from "ol/style";
import Icon from "ol/style/Icon";
import { fromLonLat } from "ol/proj";
import type { Geometry } from "ol/geom";
import type MapBrowserEvent from "ol/MapBrowserEvent";

import { StationData } from "@types";

import {
    iconUrl as olIconUrl,
    iconClass as olIconClass,
    getCachedColoredIcon,
    getIconScale,
} from "@olUtils";

interface StationCreateMapOLProps {
    mapInstance: React.RefObject<Map | null>;
    stations: StationData[] | undefined;
    types: { image: string; name: string }[];
    statuses: { name: string; color: string }[];
    rangeValue: number;
    currentMarker: {
        lat: number;
        lng: number;
    } | null;
    /** Dibuja el catalogo entero; las que no pasan `polygon`/`highlightedApiIds` van al 30% */
    showAll?: boolean;
    polygon?: { lat: number; lng: number }[];
    highlightedApiIds?: ReadonlySet<number>;
    tooltipRef: React.RefObject<HTMLDivElement | null>;
}

const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number => {
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const lon1Rad = (lon1 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    const h =
        Math.sin((lat2Rad - lat1Rad) / 2) ** 2 +
        Math.cos(lat1Rad) *
            Math.cos(lat2Rad) *
            Math.sin((lon2Rad - lon1Rad) / 2) ** 2;

    return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const isWithinDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    maxDistance: number,
): boolean => {
    return calculateDistance(lat1, lon1, lat2, lon2) <= maxDistance * 1000;
};

// Ray casting sobre lat/lon; alcanza para los poligonos de seleccion
const isInsidePolygon = (
    lat: number,
    lon: number,
    ring: { lat: number; lng: number }[],
): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i];
        const b = ring[j];
        const crosses =
            a.lat > lat !== b.lat > lat &&
            lon < ((b.lng - a.lng) * (lat - a.lat)) / (b.lat - a.lat) + a.lng;
        if (crosses) inside = !inside;
    }
    return inside;
};

interface Highlight {
    polygon?: { lat: number; lng: number }[];
    highlightedApiIds?: ReadonlySet<number>;
}

const isDimmed = (
    station: StationData,
    { polygon, highlightedApiIds }: Highlight,
) =>
    (!!polygon &&
        polygon.length >= 3 &&
        !isInsidePolygon(station.lat, station.lon, polygon)) ||
    (!!highlightedApiIds &&
        (station.api_id === undefined ||
            !highlightedApiIds.has(station.api_id)));

const StationCreateMapOL = ({
    mapInstance,
    stations,
    types,
    statuses,
    rangeValue,
    currentMarker,
    showAll = false,
    polygon,
    highlightedApiIds,
    tooltipRef,
}: StationCreateMapOLProps) => {
    const tooltipOverlayRef = useRef<Overlay | null>(null);
    const layerRef = useRef<VectorLayer | null>(null);
    const sourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const pointerMoveHandlerRef = useRef<
        ((e: MapBrowserEvent<PointerEvent>) => void) | null
    >(null);

    // Filter stations in range
    const stationsInRange = useMemo(() => {
        if (!stations || !Array.isArray(stations)) return [];
        if (showAll) return stations.filter((s) => s.lat && s.lon);
        if (!currentMarker) return [];

        return stations.filter((station) => {
            if (!station.lat || !station.lon) return false;
            return isWithinDistance(
                currentMarker.lat,
                currentMarker.lng,
                station.lat,
                station.lon,
                rangeValue,
            );
        });
    }, [stations, currentMarker, rangeValue, showAll]);

    // Ref porque las features se crean en un loop async que lee el valor vigente
    const highlightRef = useRef<Highlight>({ polygon, highlightedApiIds });
    highlightRef.current = { polygon, highlightedApiIds };

    useEffect(() => {
        for (const feature of sourceRef.current.getFeatures()) {
            const station = feature.get("nearbyStation") as StationData;
            const icon = (feature.getStyle() as Style | undefined)?.getImage();
            const opacity = isDimmed(station, highlightRef.current) ? 0.3 : 1;
            if (icon && icon.getOpacity() !== opacity) {
                icon.setOpacity(opacity);
                feature.changed();
            }
        }
    }, [polygon, highlightedApiIds]);

    // Setup layer and tooltip overlay on mount
    useEffect(() => {
        const map = mapInstance?.current;
        if (!map) return;

        // Create layer
        const layer = new VectorLayer({
            source: sourceRef.current,
            zIndex: 50,
        });
        layerRef.current = layer;
        map.addLayer(layer);

        // Create tooltip overlay
        if (tooltipRef && tooltipRef.current) {
            const overlay = new Overlay({
                element: tooltipRef.current,
                positioning: "top-center",
                offset: [0, -30],
                stopEvent: false,
            });
            tooltipOverlayRef.current = overlay;
            map.addOverlay(overlay);
        }

        // Hover handler for tooltips
        const handlePointerMove = (e: MapBrowserEvent<PointerEvent>) => {
            const feature = map.forEachFeatureAtPixel(e.pixel, (f) => {
                if (f.get("nearbyStation")) return f as Feature<Geometry>;
                return undefined;
            });

            if (feature) {
                const station = feature.get("nearbyStation") as StationData;
                const coord = (feature.getGeometry() as Point).getCoordinates();
                tooltipOverlayRef.current?.setPosition(coord);
                if (tooltipRef && tooltipRef.current) {
                    const label =
                        (station.network_code?.toUpperCase() ?? "") +
                        "." +
                        (station.station_code?.toUpperCase() ?? "");
                    tooltipRef.current.textContent = label;
                    tooltipRef.current.style.display = "block";
                }
            } else {
                tooltipOverlayRef.current?.setPosition(undefined);
                if (tooltipRef && tooltipRef.current) {
                    tooltipRef.current.style.display = "none";
                }
            }
        };

        pointerMoveHandlerRef.current = handlePointerMove;
        map.on("pointermove", handlePointerMove as any);

        return () => {
            map.removeLayer(layer);
            if (tooltipOverlayRef.current) {
                map.removeOverlay(tooltipOverlayRef.current);
            }
            if (pointerMoveHandlerRef.current) {
                map.un("pointermove", pointerMoveHandlerRef.current as any);
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            sourceRef.current.clear();
        };
        // Run once on mount — mapInstance is a stable ref
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update features when stationsInRange, types, or statuses change
    useEffect(() => {
        sourceRef.current.clear();

        if (stationsInRange.length === 0) return;

        let isCancelled = false;

        const createFeatures = async () => {
            const features: Feature<Geometry>[] = [];

            for (const s of stationsInRange) {
                if (isCancelled) return;
                if (!s.lat || !s.lon) continue;

                const feature = new Feature({
                    geometry: new Point(fromLonLat([s.lon, s.lat])),
                });
                feature.set("nearbyStation", s);

                const iconSrc = olIconUrl(s, types);
                const cssClass = olIconClass(s, statuses);
                const hasIssues = s.has_gaps || !s.has_stationinfo;

                let finalIconSrc = iconSrc;
                if (cssClass && !hasIssues) {
                    finalIconSrc = await getCachedColoredIcon(
                        iconSrc,
                        cssClass,
                    );
                }

                let scale = await getIconScale(finalIconSrc);
                if (hasIssues) scale *= 0.7;

                feature.setStyle(
                    new Style({
                        image: new Icon({
                            src: finalIconSrc,
                            scale,
                            opacity: isDimmed(s, highlightRef.current)
                                ? 0.3
                                : 1,
                            crossOrigin: "anonymous",
                        }),
                    }),
                );

                features.push(feature);
            }

            if (!isCancelled && features.length > 0) {
                sourceRef.current.addFeatures(features);
            }
        };

        createFeatures();

        return () => {
            isCancelled = true;
        };
    }, [stationsInRange, types, statuses]);

    return null;
};

export default StationCreateMapOL;

import { useEffect, useRef, useCallback } from "react";

import Map from "ol/Map";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import Icon from "ol/style/Icon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Cluster } from "ol/source";
import type { Geometry } from "ol/geom";
import { Style } from "ol/style";
import { createEmpty, extend } from "ol/extent";

import {
    CLUSTER_MIN_DISTANCE,
    SPIDER_LEG_STYLE,
    clusterStyleFn,
    createClusterHoverStyle,
    generateSpiderfyPoints,
    animateSpiderfyExpand,
    animateSpiderfyCollapse,
} from "@olUtils";

import { StationData } from "@types";

// ────────────────────── Interface ──────────────────────

interface UseClusterLayerOptions {
    mapInstance: React.RefObject<Map | null>;
    isMapReady: boolean;
    stationSource: VectorSource<Feature<Geometry>>;
    /** Cluster distance in px (default: CLUSTER_MIN_DISTANCE = 7) */
    distance?: number;
    /** Minimum distance between clusters in px (default: 5) */
    minDistance?: number;
    styleFn?: (feature: Feature<Geometry>) => Style | void;
    zIndex?: number;
    spiderfyZIndex?: number;
    /** Enable spiderfy on cluster click (default: true) */
    enableSpiderfy?: boolean;
    /** Enable cluster hover style (default: true) */
    enableHover?: boolean;
}

interface UseClusterLayerReturn {
    /** The cluster layer ref (for external visibility toggling) */
    clusterLayerRef: React.RefObject<VectorLayer | null>;
    /** The cluster source ref */
    clusterSourceRef: React.RefObject<Cluster>;
    /** The spiderfy source ref (for external spider cleanup) */
    spiderfySourceRef: React.RefObject<VectorSource<Feature<Geometry>>>;
    /** Collapse any open spider immediately (no animation) */
    collapseSpider: () => void;
    /**
     * Handle a click event — call this in your click handler BEFORE
     * checking individual features.
     *
     * Returns:
     * - `{ consumed: true, station }` → cluster/spider consumed the click; open popup if station present
     * - `{ consumed: false }` → not cluster-related; caller handles it
     */
    handleClusterClick: (
        evt: any,
        feature: Feature<Geometry> | undefined,
    ) => {
        consumed: boolean;
        station?: StationData & { spiderfyPos?: [number, number] };
    };
    /**
     * Handle pointer move for cluster hover — call in your pointermove
     * handler BEFORE individual feature checks.
     *
     * Returns:
     * - `{ consumed: true, tooltipStation?, tooltipCoord? }` → caller sets tooltip
     * - `{ consumed: false }` → not cluster-related
     */
    handleClusterHover: (feature: Feature<Geometry> | undefined) => {
        consumed: boolean;
        tooltipStation?: StationData;
        tooltipCoord?: number[];
    };
    /** Clear hover style on the currently hovered cluster (call when dragging) */
    clearHover: () => void;
}

// ────────────────────── Hook ──────────────────────

export const useClusterLayer = ({
    mapInstance,
    isMapReady,
    stationSource,
    distance = CLUSTER_MIN_DISTANCE,
    minDistance = 5,
    styleFn,
    zIndex = 60,
    spiderfyZIndex,
    enableSpiderfy = true,
    enableHover = true,
}: UseClusterLayerOptions): UseClusterLayerReturn => {
    // Refs — never stored in state (anti-pattern for OL objects)
    const clusterLayerRef = useRef<VectorLayer | null>(null);
    const clusterSourceRef = useRef<Cluster>(
        new Cluster({
            source: stationSource,
            distance,
            minDistance,
            wrapX: true,
        }),
    );

    const spiderfySourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const spiderfyLayerRef = useRef<VectorLayer | null>(null);
    const spiderfiedClusterRef = useRef<Feature<Geometry> | null>(null);
    const spiderfyAnimRef = useRef<number | null>(null);
    const hoveredClusterRef = useRef<Feature<Geometry> | null>(null);

    const resolvedStyleFn = styleFn ?? clusterStyleFn;
    const resolvedSpiderfyZIndex = spiderfyZIndex ?? zIndex + 10;

    // ── Helpers ──

    const cancelSpiderAnim = () => {
        if (spiderfyAnimRef.current) {
            cancelAnimationFrame(spiderfyAnimRef.current);
            spiderfyAnimRef.current = null;
        }
    };

    // ── Layer lifecycle ──
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        // Cluster layer — starts invisible; component toggles visibility
        const layer = new VectorLayer({
            source: clusterSourceRef.current,
            style: (feature) =>
                resolvedStyleFn(feature as Feature<Geometry>) as Style,
            zIndex,
            visible: false,
        });
        clusterLayerRef.current = layer;
        map.addLayer(layer);

        // Spiderfy layer (always visible — empty source when collapsed)
        let spiderfyLayer: VectorLayer | null = null;
        if (enableSpiderfy) {
            spiderfyLayer = new VectorLayer({
                source: spiderfySourceRef.current,
                zIndex: resolvedSpiderfyZIndex,
                visible: true,
            });
            spiderfyLayerRef.current = spiderfyLayer;
            map.addLayer(spiderfyLayer);
        }

        // Collapse spider on zoom change
        const onResolutionChange = () => {
            cancelSpiderAnim();
            if (spiderfiedClusterRef.current) {
                spiderfiedClusterRef.current.setStyle(undefined as any);
            }
            spiderfySourceRef.current.clear();
            spiderfiedClusterRef.current = null;
        };
        map.getView().on("change:resolution", onResolutionChange);

        return () => {
            cancelSpiderAnim();
            map.getView().un("change:resolution", onResolutionChange);
            map.removeLayer(layer);
            if (spiderfyLayer) map.removeLayer(spiderfyLayer);
            clusterLayerRef.current = null;
            spiderfyLayerRef.current = null;
            spiderfiedClusterRef.current = null;
            hoveredClusterRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    // ── Sync options ──
    useEffect(() => {
        if (clusterSourceRef.current && typeof distance === "number" && !isNaN(distance)) {
            clusterSourceRef.current.setDistance(distance);
        }
    }, [distance]);

    // ── Public: collapse spider instantly ──
    const collapseSpider = useCallback(() => {
        cancelSpiderAnim();
        if (spiderfiedClusterRef.current) {
            spiderfiedClusterRef.current.setStyle(undefined as any);
            spiderfiedClusterRef.current = null;
        }
        spiderfySourceRef.current.clear();
    }, []);
    
    // ── Internal: expand spider ──
    const expandSpider = useCallback(
        (
            map: Map,
            feature: Feature<Geometry>,
            clusterMembers: Feature<Geometry>[],
        ) => {
            cancelSpiderAnim();
            if (spiderfiedClusterRef.current) {
                spiderfiedClusterRef.current.setStyle(undefined as any);
            }
            spiderfySourceRef.current.clear();

            const clusterGeom = feature.getGeometry() as Point;
            const center = clusterGeom.getCoordinates();
            const resolution = map.getView().getResolution() ?? 1;
            const positions = generateSpiderfyPoints(
                clusterMembers.length,
                center,
                resolution,
            );

            const spiderFeatures: Feature<Geometry>[] = [];
            for (let i = 0; i < clusterMembers.length; i++) {
                const member = clusterMembers[i];
                const pos = positions[i];

                const origStyle = member.getStyle() as Style;
                // If station is hidden (empty style), skip it entirely
                if (!origStyle || !origStyle.getImage()) {
                    continue;
                }

                // Leg line
                const leg = new Feature<Geometry>({
                    geometry: new LineString([center, center]),
                });
                leg.setStyle(SPIDER_LEG_STYLE);
                spiderFeatures.push(leg);

                // Station icon
                const stationFeat = new Feature<Geometry>({
                    geometry: new Point(center),
                });
                const stationData = member.get("station") as StationData;
                stationFeat.set("spiderStation", {
                    ...stationData,
                    spiderfyPos: pos,
                });

                const origIcon = origStyle.getImage() as Icon;
                stationFeat.setStyle(
                    new Style({
                        image: new Icon({
                            src: origIcon.getSrc() ?? "",
                            scale: origIcon.getScale() as number,
                            opacity: origIcon.getOpacity(), // Copy opacity (for grayed-out effect)
                            crossOrigin: "anonymous",
                        }),
                    }),
                );
                spiderFeatures.push(stationFeat);
            }

            spiderfySourceRef.current.addFeatures(spiderFeatures);
            spiderfiedClusterRef.current = feature;

            // Hide the cluster badge & clear hover
            feature.setStyle(new Style({}));
            hoveredClusterRef.current = null;

            animateSpiderfyExpand(
                center,
                positions,
                spiderFeatures,
                spiderfyAnimRef,
            );
        },
        [],
    );

    // ── Public: click handler ──
    const handleClusterClick = useCallback(
        (
            _evt: any,
            feature: Feature<Geometry> | undefined,
        ): {
            consumed: boolean;
            station?: StationData & { spiderfyPos?: [number, number] };
        } => {
            const map = mapInstance.current;
            if (!map) return { consumed: false };

            // Always collapse previous spider with animation
            if (enableSpiderfy && !feature?.get("spiderStation")) {
                cancelSpiderAnim();
                if (spiderfiedClusterRef.current) {
                    animateSpiderfyCollapse(
                        spiderfySourceRef.current,
                        spiderfyAnimRef,
                        () => {
                            spiderfiedClusterRef.current?.setStyle(
                                undefined as any,
                            );
                            spiderfiedClusterRef.current = null;
                        },
                    );
                }
            }

            if (!feature) return { consumed: false };

            // 1. Spiderfied station click
            if (enableSpiderfy) {
                const spiderStation = feature.get("spiderStation") as
                    | (StationData & { spiderfyPos?: [number, number] })
                    | undefined;
                if (spiderStation) {
                    return { consumed: true, station: spiderStation };
                }
            }

            // 2. Cluster feature (has "features" array)
            const clusterMembers = feature.get("features") as
                | Feature<Geometry>[]
                | undefined;


            if (!clusterMembers) return { consumed: false };

            if (clusterMembers.length > 1) {
                if (enableSpiderfy) {
                    expandSpider(map, feature, clusterMembers);
                    return { consumed: true };
                }
                // Fallback: zoom to extent
                const extent = createEmpty();
                clusterMembers.forEach((f) => {
                    const geom = f.getGeometry();
                    if (geom) extend(extent, geom.getExtent());
                });
                map.getView().fit(extent, {
                    duration: 500,
                    padding: [50, 50, 50, 50],
                });
                return { consumed: true };
            }

            // Single-member cluster → return the station
            const singleStation = clusterMembers[0].get("station") as
                | StationData
                | undefined;
            if (singleStation) {
                return { consumed: true, station: singleStation };
            }

            return { consumed: true };
        },
        [enableSpiderfy, expandSpider, mapInstance],
    );

    // ── Public: hover handler ──
    const clearHover = useCallback(() => {
        if (hoveredClusterRef.current) {
            hoveredClusterRef.current.setStyle(undefined as any);
            hoveredClusterRef.current = null;
        }
    }, []);

    const handleClusterHover = useCallback(
        (
            feature: Feature<Geometry> | undefined,
        ): {
            consumed: boolean;
            tooltipStation?: StationData;
            tooltipCoord?: number[];
        } => {
            // Clear previous cluster hover when moving to different feature
            if (
                hoveredClusterRef.current &&
                hoveredClusterRef.current !== feature
            ) {
                hoveredClusterRef.current.setStyle(undefined as any);
                hoveredClusterRef.current = null;
            }

            if (!feature) return { consumed: false };

            // 1. Spiderfied station hover
            if (enableSpiderfy) {
                const spiderStation = feature.get("spiderStation") as
                    | StationData
                    | undefined;
                if (spiderStation) {
                    const coord = (
                        feature.getGeometry() as Point
                    ).getCoordinates();
                    return {
                        consumed: true,
                        tooltipStation: spiderStation,
                        tooltipCoord: coord,
                    };
                }
            }

            // 2. Cluster feature
            const clusterMembers = feature.get("features") as
                | Feature<Geometry>[]
                | undefined;
            if (!clusterMembers) return { consumed: false };

            // Single-member cluster — tooltip for that station
            if (clusterMembers.length === 1) {
                const s = clusterMembers[0].get("station") as
                    | StationData
                    | undefined;
                if (s) {
                    const coord = (
                        clusterMembers[0].getGeometry() as Point
                    ).getCoordinates();
                    return {
                        consumed: true,
                        tooltipStation: s,
                        tooltipCoord: coord,
                    };
                }
            }

            // Multi-member cluster — hover style, no tooltip
            if (enableHover) {
                const hoverStyle = createClusterHoverStyle(feature);
                if (hoverStyle) {
                    feature.setStyle(hoverStyle);
                    hoveredClusterRef.current = feature;
                }
            }

            return { consumed: true };
        },
        [enableSpiderfy, enableHover],
    );

    return {
        clusterLayerRef,
        clusterSourceRef,
        spiderfySourceRef,
        collapseSpider,
        handleClusterClick,
        handleClusterHover,
        clearHover,
    };
};

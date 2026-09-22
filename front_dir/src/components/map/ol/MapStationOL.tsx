import React, { useEffect, useState, useRef } from "react";
import Popup from "@components/map/Popup";
import VisitsScroller from "@components/map/VisitsScroller";

import { fromLonLat } from "ol/proj";
import { Style } from "ol/style";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Icon from "ol/style/Icon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";

import { getNearbyStations } from "@services";

import { useApi, useAuth } from "@hooks";
import { useMapInit } from "@hooks/ol/useMapInit";
import { useKmlLayer, useMultiKmlLayer } from "@hooks/ol/useKmlLayer";
import { useClusterLayer } from "@hooks/ol/useClusterLayer";

import {
    iconUrl,
    iconClass,
    getCachedColoredIcon,
    getIconScale,
    CLUSTER_MAX_ZOOM,
    getLastZoom,
} from "@olUtils";

import "ol/ol.css";
import "./MapOL.css";

import type { Geometry } from "ol/geom";

import {
    StationData,
    StationMetadataServiceData,
    StationVisitsData,
} from "@types";
import { useMetadata } from "@hooks/queries";

interface VisitsStates {
    visitId: number;
    checked: boolean;
    color: string;
}

interface VisitScrollerProps {
    visits: StationVisitsData[];
    changeKml: VisitsStates[];
    changeMeta: boolean;
    setChangeKml: React.Dispatch<React.SetStateAction<VisitsStates[]>>;
    setChangeMeta: React.Dispatch<React.SetStateAction<boolean>>;
    stationMeta: StationMetadataServiceData;
}

interface MapStationOLProps {
    visitScrollerProps: VisitScrollerProps;
    station: StationData | undefined;
}

const NearbyStationsControl: React.FC<{
    showNearbyStations: boolean;
    nearbyRadius: number;
    setShowNearbyStations: React.Dispatch<React.SetStateAction<boolean>>;
    setNearbyRadius: React.Dispatch<React.SetStateAction<number>>;
}> = ({
    showNearbyStations,
    nearbyRadius,
    setShowNearbyStations,
    setNearbyRadius,
}) => (
    <div
        className="absolute top-2.5 left-2.5 z-[1000]"
        onPointerDown={(e) => e.stopPropagation()}
    >
        <div className="bg-white p-3 rounded-md shadow-lg min-w-[240px]">
            <div className="flex items-center gap-2 mb-1">
                <input
                    type="checkbox"
                    id="nearby-stations-checkbox-ol"
                    checked={showNearbyStations}
                    onChange={(e) => setShowNearbyStations(e.target.checked)}
                    className="checkbox checkbox-sm"
                />
                <label
                    htmlFor="nearby-stations-checkbox-ol"
                    className="text-sm font-semibold cursor-pointer text-gray-700 select-none"
                >
                    Show Nearby Stations
                </label>
            </div>
            {showNearbyStations && (
                <div className="space-y-2 mt-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Radius: {nearbyRadius} km
                    </label>
                    <input
                        type="range"
                        className="range range-xs range-neutral w-full"
                        value={nearbyRadius}
                        onChange={(e) =>
                            setNearbyRadius(parseInt(e.target.value))
                        }
                        step="10"
                        min="100"
                        max="200"
                    />
                </div>
            )}
        </div>
    </div>
);

const MapStationOL: React.FC<MapStationOLProps> = ({
    visitScrollerProps,
    station,
}) => {
    const { visits, changeKml, changeMeta, stationMeta } = visitScrollerProps;
    const { token, logout, clusteringDistance } = useAuth();
    const api = useApi(token, logout);

    // DOM refs
    const mapRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const lastTooltipFeatureRef = useRef<Feature<Geometry> | null>(null);

    // State
    const [showNearbyStations, setShowNearbyStations] = useState(false);
    const [nearbyRadius, setNearbyRadius] = useState(100);
    const [nearbyStations, setNearbyStations] = useState<StationData[]>([]);
    const [showScroller, setShowScroller] = useState(false);

    const [selectedPopupStation, setSelectedPopupStation] =
        useState<StationData | null>(null);
    const [tooltipStation, setTooltipStation] = useState<StationData | null>(
        null,
    );

    const [currentZoom, setCurrentZoom] = useState(12);

    const center: [number, number] = station
        ? [station.lon, station.lat]
        : [0, 0];

    const mainMarkerLayerRef = useRef<VectorLayer | null>(null);
    const nearbySourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const nearbyLayerRef = useRef<VectorLayer | null>(null);

    // Map init
    const { mapInstance, popupOverlay, tooltipOverlay, isMapReady } =
        useMapInit({
            center,
            zoom: currentZoom,
            mapRef,
            popupRef,
            tooltipRef,
            enableZoomControl: true,
        });

    const {
        clusterLayerRef,
        handleClusterClick,
        handleClusterHover,
        clearHover,
    } = useClusterLayer({
        mapInstance,
        isMapReady,
        distance: clusteringDistance,
        stationSource: nearbySourceRef.current,
        enableSpiderfy: true,
        enableHover: true,
        zIndex: 150,
    });

    // KML hooks
    const { loadMultipleKml } = useMultiKmlLayer({ mapInstance });
    const { loadKml: loadSingleKml, clearKml: clearSingleKml } = useKmlLayer({
        mapInstance,
    });

    // station types and statuses
    const { statuses, types } = useMetadata(api, {
        only: ["types", "statuses"],
    });

    // ---- Main station marker ----
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !station) return;

        let isCancelled = false;

        // Remove old marker layer
        if (mainMarkerLayerRef.current) {
            mapInstance.current.removeLayer(mainMarkerLayerRef.current);
            mainMarkerLayerRef.current = null;
        }

        const addMarker = async () => {
            const iconSrc = iconUrl(station, types ?? []);
            const cssClass = iconClass(station, statuses ?? []);
            const hasIssues = station.has_gaps || !station.has_stationinfo;

            let finalIconSrc = iconSrc;
            if (cssClass && !hasIssues) {
                finalIconSrc = await getCachedColoredIcon(iconSrc, cssClass);
            }
            if (isCancelled) return;

            let scale = await getIconScale(finalIconSrc);
            if (hasIssues) scale *= 0.7;
            if (isCancelled) return;

            const feature = new Feature<Geometry>({
                geometry: new Point(fromLonLat([station.lon, station.lat])),
            });
            feature.set("station", station);
            feature.setStyle(
                new Style({
                    image: new Icon({
                        src: finalIconSrc,
                        scale,
                        // anchor: [0.5, 1],
                        crossOrigin: "anonymous",
                    }),
                }),
            );

            const source = new VectorSource<Feature<Geometry>>({
                features: [feature],
                wrapX: true,
            });
            const layer = new VectorLayer({ source, zIndex: 200 });
            mainMarkerLayerRef.current = layer;

            if (!isCancelled && mapInstance.current) {
                mapInstance.current.addLayer(layer);
                const coord = fromLonLat([station.lon, station.lat]);
                popupOverlay.current?.setPosition(coord);
                // Not triggering popup open on initial load
                // setSelectedPopupStation(station);
            }
        };

        addMarker();

        return () => {
            isCancelled = true;
        };
    }, [isMapReady, station, types, statuses, mapInstance, popupOverlay]);

    // ---- Center view on station change ----
    useEffect(() => {
        if (!mapInstance.current || !station) return;
        const view = mapInstance.current.getView();
        view.setCenter(fromLonLat([station.lon, station.lat]));
    }, [station, mapInstance]);

    // ---- Listen to zoom changes to update currentZoom state ----
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const view = mapInstance.current.getView();

        const onResolutionChange = () => {
            const z = view.getZoom() ?? 12;
            setCurrentZoom(z);

            // Toggle nearby stations between clustered and individual view
            const shouldCluster = z >= CLUSTER_MAX_ZOOM;

            if (
                nearbyLayerRef.current?.getVisible() ||
                clusterLayerRef.current?.getVisible()
            ) {
                nearbyLayerRef.current?.setVisible(!shouldCluster);
                clusterLayerRef.current?.setVisible(shouldCluster);
            }
        };

        view.on("change:resolution", onResolutionChange);

        return () => {
            view.un("change:resolution", onResolutionChange);
        };
    }, [isMapReady, mapInstance, clusterLayerRef]);

    // --- Listen on pointermove when hovering station marker ---
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        const handlePointerMove = (evt: any) => {
            if (evt.dragging) {
                if (lastTooltipFeatureRef.current !== null) {
                    tooltipOverlay.current?.setPosition(undefined);
                    setTooltipStation(null);
                    lastTooltipFeatureRef.current = null;
                }
                clearHover();
                return;
            }

            const feature = map.forEachFeatureAtPixel(
                evt.pixel,
                (f: any) => f,
                {
                    hitTolerance: 6,
                },
            ) as Feature<Geometry> | undefined;

            if (feature === lastTooltipFeatureRef.current) return;
            lastTooltipFeatureRef.current = feature ?? null;

            // Check if cluster hover consumed the event
            const hoverResult = handleClusterHover(feature);
            if (hoverResult.consumed) {
                map.getTargetElement().classList.add("has-feature");
                if (hoverResult.tooltipStation && hoverResult.tooltipCoord) {
                    tooltipOverlay.current?.setPosition(
                        hoverResult.tooltipCoord,
                    );
                    setTooltipStation(hoverResult.tooltipStation);
                } else {
                    tooltipOverlay.current?.setPosition(undefined);
                    setTooltipStation(null);
                }
                return;
            }

            if (feature && feature.get("station")) {
                const stationData = feature.get("station") as StationData;
                const coord = fromLonLat([stationData.lon, stationData.lat]);
                tooltipOverlay.current?.setPosition(coord);
                setTooltipStation(stationData);
                map.getTargetElement().classList.add("has-feature");
                return;
            }

            tooltipOverlay.current?.setPosition(undefined);
            setTooltipStation(null);
            map.getTargetElement().classList.remove("has-feature");
        };

        map.on("pointermove" as any, handlePointerMove);

        return () => {
            map.un("pointermove" as any, handlePointerMove);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady, handleClusterHover]);

    // ---- Visit KMLs ----
    useEffect(() => {
        if (!isMapReady) return;

        const kmlEntries = visits.flatMap((visit) => {
            if (!visit?.navigation_actual_file) return [];
            const state = changeKml.find((k) => k.visitId === visit.id);
            if (!state?.checked) return [];
            return [
                {
                    id: visit.id,
                    base64Data: visit.navigation_actual_file,
                    color: state.color,
                },
            ];
        });

        loadMultipleKml(kmlEntries);
    }, [isMapReady, visits, changeKml, loadMultipleKml]);

    // ---- Metadata (default) KML ----
    const metaKml = stationMeta?.navigation_actual_file;

    useEffect(() => {
        if (!isMapReady) return;

        if (metaKml && changeMeta) {
            loadSingleKml(metaKml, {
                fitView: false,
                defaultColor: "black",
                hidePoints: true,
            });
        } else {
            clearSingleKml();
        }
    }, [isMapReady, metaKml, changeMeta, loadSingleKml, clearSingleKml]);

    // ---- Fetch nearby stations ----
    useEffect(() => {
        if (!station || !showNearbyStations) {
            setNearbyStations([]);
            return;
        }

        let isCancelled = false;

        const fetch = async () => {
            try {
                const response = (await getNearbyStations(
                    api,
                    station.api_id!,
                    nearbyRadius,
                )) as { nearby_stations: StationData[] };
                if (!isCancelled && response.nearby_stations) {
                    setNearbyStations(response.nearby_stations);
                }
            } catch {
                if (!isCancelled) setNearbyStations([]);
            }
        };

        fetch();

        return () => {
            isCancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showNearbyStations, nearbyRadius, station]);

    // ---- Validate selected popup station still exists ----
    useEffect(() => {
        if (!selectedPopupStation || !station) return;

        // Main station is always valid
        if (selectedPopupStation.api_id === station.api_id) return;

        // If it's a nearby station, check if it's still in the list
        const exists = nearbyStations.some(
            (ns) => ns.api_id === selectedPopupStation.api_id,
        );
        if (!exists) {
            setSelectedPopupStation(null);
            popupOverlay.current?.setPosition(undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nearbyStations, selectedPopupStation, station]);

    // ---- Render nearby station markers (dual layer: individual + cluster) ----
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        // Remove old individual layer
        if (nearbyLayerRef.current) {
            map.removeLayer(nearbyLayerRef.current);
            nearbyLayerRef.current = null;
        }

        nearbySourceRef.current.clear();

        if (!showNearbyStations || nearbyStations.length === 0) {
            clusterLayerRef.current?.setVisible(false);
            return;
        }

        let isCancelled = false;

        const addFeatures = async () => {
            const features: Feature<Geometry>[] = [];

            // Create individual nearby markers — cluster source will group them
            for (const ns of nearbyStations) {
                if (isCancelled) return;

                const iconSrc = iconUrl(ns, types ?? []);
                const cssClass = iconClass(ns, statuses ?? []);
                const hasIssues = ns.has_gaps || !ns.has_stationinfo;

                let finalIconSrc = iconSrc;
                if (cssClass && !hasIssues) {
                    finalIconSrc = await getCachedColoredIcon(
                        iconSrc,
                        cssClass,
                    );
                }
                if (isCancelled) return;

                let scale = await getIconScale(finalIconSrc);
                if (hasIssues) scale *= 0.7;
                if (isCancelled) return;

                const feature = new Feature<Geometry>({
                    geometry: new Point(fromLonLat([ns.lon, ns.lat])),
                });
                feature.set("station", ns);
                feature.set("nearbyStation", true);
                feature.setStyle(
                    new Style({
                        image: new Icon({
                            src: finalIconSrc,
                            scale,
                            crossOrigin: "anonymous",
                        }),
                    }),
                );
                features.push(feature);
            }

            if (!isCancelled && features.length > 0 && mapInstance.current) {
                nearbySourceRef.current.addFeatures(features);

                // Toggle visibility based on current zoom (same as MapOL)
                const z = map.getView().getZoom() ?? 0;
                const shouldCluster = z >= CLUSTER_MAX_ZOOM;

                // Individual nearby stations layer (non-clustered)
                const nearbyLayer = new VectorLayer({
                    source: nearbySourceRef.current,
                    zIndex: 140,
                    visible: !shouldCluster,
                });
                nearbyLayerRef.current = nearbyLayer;
                map.addLayer(nearbyLayer);

                clusterLayerRef.current?.setVisible(shouldCluster);
            }
        };

        addFeatures();

        return () => {
            isCancelled = true;
        };
    }, [
        isMapReady,
        showNearbyStations,
        nearbyStations,
        types,
        statuses,
        mapInstance,
        clusterLayerRef,
    ]);

    // ---- Click handler for nearby station popups ----
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        const handleClick = (evt: any) => {
            const feature = map.forEachFeatureAtPixel(
                evt.pixel,
                (f: any) => f,
                {
                    hitTolerance: 6,
                },
            );

            const clusterResult = handleClusterClick(evt, feature);
            if (clusterResult.consumed) {
                if (clusterResult.station) {
                    const stationData = clusterResult.station;

                    const coord =
                        stationData.spiderfyPos ??
                        fromLonLat([stationData.lon, stationData.lat]);
                    const view = map.getView();
                    const resolution = view.getResolution() ?? 1;
                    const offsetY = 250 * resolution;
                    popupOverlay.current?.setPosition(coord);
                    view.animate({
                        center: [coord[0], coord[1] + offsetY],
                        zoom: view.getZoom() ?? getLastZoom(),
                        duration: 300,
                    });
                    setSelectedPopupStation(stationData);
                }
                // Multi-member cluster is handled by useClusterLayer hook
                return;
            }

            if (!feature) {
                popupOverlay.current?.setPosition(undefined);
                setSelectedPopupStation(null);
                return;
            }

            const stationData = feature.get("station") as
                | StationData
                | undefined;
            if (stationData) {
                const coord = fromLonLat([stationData.lon, stationData.lat]);
                const view = map.getView();
                const resolution = view.getResolution() ?? 1;
                const offsetY = 250 * resolution;
                popupOverlay.current?.setPosition(coord);
                view.animate({
                    center: [coord[0], coord[1] + offsetY],
                    zoom: view.getZoom() ?? getLastZoom(),
                    duration: 300,
                });
                setSelectedPopupStation(stationData);
            }
        };

        map.on("click" as any, handleClick);

        return () => {
            map.un("click" as any, handleClick);
        };
    }, [isMapReady, mapInstance, popupOverlay, handleClusterClick]);

    // ---- Helper: capture image with timeout ----
    return (
        <div className="z-10 pt-6 w-6/12 flex justify-center">
            <div className="w-full" style={{ position: "relative" }}>
                <div
                    id="map"
                    ref={mapRef}
                    className="h-[55vh]"
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                    }}
                />

                <div ref={tooltipRef} className="ol-tooltip-container">
                    {tooltipStation && (
                        <div className="ol-tooltip">
                            <strong className="text-lg">
                                {tooltipStation.network_code?.toUpperCase()}.
                                {tooltipStation.station_code?.toUpperCase()}
                            </strong>
                        </div>
                    )}
                </div>

                <NearbyStationsControl
                    showNearbyStations={showNearbyStations}
                    nearbyRadius={nearbyRadius}
                    setShowNearbyStations={setShowNearbyStations}
                    setNearbyRadius={setNearbyRadius}
                />

                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <VisitsScroller
                        showScroller={showScroller}
                        visits={visits}
                        changeKml={changeKml}
                        changeMeta={changeMeta}
                        stationMeta={stationMeta}
                        setChangeKml={visitScrollerProps.setChangeKml}
                        setChangeMeta={visitScrollerProps.setChangeMeta}
                        setShowScroller={setShowScroller}
                    />
                </div>

                <Popup
                    popupRef={popupRef}
                    popupOverlay={popupOverlay}
                    showPopup={isMapReady && !!selectedPopupStation}
                    reload={selectedPopupStation?.api_id !== station?.api_id}
                    fromMain={
                        selectedPopupStation?.api_id === station?.api_id
                            ? undefined
                            : selectedPopupStation?.api_id !== station?.api_id
                    }
                    station={selectedPopupStation}
                    setSelectedStation={setSelectedPopupStation}
                />
            </div>
        </div>
    );
};

export default MapStationOL;

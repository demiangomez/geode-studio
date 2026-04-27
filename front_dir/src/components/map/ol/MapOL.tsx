import React, { useEffect, useState, useRef, useMemo } from "react";

import { fromLonLat, toLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Icon from "ol/style/Icon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Cluster } from "ol/source";
import type { Geometry } from "ol/geom";

import { Style } from "ol/style";

import { Slider, Popup } from "@componentsReact";

import {
    useLocalStorage,
    useAuth,
    useApi,
    useMapInit,
    useKmlLayer,
    useClusterLayer,
} from "@hooks";

import { getStationTypesService, getStationStatusService } from "@services";

import {
    EarthquakeData,
    FilterState,
    GetParams,
    StationData,
    StationsAffectedServiceData,
    StationTypeServiceData,
    StationStatusServiceData,
    StationStatusData,
    StationTypeData,
} from "@types";

import { isStationFiltered, apiOkStatuses } from "@utils";

import {
    CLUSTER_MAX_ZOOM,
    CLUSTER_MIN_DISTANCE,
    clusterStyleFn,
    iconUrl,
    iconClass,
    createVectorArrowFeatures,
    getCachedColoredIcon,
    getIconScale,
} from "@olUtils";

import "./MapOL.css";

// ---------- Interfaces ----------

interface MapOLProps {
    handleEarthquakeState: (earthquake: EarthquakeData) => void;
    initialCenter: [number, number] | undefined;
    posToFly: [number, number] | undefined;
    topoMap?: boolean;
    filters?: {
        openFilters: boolean;
        stationType: boolean;
        stationWithProblems: boolean;
        stationWithoutProblems: boolean;
        stationStatus: boolean;
    };
    filterState?: FilterState;
    forceSyncScrollerMap?: number;
    mapState: boolean;
    mainParams: GetParams;
    earthquakes: EarthquakeData[];
    earthquakesFiltered: EarthquakeData[];
    earthquakeAffectedStations: StationsAffectedServiceData | undefined;
    earthQuakeChosen: EarthquakeData | undefined;
    toggleStateEarthquakeMask: boolean;
    toggleCoseismicVector: boolean;
    stations: StationData[] | undefined;
    showEarthquakeList: boolean;
    setForceSyncScrollerMap: React.Dispatch<React.SetStateAction<number>>;
    setEarthquakesFiltered: React.Dispatch<
        React.SetStateAction<EarthquakeData[]>
    >;
    setMainParams?: React.Dispatch<React.SetStateAction<GetParams>>;
    setShowScroller: React.Dispatch<React.SetStateAction<boolean>>;
    vectorMagnitude: number;
    setVectorMagnitude: React.Dispatch<React.SetStateAction<number>>;
}

// ---------- Component ----------

const MapOL: React.FC<MapOLProps> = ({
    handleEarthquakeState,
    initialCenter,
    posToFly,
    topoMap = false,
    filters,
    filterState,
    mapState,
    mainParams,
    earthquakes,
    earthquakesFiltered,
    earthquakeAffectedStations,
    earthQuakeChosen,
    toggleStateEarthquakeMask,
    toggleCoseismicVector,
    stations,
    setForceSyncScrollerMap,
    setEarthquakesFiltered,
    setShowScroller,
    vectorMagnitude,
    setVectorMagnitude,
}) => {
    const { token, logout, clusteringDistance } = useAuth();
    const api = useApi(token, logout);

    // DOM refs
    const mapRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // LocalStorage
    const [lastZoomLevel, setLastZoomLevel] = useLocalStorage(
        "lastZoomLevel",
        "8",
    );
    const [, setLastPosition] = useLocalStorage("lastPosition", "[0,0]");

    // State
    const [types, setTypes] = useState<{ image: string; name: string }[]>([]);
    const [statuses, setStatuses] = useState<{ name: string; color: string }[]>(
        [],
    );
    const [selectedStation, setSelectedStation] = useState<StationData | null>(
        null,
    );
    const [tooltipStation, setTooltipStation] = useState<StationData | null>(
        null,
    );
    const [tooltipEarthquake, setTooltipEarthquake] =
        useState<EarthquakeData | null>(null);
    const [selectedKmlPoint, setSelectedKmlPoint] = useState<{
        description: string;
        coordinate: number[];
    } | null>(null);

    // Initialize from localStorage — when restoring after navigation (e.g. back from station page),
    // this prevents the KML popup from auto-opening for an already-seen earthquake
    const [storedEqId] = useState<number | null>(() => {
        try {
            const stored = localStorage.getItem("earthquakeChosen");
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.api_id ?? null;
            }
        } catch {
            // ignore
        }
        return null;
    });
    const lastFitViewEqRef = useRef<number | null>(storedEqId);

    // Saved initial position from localStorage or props
    const savedCenter = useMemo<[number, number]>(() => {
        if (initialCenter) return initialCenter;
        const savedPosition = localStorage.getItem("lastPosition");
        if (savedPosition) {
            const parts = savedPosition.split(",").map(parseFloat);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return [parts[1], parts[0]];
            }
        }
        const firstStation = stations?.find((s) => s.lat && s.lon);
        if (firstStation) return [firstStation.lon, firstStation.lat];
        return [0, 0];
    }, [initialCenter, stations]);

    const savedZoom = useMemo(
        () => (lastZoomLevel ? parseInt(lastZoomLevel) : 8),
        [lastZoomLevel],
    );

    // ---------- Layer refs (must be declared BEFORE hook calls that use them) ----------
    const stationSourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );

    // ---------- Map init ----------
    const { mapInstance, popupOverlay, tooltipOverlay, isMapReady } =
        useMapInit({
            center: savedCenter,
            zoom: savedZoom,
            mapRef,
            popupRef,
            tooltipRef,
            enableScaleControl: true,
            enableZoomControl: true,
            topoMap,
        });

    const {
        clusterLayerRef,
        collapseSpider,
        handleClusterClick,
        handleClusterHover,
        clearHover,
    } = useClusterLayer({
        mapInstance,
        distance: clusteringDistance,
        isMapReady,
        stationSource: stationSourceRef.current,
        zIndex: 100,
        // defaults: distance=7, minDistance=5, styleFn=clusterStyleFn,
    });

    // KML hook for earthquake affected area KML
    const { loadKml, clearKml, kmlLayerRef } = useKmlLayer({
        mapInstance,
    });

    // ---------- Layer refs ----------
    const stationLayerRef = useRef<VectorLayer | null>(null);
    const earthquakeLayerRef = useRef<VectorLayer | null>(null);
    const earthquakeSourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const affectedStationLayerRef = useRef<VectorLayer | null>(null);
    const affectedStationSourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const vectorArrowLayerRef = useRef<VectorLayer | null>(null);
    const vectorArrowSourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    // Affected station cluster
    const affectedClusterLayerRef = useRef<VectorLayer | null>(null);
    const affectedClusterSourceRef = useRef(
        new Cluster({
            distance: CLUSTER_MIN_DISTANCE,
            minDistance: 5,
            source: affectedStationSourceRef.current,
            wrapX: true,
        }),
    );

    // Layer management ref to track added layers
    const layersInitialized = useRef(false);

    // ---------- Fetch types & statuses ----------
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [typesRes, statusesRes] = await Promise.all([
                    getStationTypesService<StationTypeServiceData>(api),
                    getStationStatusService<StationStatusServiceData>(api),
                ]);
                if (typesRes && apiOkStatuses.includes(typesRes.statusCode)) {
                    setTypes(
                        typesRes.data.map((t: StationTypeData) => ({
                            image: t.actual_image as string,
                            name: t.name,
                        })),
                    );
                }
                if (
                    statusesRes &&
                    apiOkStatuses.includes(statusesRes.statusCode)
                ) {
                    setStatuses(
                        statusesRes.data.map((s: StationStatusData) => ({
                            color: s.color_name,
                            name: s.name,
                        })),
                    );
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- Initialize layers ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || layersInitialized.current)
            return;

        const map = mapInstance.current;

        const currentZoom = map.getView().getZoom() ?? 0;
        const shouldCluster = currentZoom >= CLUSTER_MAX_ZOOM;

        // Station layer (visible when not clustering and not in earthquake mode)
        const stationLayer = new VectorLayer({
            source: stationSourceRef.current,
            updateWhileAnimating: true,
            updateWhileInteracting: true,
            zIndex: 50,
            visible: !mapState && !shouldCluster,
        });
        stationLayerRef.current = stationLayer;
        map.addLayer(stationLayer);

        // Earthquake layer
        const earthquakeLayer = new VectorLayer({
            source: earthquakeSourceRef.current,
            zIndex: 100,
            visible: mapState,
        });
        earthquakeLayerRef.current = earthquakeLayer;
        map.addLayer(earthquakeLayer);

        // Affected stations layer (visible during earthquake analysis, non-clustered)
        const affectedLayer = new VectorLayer({
            source: affectedStationSourceRef.current,
            zIndex: 120,
            visible: false,
        });
        affectedStationLayerRef.current = affectedLayer;
        map.addLayer(affectedLayer);

        // Affected stations cluster layer (visible during earthquake analysis at high zoom)
        const affectedClusterLayer = new VectorLayer({
            source: affectedClusterSourceRef.current,
            style: (feature) =>
                clusterStyleFn(feature as Feature<Geometry>) as Style,
            zIndex: 125,
            visible: false,
        });
        affectedClusterLayerRef.current = affectedClusterLayer;
        map.addLayer(affectedClusterLayer);

        // Coseismic vector arrows layer
        const arrowLayer = new VectorLayer({
            source: vectorArrowSourceRef.current,
            zIndex: 130,
            visible: false,
        });
        vectorArrowLayerRef.current = arrowLayer;
        map.addLayer(arrowLayer);

        // Toggle station/cluster visibility on zoom change
        const onResolutionChange = () => {
            const z = map.getView().getZoom() ?? 0;
            const cluster = z >= CLUSTER_MAX_ZOOM;

            // Station mode clustering
            if (
                stationLayerRef.current?.getVisible() ||
                clusterLayerRef.current?.getVisible()
            ) {
                stationLayerRef.current?.setVisible(!cluster);
                clusterLayerRef.current?.setVisible(cluster);
            }

            // Affected station clustering
            if (
                affectedStationLayerRef.current?.getVisible() ||
                affectedClusterLayerRef.current?.getVisible()
            ) {
                affectedStationLayerRef.current?.setVisible(!cluster);
                affectedClusterLayerRef.current?.setVisible(cluster);
            }
        };
        map.getView().on("change:resolution", onResolutionChange);

        layersInitialized.current = true;

        return () => {
            map.getView().un("change:resolution", onResolutionChange);
            [
                stationLayer,
                earthquakeLayer,
                affectedLayer,
                affectedClusterLayer,
                arrowLayer,
            ].forEach((l) => map.removeLayer(l));
            layersInitialized.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    // ---------- layer visibility on mapState change ----------
    useEffect(() => {
        const z = mapInstance.current?.getView().getZoom() ?? 0;
        const shouldCluster = z >= CLUSTER_MAX_ZOOM;
        stationLayerRef.current?.setVisible(!mapState && !shouldCluster);
        clusterLayerRef.current?.setVisible(!mapState && shouldCluster);
        earthquakeLayerRef.current?.setVisible(mapState);

        if (!mapState) {
            affectedStationLayerRef.current?.setVisible(false);
            affectedClusterLayerRef.current?.setVisible(false);
            vectorArrowLayerRef.current?.setVisible(false);
            clearKml();
        } else {
            // Earthquake mode - hide all station layers
            stationLayerRef.current?.setVisible(false);
            clusterLayerRef.current?.setVisible(false);
            collapseSpider();
        }

        earthquakeLayerRef.current?.setVisible(mapState);
        setShowScroller(false);
    }, [isMapReady, mapState, clearKml, setShowScroller, collapseSpider]);

    // ---------- Filtered stations (OL Canvas handles viewport culling) ----------
    const filteredStations = useMemo(() => {
        if (!stations || mapState) return [];

        const hasActiveFilters =
            filters?.stationWithProblems ||
            filters?.stationWithoutProblems ||
            (Array.isArray(filterState?.statusOption) &&
                filterState!.statusOption.length > 0) ||
            (Array.isArray(filterState?.typeOption) &&
                filterState!.typeOption.length > 0);

        return hasActiveFilters
            ? stations.filter((s) => isStationFiltered(s, filterState, filters))
            : stations;
        // Solo recalculo al cambiar de estaciones, filtros o modo mapa/terremoto
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        stations,
        mapState,
        filters?.stationWithProblems,
        filters?.stationWithoutProblems,
        filterState,
    ]);

    // Stable refs — avoid effect re-registration when callback/prop changes
    const handleEarthquakeStateRef = useRef(handleEarthquakeState);
    const earthQuakeChosenRef = useRef(earthQuakeChosen);
    const selectedStationRef = useRef(selectedStation);

    useEffect(() => {
        handleEarthquakeStateRef.current = handleEarthquakeState;
        earthQuakeChosenRef.current = earthQuakeChosen;
        selectedStationRef.current = selectedStation;
    });

    // Tooltip dedup — skip setState when same feature is under cursor
    const lastTooltipFeatureRef = useRef<Feature<Geometry> | null>(null);

    // ---------- Station features ----------
    useEffect(() => {
        if (!isMapReady || mapState) return;

        let isCancelled = false;
        stationSourceRef.current.clear();

        const stationsToRender = filteredStations;

        const addFeatures = async () => {
            const features: Feature<Geometry>[] = [];
            const BATCH_SIZE = 50;

            for (let i = 0; i < stationsToRender.length; i += BATCH_SIZE) {
                if (isCancelled) return;
                const batch = stationsToRender.slice(i, i + BATCH_SIZE);
                const batchFeatures = await Promise.all(
                    batch.map(async (s) => {
                        if (s.lat == null || s.lon == null) return null;

                        const feature = new Feature({
                            geometry: new Point(fromLonLat([s.lon, s.lat])),
                        });
                        feature.set("station", s);

                        const iconSrc = iconUrl(s, types);
                        const cssClass = iconClass(s, statuses);
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
                                    // anchor: [0.5, 1], Me genera espacio entre el punto real y el icono lo que hace un desfase en el mapa en x zoom
                                    crossOrigin: "anonymous",
                                }),
                            }),
                        );
                        return feature;
                    }),
                );

                if (isCancelled) return;
                const validFeatures = batchFeatures.filter(
                    (f) => f !== null,
                ) as Feature<Geometry>[];
                features.push(...validFeatures);
                // Yield to main thread between batches
                if (i + BATCH_SIZE < stationsToRender.length) {
                    await new Promise((r) => setTimeout(r, 0));
                }
            }

            if (!isCancelled && features.length > 0) {
                stationSourceRef.current.addFeatures(features);

                // Toggle visibility based on zoom after features are added
                // const z = mapInstance.current?.getView().getZoom() ?? 0;
                // Clustering at LOW zooms (far away), individual stations at HIGH zooms (close)
                // const shouldCluster = z >= CLUSTER_MAX_ZOOM;
                // stationLayerRef.current?.setVisible(!shouldCluster);
                // clusterLayerRef.current?.setVisible(shouldCluster);
            }
        };

        addFeatures();

        return () => {
            isCancelled = true;
        };
    }, [isMapReady, mapState, filteredStations, types, statuses]);

    // ---------- Earthquake features ----------
    useEffect(() => {
        if (!isMapReady) return;
        earthquakeSourceRef.current.clear();

        if (!mapState) return;

        const eqs =
            earthQuakeChosen === undefined &&
            earthquakeAffectedStations === undefined
                ? earthquakesFiltered
                : [];

        const features: Feature<Geometry>[] = [];
        for (const eq of eqs) {
            if (eq.lat == null || eq.lon == null) continue;

            const feature = new Feature({
                geometry: new Point(fromLonLat([eq.lon, eq.lat])),
            });
            feature.set("earthquake", eq);

            const isChosen = eq.api_id === earthQuakeChosen?.api_id;
            const iconScale = isChosen ? 0.55 : 0.4;

            feature.setStyle(
                new Style({
                    image: new Icon({
                        src: "https://maps.google.com/mapfiles/kml/shapes/star.png",
                        scale: iconScale,
                        // anchor: [0.5, 0.5],
                        crossOrigin: "anonymous",
                    }),
                }),
            );
            features.push(feature);
        }

        if (features.length > 0) {
            earthquakeSourceRef.current.addFeatures(features);
        }
    }, [
        isMapReady,
        mapState,
        earthquakesFiltered,
        earthQuakeChosen,
        earthquakeAffectedStations,
    ]);

    // ---------- Affected stations & coseismic vectors ----------
    useEffect(() => {
        if (!isMapReady) return;

        affectedStationSourceRef.current.clear();
        vectorArrowSourceRef.current.clear();

        if (!mapState || !earthQuakeChosen || !earthquakeAffectedStations) {
            affectedStationLayerRef.current?.setVisible(false);
            affectedClusterLayerRef.current?.setVisible(false);
            vectorArrowLayerRef.current?.setVisible(false);
            return;
        }

        const affectedList = toggleStateEarthquakeMask
            ? earthquakeAffectedStations.affected_stations_including_postseismic
            : earthquakeAffectedStations.affected_stations_without_postseismic;

        let isCancelled = false;

        const addAffected = async () => {
            const stationFeatures: Feature<Geometry>[] = [];
            const arrowFeatures: Feature<Geometry>[] = [];

            for (const s of affectedList) {
                if (isCancelled) return;

                const station = stations?.find(
                    (st) =>
                        st.network_code === s.network_code &&
                        st.station_code === s.station_code,
                );
                if (!station || !station.lat || !station.lon) continue;

                const iconSrc = iconUrl(station, types);
                const cssClass = iconClass(station, statuses);
                const hasIssues = station.has_gaps || !station.has_stationinfo;

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
                    geometry: new Point(fromLonLat([station.lon, station.lat])),
                });
                feature.set("station", station);
                feature.set("affected", true);
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
                stationFeatures.push(feature);

                // Coseismic vector
                if (toggleCoseismicVector) {
                    const displacement =
                        earthquakeAffectedStations.coseismic_displacements.find(
                            (d) =>
                                d.NetworkCode === s.network_code &&
                                d.StationCode === s.station_code,
                        );
                    if (displacement) {
                        const arrows = createVectorArrowFeatures(
                            station,
                            displacement,
                            vectorMagnitude,
                        );
                        arrowFeatures.push(...arrows);
                    }
                }
            }

            if (!isCancelled) {
                if (stationFeatures.length > 0) {
                    affectedStationSourceRef.current.addFeatures(
                        stationFeatures,
                    );
                }
                // Toggle between individual markers and clusters based on zoom
                const z = mapInstance.current?.getView().getZoom() ?? 0;
                const shouldCluster = z >= CLUSTER_MAX_ZOOM;
                affectedStationLayerRef.current?.setVisible(!shouldCluster);
                affectedClusterLayerRef.current?.setVisible(shouldCluster);

                if (toggleCoseismicVector && arrowFeatures.length > 0) {
                    vectorArrowSourceRef.current.addFeatures(arrowFeatures);
                    vectorArrowLayerRef.current?.setVisible(true);
                } else {
                    vectorArrowLayerRef.current?.setVisible(false);
                }
            }
        };

        addAffected();

        return () => {
            isCancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isMapReady,
        mapState,
        earthQuakeChosen,
        earthquakeAffectedStations,
        toggleStateEarthquakeMask,
        toggleCoseismicVector,
        vectorMagnitude,
        stations,
        types,
        statuses,
    ]);

    // Immediately clear KML when earthquake is deselected
    useEffect(() => {
        if (!earthQuakeChosen) {
            clearKml();
            lastFitViewEqRef.current = null;
        }
    }, [earthQuakeChosen, clearKml]);

    // ---------- KML for affected area ----------
    useEffect(() => {
        let isCancelled = false;
        const eqChosen = earthQuakeChosenRef.current;

        // Clear KML, affected stations ghosting and popups when earthquake is deselected or map mode is toggled
        if (
            !isMapReady ||
            !mapState ||
            !eqChosen ||
            !earthquakeAffectedStations
        ) {
            clearKml();
            affectedStationLayerRef.current?.clearRenderer();
            setSelectedKmlPoint(null);
            setSelectedStation(null);
            return;
        }

        const kmlData = toggleStateEarthquakeMask
            ? earthquakeAffectedStations.kml_including_postseismic
            : earthquakeAffectedStations.kml_without_postseismic;

        if (kmlData) {
            const isNewEarthquake =
                eqChosen.api_id !== lastFitViewEqRef.current;

            loadKml(kmlData, { fitView: false }).then(() => {
                if (isCancelled) return;

                // Only open when is new earthquake -  if user is changing between
                // masks for the same earthquake, dont open popup again
                if (!isNewEarthquake) return;

                // Auto-open the KML popup for the selected earthquake
                const kmlSource = kmlLayerRef.current?.getSource();
                if (!kmlSource || !mapInstance.current) return;
                const pointFeature = kmlSource
                    .getFeatures()
                    .find(
                        (f: Feature<Geometry>) =>
                            f.getGeometry()?.getType() === "Point" &&
                            (f.get("description") as string)?.trim(),
                    );

                if (pointFeature) {
                    const desc = pointFeature.get("description") as string;
                    const coord = (
                        pointFeature.getGeometry() as Point
                    ).getCoordinates();

                    const map = mapInstance.current!;
                    // KML features are loaded — wait for render, then show popup with centered animation
                    map.once("rendercomplete", () => {
                        const view = map.getView();
                        const resolution = view.getResolution() ?? 1;
                        const offsetY = 150 * resolution;
                        popupOverlay.current?.setPosition(coord);
                        view.animate({
                            center: [coord[0], coord[1] + offsetY],
                            zoom:
                                view.getZoom() ??
                                parseInt(
                                    localStorage.getItem("lastZoomLevel") ??
                                        "8",
                                ),
                            duration: 300,
                        });
                        setSelectedStation(null);
                        setSelectedKmlPoint({
                            description: desc,
                            coordinate: coord,
                        });
                    });
                    map.render();
                }
            });
            if (isNewEarthquake) {
                lastFitViewEqRef.current = eqChosen.api_id;
            }
        }
        // kmlLayerRef, mapInstance, popupOverlay are stable refs
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => {
            isCancelled = true;
        };
    }, [
        isMapReady,
        mapState,
        earthquakeAffectedStations,
        earthQuakeChosen?.api_id,
        toggleStateEarthquakeMask,
        loadKml,
        clearKml,
    ]);

    // ---------- Map move/zoom listeners ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;
        const view = map.getView();

        const onMoveEnd = () => {
            const center = view.getCenter();
            if (center) {
                const [lon, lat] = toLonLat(center);
                setLastPosition(`${lat},${lon}`);
            }
            const z = view.getZoom();
            if (z != null) {
                setLastZoomLevel(z.toString());
            }
        };

        map.on("moveend", onMoveEnd);

        return () => {
            map.un("moveend", onMoveEnd);
        };
        // Register once — uses ref for latest callback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    // ---------- posToFly ----------
    useEffect(() => {
        if (!posToFly || !mapInstance.current) return;
        const view = mapInstance.current.getView();
        const savedZoom =
            Number(localStorage.getItem("lastZoomLevel")) ||
            view.getMinZoom() ||
            3;
        view.animate({
            center: fromLonLat([posToFly[1], posToFly[0]]),
            zoom: savedZoom,
            duration: 500,
        });
    }, [posToFly, mapInstance]);

    // ---------- initialCenter ----------
    useEffect(() => {
        if (!initialCenter || !mapInstance.current || mapState) return;
        const view = mapInstance.current.getView();
        // Read zoom imperatively — reacting to lastZoomLevel would cause
        // animate → moveend → setLastZoomLevel → re-render → animate loop
        const stored = localStorage.getItem("lastZoomLevel");
        const z = stored ? parseInt(stored) : 8;

        view.animate({
            center: fromLonLat(initialCenter),
            zoom: z,
            duration: 300,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCenter, mapState]);

    // ---------- Earthquake markers update on bounds ----------
    useEffect(() => {
        if (mapState && !earthQuakeChosen) {
            setEarthquakesFiltered((prev) => {
                // Prevent loop when parent passes a new [] reference each render
                if (prev.length === 0 && earthquakes.length === 0) return prev;
                return earthquakes;
            });
        }
    }, [mapState, earthquakes, earthQuakeChosen, setEarthquakesFiltered]);

    // ---------- Click handler ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        const handleClick = (evt: any) => {
            const feature = map.forEachFeatureAtPixel(
                evt.pixel,
                (f: any) => f,
                {
                    hitTolerance: 8,
                },
            );

            const clusterResult = handleClusterClick(evt, feature);
            if (clusterResult.consumed) {
                if (clusterResult.station) {
                    const stationData = clusterResult.station;
                    const coord =
                        stationData.spiderfyPos ??
                        fromLonLat([stationData.lon, stationData.lat]);
                    popupOverlay.current?.setPosition(coord);
                    const currentView = map.getView();
                    const resolution = currentView.getResolution() ?? 1;
                    const offsetY = 150 * resolution;
                    const offsetCenter: [number, number] = [
                        coord[0],
                        coord[1] + offsetY,
                    ];
                    const currentZoom =
                        currentView.getZoom() ??
                        parseInt(localStorage.getItem("lastZoomLevel") ?? "8");
                    currentView.animate({
                        center: offsetCenter,
                        zoom: currentZoom,
                        duration: 300,
                    });
                    setSelectedKmlPoint(null);
                    setSelectedStation(stationData);
                }
                return;
            }

            if (!feature) {
                popupOverlay.current?.setPosition(undefined);
                setSelectedStation(null);
                setSelectedKmlPoint(null);
                return;
            }

            // Station click (individual, non-clustered)
            const stationData = feature.get("station") as
                | StationData
                | undefined;
            if (stationData) {
                const coord = fromLonLat([stationData.lon, stationData.lat]);
                popupOverlay.current?.setPosition(coord);
                const currentView = map.getView();
                const resolution = currentView.getResolution() ?? 1;
                const offsetY = 150 * resolution;
                const offsetCenter: [number, number] = [
                    coord[0],
                    coord[1] + offsetY,
                ];
                const currentZoom =
                    currentView.getZoom() ??
                    parseInt(localStorage.getItem("lastZoomLevel") ?? "8");
                currentView.animate({
                    center: offsetCenter,
                    zoom: currentZoom,
                    duration: 300,
                });
                setSelectedKmlPoint(null);
                setSelectedStation(stationData);
                return;
            }

            // Earthquake click — popup opens via the earthQuakeChosen effect
            const earthquakeData = feature.get("earthquake") as
                | EarthquakeData
                | undefined;
            if (earthquakeData) {
                handleEarthquakeStateRef.current(earthquakeData);
                setForceSyncScrollerMap((prev) => prev + 1);
                return;
            }

            // Close station popup if a KML layer feature is clicked
            const isKmlLayer =
                feature &&
                kmlLayerRef.current
                    ?.getSource()
                    ?.hasFeature(feature as Feature<Geometry>);

            if (selectedStationRef.current && (!feature || isKmlLayer)) {
                popupOverlay.current?.setPosition(undefined);
                setSelectedStation(null);
                return;
            }
            // ---

            // KML point feature
            const kmlDescription = feature.get("description") as
                | string
                | undefined;
            if (
                kmlDescription?.trim() &&
                feature.getGeometry()?.getType() === "Point"
            ) {
                const coord = (feature.getGeometry() as Point).getCoordinates();
                const currentView = map.getView();
                const resolution = currentView.getResolution() ?? 1;
                const offsetY = 150 * resolution;
                const offsetCenter: [number, number] = [
                    coord[0],
                    coord[1] + offsetY,
                ];
                const currentZoom =
                    currentView.getZoom() ??
                    parseInt(localStorage.getItem("lastZoomLevel") ?? "8");
                popupOverlay.current?.setPosition(coord);
                currentView.animate({
                    center: offsetCenter,
                    zoom: currentZoom,
                    duration: 300,
                });
                setSelectedStation(null);
                setSelectedKmlPoint({
                    description: kmlDescription,
                    coordinate: coord,
                });
                return;
            }
        };

        map.on("click" as any, handleClick);

        return () => {
            map.un("click" as any, handleClick);
        };
        // Register once — uses refs for latest callbacks
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    // ---------- Pointer move (tooltip) ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        const handlePointerMove = (evt: any) => {
            if (evt.dragging) {
                if (lastTooltipFeatureRef.current !== null) {
                    tooltipOverlay.current?.setPosition(undefined);
                    setTooltipStation(null);
                    setTooltipEarthquake(null);
                    lastTooltipFeatureRef.current = null;
                }
                clearHover();
                return;
            }

            const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
                hitTolerance: 8,
            }) as Feature<Geometry> | undefined;

            if (feature === lastTooltipFeatureRef.current) return;
            lastTooltipFeatureRef.current = feature ?? null;

            const hoverResult = handleClusterHover(feature);
            if (hoverResult.consumed) {
                map.getTargetElement().classList.add("has-feature");
                if (hoverResult.tooltipStation && hoverResult.tooltipCoord) {
                    tooltipOverlay.current?.setPosition(
                        hoverResult.tooltipCoord,
                    );
                    setTooltipStation(hoverResult.tooltipStation);
                    setTooltipEarthquake(null);
                } else {
                    tooltipOverlay.current?.setPosition(undefined);
                    setTooltipStation(null);
                    setTooltipEarthquake(null);
                }
                return;
            }

            if (!feature) {
                tooltipOverlay.current?.setPosition(undefined);
                setTooltipStation(null);
                setTooltipEarthquake(null);
                map.getTargetElement().classList.remove("has-feature");
                return;
            }

            map.getTargetElement().classList.add("has-feature");

            const stationData = feature.get("station") as
                | StationData
                | undefined;
            if (stationData) {
                const coord = fromLonLat([stationData.lon, stationData.lat]);
                tooltipOverlay.current?.setPosition(coord);
                setTooltipStation(stationData);
                setTooltipEarthquake(null);
                return;
            }

            const eqData = feature.get("earthquake") as
                | EarthquakeData
                | undefined;
            if (eqData) {
                const coord = fromLonLat([eqData.lon, eqData.lat]);
                tooltipOverlay.current?.setPosition(coord);
                setTooltipEarthquake(eqData);
                setTooltipStation(null);
                return;
            }

            // KML point feature — pointer cursor only, popup opens on click
            const kmlDesc = feature.get("description") as string | undefined;
            if (
                kmlDesc?.trim() &&
                feature.getGeometry()?.getType() === "Point"
            ) {
                tooltipOverlay.current?.setPosition(undefined);
                setTooltipStation(null);
                setTooltipEarthquake(null);
                return;
            }

            tooltipOverlay.current?.setPosition(undefined);
            setTooltipStation(null);
            setTooltipEarthquake(null);
        };

        map.on("pointermove" as any, handlePointerMove);

        return () => {
            map.un("pointermove" as any, handlePointerMove);
        };
        // register once — uses refs for overlay (stable anyway)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    return (
        <div className="z-10 w-full flex justify-end">
            <div style={{ position: "relative" }} className="w-full">
                <div id="map" ref={mapRef} className="w-full h-[92vh]" />

                <div ref={tooltipRef} className="ol-tooltip-container">
                    {tooltipStation && (
                        <div className="ol-tooltip">
                            <strong className="text-lg">
                                {tooltipStation.network_code?.toUpperCase()}.
                                {tooltipStation.station_code?.toUpperCase()}
                            </strong>
                        </div>
                    )}
                    {tooltipEarthquake && (
                        <div className="ol-tooltip">
                            <strong className="text-lg">
                                {tooltipEarthquake.location?.toUpperCase()} (M{" "}
                                {tooltipEarthquake.mag?.toString()}){" "}
                                {new Date(
                                    tooltipEarthquake.date,
                                ).toLocaleDateString()}
                            </strong>
                        </div>
                    )}
                </div>

                <Popup
                    popupRef={popupRef}
                    popupOverlay={popupOverlay}
                    showPopup={!!selectedStation || !!selectedKmlPoint}
                    fromMain={true}
                    mainParams={mainParams}
                    station={selectedStation}
                    kmlPoint={selectedKmlPoint}
                    setSelectedStation={setSelectedStation}
                    setSelectedKmlPoint={setSelectedKmlPoint}
                />

                {toggleCoseismicVector && earthQuakeChosen !== undefined && (
                    <div
                        className="absolute right-[50px] bottom-[25px] z-[1000] w-[300px]"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <Slider
                            classContainer="bg-zinc-50 rounded-md p-2"
                            tittle="Vector Field Scale"
                            minValue={1}
                            maxValue={20}
                            value={vectorMagnitude}
                            onChange={(e) => {
                                setVectorMagnitude(Number(e.target.value));
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapOL;

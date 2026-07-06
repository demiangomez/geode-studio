import React, {
    useEffect,
    useState,
    useRef,
    useMemo,
    useCallback,
} from "react";

import { fromLonLat, toLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Icon from "ol/style/Icon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Cluster } from "ol/source";
import type { Geometry } from "ol/geom";

import { Style } from "ol/style";

import { Slider, Popup, PopupChildren } from "@componentsReact";
import "./MapOL.css";

import {
    useAuth,
    useApi,
    useMapInit,
    useMultiKmlLayer,
    useClusterLayer,
    useCesiumGlobe,
} from "@hooks";

import { useMetadata } from "@hooks/queries";

import {
    EarthquakeData,
    GetParams,
    StationData,
    StationsAffectedServiceData,
} from "@types";

import { isStationFiltered, isStationInTemporalWindow } from "@utils";

import {
    CLUSTER_MAX_ZOOM,
    CLUSTER_MIN_DISTANCE,
    clusterStyleFn,
    iconUrl,
    iconClass,
    createVectorArrowFeatures,
    getCachedColoredIcon,
    getIconScale,
    earthquakeSelectedStyle,
    getLastZoom,
    getLastCenterLonLat,
    saveLastView,
} from "@olUtils";

interface MapOLProps {
    handleEarthquakeState: (earthquake: EarthquakeData) => void;
    posToFly: [number, number] | undefined;
    mapState: boolean;
    mainParams: GetParams;
    earthquakesFiltered: EarthquakeData[];
    earthquakeAffectedStations: StationsAffectedServiceData | undefined;
    earthQuakeChosen: EarthquakeData | undefined;
    stations: StationData[] | undefined;
    showEarthquakeList: boolean;
    setMainParams?: React.Dispatch<React.SetStateAction<GetParams>>;
}

import { useMapStore } from "@store";

const MapOL: React.FC<MapOLProps> = ({
    handleEarthquakeState,
    posToFly,
    mapState,
    mainParams,
    earthquakesFiltered,
    earthquakeAffectedStations,
    earthQuakeChosen,
    stations,
}) => {
    const mapLayerState = useMapStore((s) => s.mapLayerState);
    const mapProjectionState = useMapStore((s) => s.mapProjectionState);
    const filters = useMapStore((s) => s.filters);
    const filterState = useMapStore((s) => s.filterState);
    const toggleStateEarthquakeMask = useMapStore(
        (s) => s.toggleStateEarthquakeMask,
    );
    const toggleCoseismicVector = useMapStore((s) => s.toggleCoseismicVector);
    const vectorMagnitude = useMapStore((s) => s.vectorMagnitude);
    const temporalFilter = useMapStore((s) => s.temporalFilter);
    const stationRinexOnDate = useMapStore((s) => s.stationRinexOnDate);

    const selectedEarthquakes = useMapStore((s) => s.selectedEarthquakes);

    const setForceSyncScrollerMap = useMapStore(
        (s) => s.setForceSyncScrollerMap,
    );
    const setShowScroller = useMapStore((s) => s.setShowScroller);
    const setVectorMagnitude = useMapStore((s) => s.setVectorMagnitude);
    const setIsPopulated = useMapStore((s) => s.setIsPopulated);

    const { token, logout, clusteringDistance } = useAuth();
    const api = useApi(token, logout);

    // DOM refs
    const mapRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Metadata
    const { types, statuses } = useMetadata(api);

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

    const cesiumPopupRef = useRef<HTMLDivElement>(null);
    const cesiumTooltipRef = useRef<HTMLDivElement>(null);
    const cesiumPopupCartesian = useRef<any>(null);
    const cesiumTooltipCartesian = useRef<any>(null);

    const [isCesiumPopupActive, setIsCesiumPopupActive] = useState(false);
    const [isCesiumTooltipActive, setIsCesiumTooltipActive] = useState(false);

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

    // Saved initial position — always the user's last freely-navigated center/zoom
    const savedCenter = useMemo<[number, number]>(() => {
        const lastCenter = getLastCenterLonLat();
        if (lastCenter) return lastCenter;
        const firstStation = stations?.find((s) => s.lat && s.lon);
        if (firstStation) return [firstStation.lon, firstStation.lat];
        return [0, 0];
    }, [stations]);

    const savedZoom = useMemo(() => getLastZoom(), []);

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
            mapLayerState,
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
    const { loadMultipleKml, clearAllKml, isKmlFeature } = useMultiKmlLayer({
        mapInstance,
    });

    // ---------- Cesium 3D Globe ----------
    const { ol3dRef, isGlobeActive } = useCesiumGlobe({
        mapInstance,
        isMapReady,
        globeEnabled: mapProjectionState?.globe ?? false,
        mapLayerState,
    });

    const isGlobeActiveRef = useRef(isGlobeActive);
    useEffect(() => {
        isGlobeActiveRef.current = isGlobeActive;
    }, [isGlobeActive]);

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

    const affectedList = earthquakeAffectedStations?.active_affected_stations;

    const applyTemporalFiltering = useCallback(
        (baseList: StationData[]) => {
            const { dateStart, dateEnd, exactDate, hiddenPoints } =
                temporalFilter;

            // Si no hay filtro temporal aplicado, devolvemos todo sin alterar
            if (dateStart === null && dateEnd === null) {
                return baseList.map((s) => ({
                    ...s,
                    _temporalHasData: true,
                    _temporalHidden: false,
                }));
            }

            // Evaluamos estacion por estacion segun el modo (exactDate vs rango)
            return baseList.flatMap((s) => {
                let hasData = false;

                if (exactDate) {
                    hasData =
                        s.api_id !== undefined &&
                        stationRinexOnDate.includes(s.api_id);
                } else {
                    hasData = isStationInTemporalWindow(s, dateStart, dateEnd);
                }

                // Si esta habilitado ocultar los puntos sin datos y no tiene datos, la omitimos
                if (hiddenPoints && !hasData) {
                    return [];
                }

                return [
                    {
                        ...s,
                        _temporalHasData: hasData,
                        _temporalHidden: false,
                    },
                ];
            });
        },
        [
            temporalFilter.exactDate ? null : temporalFilter.dateEnd,
            temporalFilter.exactDate ? null : temporalFilter.dateStart,
            temporalFilter.exactDate,
            temporalFilter.hiddenPoints,
            stationRinexOnDate,
        ],
    );

    const affectedStationList = useMemo(() => {
        if (!affectedList || !stations) return [];

        let baseAffected = affectedList.flatMap((afs) => {
            const station = stations.find(
                (s) =>
                    s.station_code === afs.station_code &&
                    s.network_code === afs.network_code,
            );

            return station ? [station] : [];
        });

        // Aplicar filtros de dropdowns (problemas, tipo, estado)
        // TODO: Cuando me hagan el issue.

        // const hasActiveFilters =
        //     filters?.stationWithProblems ||
        //     filters?.stationWithoutProblems ||
        //     (Array.isArray(filterState?.statusOption) &&
        //         filterState!.statusOption.length > 0) ||
        //     (Array.isArray(filterState?.typeOption) &&
        //         filterState!.typeOption.length > 0);
        // if (hasActiveFilters) {
        //     baseAffected = baseAffected.filter((s) =>
        //         isStationFiltered(s, filterState, filters),
        //     );
        // }

        // Aplicar filtros de búsqueda (searchInput) localmente
        if (mainParams.station_code) {
            const search = mainParams.station_code.toLowerCase();
            baseAffected = baseAffected.filter((s) =>
                s.station_code?.toLowerCase().includes(search),
            );
        }
        if (mainParams.network_code) {
            const search = mainParams.network_code.toLowerCase();
            baseAffected = baseAffected.filter(
                (s) => s.network_code?.toLowerCase() === search,
            );
        }
        if (mainParams.country_code) {
            const search = mainParams.country_code.toLowerCase();
            baseAffected = baseAffected.filter(
                (s) => s.country_code?.toLowerCase() === search,
            );
        }
        return applyTemporalFiltering(baseAffected);

        return applyTemporalFiltering(baseAffected);
    }, [affectedList, stations, applyTemporalFiltering]);

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

        const baseFiltered = hasActiveFilters
            ? stations.filter((s) => isStationFiltered(s, filterState, filters))
            : stations;

        return applyTemporalFiltering(baseFiltered);
    }, [
        stations,
        mapState,
        filters.stationWithProblems,
        filters.stationWithoutProblems,
        filterState,
        applyTemporalFiltering,
    ]);

    // Layer management ref to track added layers
    const layersInitialized = useRef(false);

    // ---------- Fetch types & statuses ----------
    useEffect(() => {
        setIsPopulated(false);

        return () => {
            setIsPopulated(false);
        };
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

        // In globe mode, disable clustering (OL-Cesium doesn't sync Cluster sources well)
        const clusteringAllowed = !isGlobeActive;

        stationLayerRef.current?.setVisible(
            !mapState && (clusteringAllowed ? !shouldCluster : true),
        );
        clusterLayerRef.current?.setVisible(
            !mapState && clusteringAllowed && shouldCluster,
        );
        earthquakeLayerRef.current?.setVisible(mapState);

        if (!mapState) {
            affectedStationLayerRef.current?.setVisible(false);
            affectedClusterLayerRef.current?.setVisible(false);
            vectorArrowLayerRef.current?.setVisible(false);
            clearAllKml();
        } else {
            // Earthquake mode - hide all station layers
            stationLayerRef.current?.setVisible(false);
            clusterLayerRef.current?.setVisible(false);
            collapseSpider();
        }

        // Collapse spider when switching to globe (not supported in 3D)
        if (isGlobeActive) {
            collapseSpider();
            clusterLayerRef.current?.setVisible(false);
        }

        earthquakeLayerRef.current?.setVisible(mapState);
        setShowScroller(false);
    }, [
        isMapReady,
        mapState,
        isGlobeActive,
        clearAllKml,
        setShowScroller,
        collapseSpider,
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

    // Station Feature Render
    const createStationFeature = useCallback(
        async (s: StationData, isFromEarthquake: boolean) => {
            const feature = new Feature({
                geometry: new Point(fromLonLat([s.lon, s.lat])),
            });

            feature.set("station", s);
            if (isFromEarthquake) feature.set("affected", true);

            // logica de estilos

            const isGrayed = (s as any)._temporalHasData === false;
            const isHidden = (s as any)._temporalHidden === true;
            const iconSrc = iconUrl(s, types ?? []);
            const cssClass = iconClass(s, statuses ?? []);
            const hasIssues = s.has_gaps || !s.has_stationinfo;
            let finalIconSrc = iconSrc;
            if (cssClass && !hasIssues) {
                finalIconSrc = await getCachedColoredIcon(iconSrc, cssClass);
            }

            let scale = await getIconScale(finalIconSrc);
            if (hasIssues) scale *= 0.7;
            if (isHidden) {
                feature.setStyle(new Style({}));
                return feature;
            } else if (isGrayed) {
                feature.setStyle(
                    new Style({
                        image: new Icon({
                            src: finalIconSrc,
                            scale,
                            opacity: 0.3,
                            crossOrigin: "anonymous",
                        }),
                    }),
                );
                return feature;
            } else {
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
            }

            return feature;
        },
        [types, statuses],
    );

    // ---------- Station features ----------
    useEffect(() => {
        if (!isMapReady || mapState) return;

        let isCancelled = false;
        setIsPopulated(false);
        collapseSpider();

        const stationsToRender = filteredStations;

        const addFeatures = async () => {
            const features: Feature<Geometry>[] = [];
            const BATCH_SIZE = 350;

            for (let i = 0; i < stationsToRender.length; i += BATCH_SIZE) {
                if (isCancelled) return;
                const batch = stationsToRender.slice(i, i + BATCH_SIZE);
                const batchFeatures = await Promise.all(
                    batch.map((s) => createStationFeature(s, false)),
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

            if (!isCancelled) {
                // Borramos y agregamos de forma sincrona para evitar el parpadeo en el mapa
                stationSourceRef.current.clear();
                if (features.length > 0) {
                    stationSourceRef.current.addFeatures(features);
                }
                setIsPopulated(true);
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

        if (!mapState) {
            earthquakeSourceRef.current.clear();
            return;
        }

        let isCancelled = false;
        const eqs =
            earthQuakeChosen === undefined &&
                earthquakeAffectedStations === undefined
                ? earthquakesFiltered
                : [];

        if (eqs.length === 0) {
            earthquakeSourceRef.current.clear();
            return;
        }

        setIsPopulated(false);

        const addEqFeatures = async () => {
            const features: Feature<Geometry>[] = [];
            const BATCH_SIZE = 500;

            for (let i = 0; i < eqs.length; i += BATCH_SIZE) {
                if (isCancelled) return;
                const batch = eqs.slice(i, i + BATCH_SIZE);

                for (const eq of batch) {
                    if (eq.lat == null || eq.lon == null) continue;

                    const feature = new Feature({
                        geometry: new Point(fromLonLat([eq.lon, eq.lat])),
                    });
                    feature.set("earthquake", eq);

                    const isChosen = eq.api_id === earthQuakeChosen?.api_id;
                    const iconScale = isChosen ? 0.55 : 0.4;

                    feature.setStyle(
                        earthquakeSelectedStyle(isChosen, iconScale),
                    );
                    features.push(feature);
                }

                // Yield to main thread
                if (i + BATCH_SIZE < eqs.length) {
                    await new Promise((r) => setTimeout(r, 0));
                }
            }

            if (!isCancelled) {
                earthquakeSourceRef.current.clear();
                if (features.length > 0) {
                    earthquakeSourceRef.current.addFeatures(features);
                }
                setIsPopulated(true);
            }
        };

        addEqFeatures();

        return () => {
            isCancelled = true;
        };
    }, [
        isMapReady,
        mapState,
        earthquakesFiltered,
        earthQuakeChosen,
        earthquakeAffectedStations,
        setIsPopulated,
    ]);

    // ---------- Affected stations ----------
    useEffect(() => {
        if (!isMapReady) return;

        if (!mapState || !earthQuakeChosen || !earthquakeAffectedStations) {
            affectedStationLayerRef.current?.setVisible(false);
            affectedClusterLayerRef.current?.setVisible(false);
            return;
        }

        affectedStationSourceRef.current.clear();
        setIsPopulated(false);
        collapseSpider();

        let isCancelled = false;

        const addAffected = async () => {
            const stationFeatures: Feature<Geometry>[] = [];
            const BATCH_SIZE = 350;
            for (
                let i = 0;
                i < (affectedStationList?.length ?? 0);
                i += BATCH_SIZE
            ) {
                if (isCancelled) return;
                const batch = (affectedStationList ?? []).slice(
                    i,
                    i + BATCH_SIZE,
                );
                const batchFeatures = await Promise.all(
                    batch.map((s) => createStationFeature(s, true)),
                );

                if (isCancelled) return;
                const validFeatures = batchFeatures.filter(
                    (f) => f !== null,
                ) as Feature<Geometry>[];
                stationFeatures.push(...validFeatures);

                // Yield to main thread
                if (i + BATCH_SIZE < (affectedStationList?.length ?? 0)) {
                    await new Promise((r) => setTimeout(r, 0));
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
            }

            // si quiero que cargue el skeleton al cambiar de mapa debo dejar esto en false y usar el isLoading
            // if (!isCancelled) {
            //     setIsPopulated(true);
            // }
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
        affectedStationList,
        toggleStateEarthquakeMask,
        stations,
        types,
        statuses,
    ]);

    // ---------- Coseismic vectors ----------
    useEffect(() => {
        if (!isMapReady) return;

        vectorArrowSourceRef.current.clear();

        if (!mapState || !earthQuakeChosen || !earthquakeAffectedStations) {
            vectorArrowLayerRef.current?.setVisible(false);
            return;
        }

        const arrowFeatures: Feature<Geometry>[] = [];

        for (const s of affectedList ?? []) {
            const station = stations?.find(
                (st) =>
                    st.network_code === s.network_code &&
                    st.station_code === s.station_code,
            );
            if (!station || !station.lat || !station.lon) continue;

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

        if (arrowFeatures.length > 0) {
            vectorArrowSourceRef.current.addFeatures(arrowFeatures);
            vectorArrowLayerRef.current?.setVisible(true);
        } else {
            vectorArrowLayerRef.current?.setVisible(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isMapReady,
        mapState,
        earthQuakeChosen,
        earthquakeAffectedStations,
        vectorMagnitude,
        stations,
    ]);

    // Immediately clear KML when earthquake is deselected
    useEffect(() => {
        if (!earthQuakeChosen) {
            clearAllKml();
            lastFitViewEqRef.current = null;
        }
    }, [earthQuakeChosen, clearAllKml]);

    // ---------- KML for affected area ----------
    useEffect(() => {
        if (!isMapReady || !mapState || !earthquakeAffectedStations) {
            clearAllKml();
            affectedStationLayerRef.current?.clearRenderer();
            setSelectedKmlPoint(null);
            setSelectedStation(null);
            return;
        }

        const kmlList = earthquakeAffectedStations.active_kml_list;

        if (kmlList && kmlList.length > 0) {
            loadMultipleKml(
                kmlList.map((kml: any) => ({
                    id: kml.id,
                    base64Data: kml.data,
                })),
            );
        } else {
            clearAllKml();
        }
    }, [
        isMapReady,
        mapState,
        earthquakeAffectedStations,
        loadMultipleKml,
        clearAllKml,
    ]);

    // ---------- Map move/zoom listeners ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;
        const view = map.getView();

        const onMoveEnd = () => {
            const center = view.getCenter();
            const z = view.getZoom();
            if (center && z != null) {
                saveLastView(toLonLat(center) as [number, number], z);
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
        view.animate({
            center: fromLonLat([posToFly[1], posToFly[0]]),
            zoom: getLastZoom(view.getMinZoom() || 3),
            duration: 500,
        });
    }, [posToFly, mapInstance]);

    // ---------- Click handler ----------
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        const handleClick = (evt: any) => {
            if (isGlobeActiveRef.current) return;

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
                    const currentZoom = currentView.getZoom() ?? getLastZoom();
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
                const currentZoom = currentView.getZoom() ?? getLastZoom();
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
            const isKmlLayer = feature && isKmlFeature(feature);

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
                const currentZoom = currentView.getZoom() ?? getLastZoom();
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
            if (isGlobeActiveRef.current) return;

            const originalEvent = evt.originalEvent as PointerEvent;
            const target = originalEvent.target as HTMLElement;

            // Check if mouse is over an HTML overlay (e.g. Popup or controls) instead of the map canvas
            if (target && target.tagName !== "CANVAS") {
                if (lastTooltipFeatureRef.current !== null) {
                    tooltipOverlay.current?.setPosition(undefined);
                    setTooltipStation(null);
                    setTooltipEarthquake(null);
                    lastTooltipFeatureRef.current = null;
                }
                clearHover();
                return;
            }

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

    // ---------- Cesium 3D click/hover handlers ----------
    useEffect(() => {
        if (!isGlobeActive || !ol3dRef.current) return;

        let Cesium: any;
        try {
            Cesium = window.Cesium;
        } catch {
            return;
        }
        if (!Cesium) return;

        const scene = ol3dRef.current.getCesiumScene();
        const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Helper: compute and apply screen position directly to DOM elements
        const updateOverlayDOM = (
            cartesian: any,
            elRef: React.RefObject<HTMLDivElement>,
            offsetY = 0,
        ) => {
            if (!cartesian || !elRef.current) return;

            const CesiumGlobal = (window as any).Cesium;
            const scene = ol3dRef.current.getCesiumScene();
            const toScreen = (
                CesiumGlobal.SceneTransforms.worldToWindowCoordinates ??
                CesiumGlobal.SceneTransforms.wgs84ToWindowCoordinates
            )?.bind(CesiumGlobal.SceneTransforms);

            if (!toScreen) return;

            const pos = toScreen(scene, cartesian);
            const el = elRef.current;

            if (pos) {
                // We use translate3d for hardware acceleration and centering.
                // The child elements (.ol-popup, .ol-tooltip) already have their own
                // relative transforms in CSS (-50%, -100%) to position them correctly.
                el.style.transform = `translate3d(${pos.x}px, ${pos.y + offsetY}px, 0)`;
                el.style.display = "block";
            } else {
                el.style.display = "none";
            }
        };

        // Click handler
        handler.setInputAction((click: any) => {
            // Only block click if we are clicking exactly on a React component that isn't the canvas
            // but we'll try a simpler picking first to be more responsive
            const picked = scene.pick(click.position);
            if (!Cesium.defined(picked)) {
                cesiumPopupCartesian.current = null;
                if (cesiumPopupRef.current) {
                    cesiumPopupRef.current.style.display = "none";
                }
                setIsCesiumPopupActive(false);
                setSelectedStation(null);
                setSelectedKmlPoint(null);
                return;
            }

            // OL-Cesium attaches the original OL feature as olFeature
            const olFeature =
                picked?.primitive?.olFeature ?? picked?.id?.olFeature;
            if (!olFeature) return;

            const stationData = olFeature.get?.("station");
            if (stationData) {
                const cartesian = Cesium.Cartesian3.fromDegrees(
                    stationData.lon,
                    stationData.lat,
                );
                cesiumPopupCartesian.current = cartesian;
                // Update DOM immediately
                updateOverlayDOM(cartesian, cesiumPopupRef);
                setIsCesiumPopupActive(true);

                // Auto-pan: center the camera slightly "North" of the point
                // to make sure the popup (which is ABOVE the point) has space.
                const currentHeight = scene.camera.positionCartographic.height;
                // Heuristic: shift latitude by a factor of the current height
                // 0.00001 degrees per meter of height is a rough approximation for "screen space"
                const latOffset = Math.max(0.001, currentHeight * 0.0000005);

                scene.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                        stationData.lon,
                        stationData.lat + latOffset,
                        currentHeight,
                    ),
                    duration: 0.5,
                });

                setSelectedKmlPoint(null);
                setSelectedStation(stationData);
                return;
            }

            const earthquakeData = olFeature.get?.("earthquake");
            if (earthquakeData) {
                handleEarthquakeStateRef.current(earthquakeData);
                setForceSyncScrollerMap((prev: number) => prev + 1);
                return;
            }

            const kmlDescription = olFeature.get?.("description");
            if (
                kmlDescription?.trim() &&
                olFeature.getGeometry?.()?.getType?.() === "Point"
            ) {
                const geom = olFeature.getGeometry();
                const coord = geom.getCoordinates();
                const lonLat = toLonLat(coord);
                const cartesian = Cesium.Cartesian3.fromDegrees(
                    lonLat[0],
                    lonLat[1],
                );
                cesiumPopupCartesian.current = cartesian;
                updateOverlayDOM(cartesian, cesiumPopupRef);
                setIsCesiumPopupActive(true);

                // Auto-pan for KML points too
                const currentHeight = scene.camera.positionCartographic.height;
                const latOffset = Math.max(0.001, currentHeight * 0.0000005);
                scene.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                        lonLat[0],
                        lonLat[1] + latOffset,
                        currentHeight,
                    ),
                    duration: 0.5,
                });

                setSelectedStation(null);
                setSelectedKmlPoint({
                    description: kmlDescription,
                    coordinate: coord,
                });
                return;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Hover handler — cursor style
        handler.setInputAction((movement: any) => {
            const canvas = scene.canvas as HTMLCanvasElement;

            const picked = scene.pick(movement.endPosition);

            if (Cesium.defined(picked)) {
                const olFeature =
                    picked?.primitive?.olFeature ?? picked?.id?.olFeature;
                if (
                    olFeature?.get?.("station") ||
                    olFeature?.get?.("earthquake")
                ) {
                    canvas.style.cursor = "pointer";

                    // Tooltip for stations
                    const sData = olFeature.get?.("station");
                    if (sData) {
                        const cartesian = Cesium.Cartesian3.fromDegrees(
                            sData.lon,
                            sData.lat,
                        );
                        cesiumTooltipCartesian.current = cartesian;
                        // Higher offset (-20) to stay well above the point
                        updateOverlayDOM(cartesian, cesiumTooltipRef, -20);
                        setIsCesiumTooltipActive(true);

                        setTooltipStation(sData);
                        setTooltipEarthquake(null);
                        return;
                    }

                    const eqData = olFeature.get?.("earthquake");
                    if (eqData) {
                        const cartesian = Cesium.Cartesian3.fromDegrees(
                            eqData.lon,
                            eqData.lat,
                        );
                        cesiumTooltipCartesian.current = cartesian;
                        updateOverlayDOM(cartesian, cesiumTooltipRef, -20);
                        setIsCesiumTooltipActive(true);

                        setTooltipEarthquake(eqData);
                        setTooltipStation(null);
                        return;
                    }
                } else {
                    canvas.style.cursor = "default";
                }
            } else {
                canvas.style.cursor = "default";
                cesiumTooltipCartesian.current = null;
                if (cesiumTooltipRef.current) {
                    cesiumTooltipRef.current.style.display = "none";
                }
                setIsCesiumTooltipActive(false);
                setTooltipStation(null);
                setTooltipEarthquake(null);
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Clear tooltips when the mouse leaves the Cesium canvas
        const canvas = scene.canvas as HTMLCanvasElement;
        const handleMouseLeave = () => {
            canvas.style.cursor = "default";
            cesiumTooltipCartesian.current = null;
            if (cesiumTooltipRef.current) {
                cesiumTooltipRef.current.style.display = "none";
            }
            setIsCesiumTooltipActive(false);
            setTooltipStation(null);
            setTooltipEarthquake(null);
        };
        canvas.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            handler.destroy();
            canvas.removeEventListener("mouseleave", handleMouseLeave);
        };
        // Sync with external system — re-register when globe state changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobeActive]);

    // ---------- Cesium postRender: keep popup/tooltip pixel position in sync ----------
    useEffect(() => {
        if (!isGlobeActive || !ol3dRef.current) return;

        let Cesium: any;
        try {
            Cesium = window.Cesium;
        } catch {
            return;
        }
        if (!Cesium) return;

        const scene = ol3dRef.current.getCesiumScene();

        const updatePositions = () => {
            const CesiumGlobal = (window as any).Cesium;
            if (!CesiumGlobal || !ol3dRef.current) return;

            const scene = ol3dRef.current.getCesiumScene();
            const toScreen = (
                CesiumGlobal.SceneTransforms.worldToWindowCoordinates ??
                CesiumGlobal.SceneTransforms.wgs84ToWindowCoordinates
            )?.bind(CesiumGlobal.SceneTransforms);

            if (!toScreen) return;

            // popup on globe

            if (cesiumPopupCartesian.current && cesiumPopupRef.current) {
                const pos = toScreen(scene, cesiumPopupCartesian.current);
                const el = cesiumPopupRef.current;
                if (pos) {
                    el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
                    el.style.display = "block";
                } else {
                    el.style.display = "none";
                }
            }

            // tooltip on globe

            if (cesiumTooltipCartesian.current && cesiumTooltipRef.current) {
                const pos = toScreen(scene, cesiumTooltipCartesian.current);
                const el = cesiumTooltipRef.current;
                if (pos) {
                    // Match the click/hover offset for consistency
                    el.style.transform = `translate3d(${pos.x}px, ${pos.y - 30}px, 0)`;
                    el.style.display = "block";
                } else {
                    el.style.display = "none";
                }
            }
        };

        const removeListener =
            scene.postRender.addEventListener(updatePositions);

        return () => {
            removeListener();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobeActive]);

    // ---------- Hide ScaleLine in globe mode ----------
    useEffect(() => {
        if (!mapInstance.current) return;
        const controls = mapInstance.current.getControls().getArray();
        controls.forEach((ctrl) => {
            if (ctrl.constructor.name === "ScaleLine") {
                // 'element' is protected on Control — access via the DOM
                const el = (ctrl as any).element as HTMLElement | undefined;
                if (el) {
                    el.style.display = isGlobeActive ? "none" : "";
                }
            }
        });
    }, [isGlobeActive, mapInstance]);

    const seeVectorMagnitude =
        toggleCoseismicVector ||
        selectedEarthquakes.some((eq) => eq.ui_toggle_vector);

    // Close Cesium popup helper
    const handleCloseCesiumPopup = useCallback(() => {
        cesiumPopupCartesian.current = null;
        if (cesiumPopupRef.current) {
            cesiumPopupRef.current.style.display = "none";
        }
        setIsCesiumPopupActive(false);
        setSelectedStation(null);
        setSelectedKmlPoint(null);
    }, []);

    return (
        <div className="z-10 w-full flex justify-end">
            <div
                style={{ position: "relative" }}
                className="w-full h-[92vh] overflow-hidden"
            >
                <div className="absolute inset-0">
                    <div id="map" ref={mapRef} className="w-full h-full" />
                </div>
                <div
                    className={`absolute right-[50px] bottom-[25px] z-[1000] w-[300px] transition-opacity ${seeVectorMagnitude ? "opacity-100" : "opacity-0 pointer-events-none hidden"}`}
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
                <div className="ol-overlays-container hidden">
                    <div ref={tooltipRef} className="ol-tooltip-container">
                        {tooltipStation && (
                            <div className="ol-tooltip">
                                <strong className="text-lg">
                                    {tooltipStation.network_code?.toUpperCase()}
                                    .
                                    {tooltipStation.station_code?.toUpperCase()}
                                </strong>
                            </div>
                        )}
                        {tooltipEarthquake && (
                            <div className="ol-tooltip">
                                <strong className="text-lg">
                                    {tooltipEarthquake.location?.toUpperCase()}{" "}
                                    (M {tooltipEarthquake.mag?.toString()}){" "}
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
                        showPopup={
                            !isGlobeActive &&
                            (!!selectedStation || !!selectedKmlPoint)
                        }
                        fromMain={true}
                        mainParams={mainParams}
                        station={selectedStation}
                        kmlPoint={selectedKmlPoint}
                        setSelectedStation={setSelectedStation}
                        setSelectedKmlPoint={setSelectedKmlPoint}
                    />
                </div>

                {/* ── Cesium 3D Popup ── */}
                {isGlobeActive && (
                    <div
                        ref={cesiumPopupRef}
                        className="ol-popup-container"
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            zIndex: 20000,
                            pointerEvents: "none",
                            display: isCesiumPopupActive ? "block" : "none",
                            willChange: "transform",
                        }}
                    >
                        <div
                            className="ol-popup"
                            style={
                                selectedKmlPoint
                                    ? {
                                        maxWidth: "600px",
                                        minWidth: "300px",
                                        pointerEvents: "auto",
                                    }
                                    : { pointerEvents: "auto" }
                            }
                        >
                            <button
                                className="ol-popup-closer"
                                onClick={handleCloseCesiumPopup}
                            >
                                ✕
                            </button>

                            {selectedStation && (
                                <PopupChildren
                                    key={selectedStation.api_id}
                                    station={selectedStation}
                                    fromMain={true}
                                    mainParams={mainParams}
                                />
                            )}

                            {selectedKmlPoint && (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: selectedKmlPoint.description,
                                    }}
                                />
                            )}

                            <div className="ol-popup-arrow" />
                            <div className="ol-popup-arrow-border" />
                        </div>
                    </div>
                )}

                {/* ── Cesium 3D Tooltip ── */}
                {isGlobeActive && (
                    <div
                        ref={cesiumTooltipRef}
                        className="ol-tooltip-container"
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            zIndex: 3000,
                            pointerEvents: "none",
                            willChange: "transform",
                            display: isCesiumTooltipActive ? "block" : "none",
                        }}
                    >
                        {tooltipStation && (
                            <div className="ol-tooltip">
                                <strong className="text-lg">
                                    {tooltipStation.network_code?.toUpperCase()}
                                    .
                                    {tooltipStation.station_code?.toUpperCase()}
                                </strong>
                            </div>
                        )}
                        {tooltipEarthquake && (
                            <div className="ol-tooltip">
                                <strong className="text-lg">
                                    {tooltipEarthquake.location?.toUpperCase()}{" "}
                                    (M {tooltipEarthquake.mag?.toString()}){" "}
                                    {new Date(
                                        tooltipEarthquake.date,
                                    ).toLocaleDateString()}
                                </strong>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapOL;

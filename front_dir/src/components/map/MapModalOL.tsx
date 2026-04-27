import React, {
    useEffect,
    useState,
    useRef,
    useCallback,
    useMemo,
} from "react";

import { fromLonLat, toLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type Polygon from "ol/geom/Polygon";
import { Draw, Modify } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import Icon from "ol/style/Icon";
import type { Geometry } from "ol/geom";
import type { DrawEvent } from "ol/interaction/Draw";
import type { ModifyEvent } from "ol/interaction/Modify";

import { MapSkeleton, Modal, MapStationCreate } from "@componentsReact";

import {
    getStationTypesService,
    getStationStatusService,
    getStationsService,
} from "@services";

import { useAuth, useApi, useLocalStorage, useMapInit } from "@hooks";

import { METADATA_STATE } from "@utils/reducerFormStates";

import {
    StationStatusServiceData,
    StationStatusData,
    StationTypeServiceData,
    StationTypeData,
    StationServiceData,
    StationData,
} from "@types";

import { TrashIcon } from "@heroicons/react/24/outline";

// Simple small red pin marker
const MARKER_PIN_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z" fill="#e53935" stroke="#fff" stroke-width="1"/>
    </svg>`,
)}`;

interface MapModalProps {
    setShowMapModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    handleDrawPolygon: (e: any) => void;
    markerType: "marker" | "polygon";
    formState?: typeof METADATA_STATE;
}

const MapModal = ({
    setShowMapModal,
    handleDrawPolygon,
    markerType,
    formState,
}: MapModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    // DOM refs
    const mapRef = useRef<HTMLDivElement>(null);
    const stationTooltipRef = useRef<HTMLDivElement>(null);

    // LocalStorage
    const [, setLastZoomLevel] = useLocalStorage("lastZoomLevel", "8");
    const [, setLastPosition] = useLocalStorage("lastPosition", "[0,0]");

    // State
    const [stations, setStations] = useState<StationData[] | undefined>(
        undefined,
    );
    const [disableButton] = useState(false);
    const [types, setTypes] = useState<{ image: string; name: string }[]>([]);
    const [statuses, setStatuses] = useState<{ name: string; color: string }[]>(
        [],
    );
    const [isMarkerSelected, setIsMarkerSelected] = useState(false);
    const [currentMarker, setCurrentMarker] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [loadingMap, setLoadingMap] = useState(false);
    const [rangeValue, setRangeValue] = useState(40);
    const [isDragging, setIsDragging] = useState(false);
    const [isDrawingInProgress, setIsDrawingInProgress] = useState(false);

    // Compute initial center from formState or localStorage
    const initialCenter = useMemo<[number, number]>(() => {
        if (formState?.station?.lat && formState?.station?.lon) {
            return [
                parseFloat(formState.station.lon),
                parseFloat(formState.station.lat),
            ];
        }
        const savedPosition = localStorage.getItem("lastPosition");
        if (savedPosition) {
            const parts = savedPosition.split(",").map(parseFloat);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                // localStorage stores [lat, lng]; OL expects [lon, lat]
                return [parts[1], parts[0]];
            }
        }
        return [0, 0];
    }, []);

    const initialZoom = useMemo(() => {
        const saved = localStorage.getItem("lastZoomLevel");
        return saved ? parseInt(saved) : 4;
    }, []);

    // Map init
    const { mapInstance, isMapReady } = useMapInit({
        center: initialCenter,
        zoom: initialZoom,
        mapRef,
    });

    // OL interaction refs
    const drawSourceRef = useRef(
        new VectorSource<Feature<Geometry>>({ wrapX: true }),
    );
    const drawLayerRef = useRef<VectorLayer | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const modifyInteractionRef = useRef<Modify | null>(null);

    // Stable ref for parent callback
    const handleDrawPolygonRef = useRef(handleDrawPolygon);
    useEffect(() => {
        handleDrawPolygonRef.current = handleDrawPolygon;
    });

    // Functions

    const handleCloseModal = () => {
        setIsMarkerSelected(false);
        setCurrentMarker(null);
    };

    const getStationStatuses = async () => {
        try {
            const res =
                await getStationStatusService<StationStatusServiceData>(api);
            if (res) {
                setStatuses(
                    res.data.map((status: StationStatusData) => ({
                        color: status.color_name,
                        name: status.name,
                    })),
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getStations = async () => {
        try {
            const result = await getStationsService<StationServiceData>(api);
            if (result) {
                setStations(result.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getStationTypes = async () => {
        try {
            const res =
                await getStationTypesService<StationTypeServiceData>(api);
            if (res) {
                setTypes(
                    res.data.map((type: StationTypeData) => ({
                        image: type.actual_image as string,
                        name: type.name,
                    })),
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Delete all drawn features and reset state
    const handleDelete = useCallback(() => {
        // Clear drawn features
        drawSourceRef.current.clear();

        // Reset form coordinates
        if (formState?.station) {
            formState.station.lat = "";
            formState.station.lon = "";
            formState.station.auto_x = "";
            formState.station.auto_y = "";
            formState.station.auto_z = "0";
        }

        // Reset local state
        setIsMarkerSelected(false);
        setCurrentMarker(null);

        // Re-enable draw interaction after state settles
        setTimeout(() => {
            if (drawInteractionRef.current) {
                drawInteractionRef.current.setActive(true);
            }
        }, 0);
    }, [formState]);

    // -------------------------------------------------------
    // Map layer + interactions setup
    // -------------------------------------------------------

    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;

        // --- Styles ---
        const markerStyle = new Style({
            image: new Icon({
                src: MARKER_PIN_SVG,
                anchor: [0.5, 1],
                anchorXUnits: "fraction",
                anchorYUnits: "fraction",
                scale: 1.4,
            }),
        });

        const polygonStyle = [
            new Style({
                fill: new Fill({ color: "rgba(66, 133, 244, 0.2)" }),
                stroke: new Stroke({ color: "#4285f4", width: 2 }),
            }),
            new Style({
                image: new CircleStyle({
                    radius: 5,
                    fill: new Fill({ color: "#4285f4" }),
                    stroke: new Stroke({ color: "#fff", width: 2 }),
                }),
            }),
        ];

        // --- Draw layer ---
        const drawLayer = new VectorLayer({
            source: drawSourceRef.current,
            style: markerType === "marker" ? markerStyle : polygonStyle,
            zIndex: 100,
        });
        drawLayerRef.current = drawLayer;
        map.addLayer(drawLayer);

        // --- Draw interaction ---
        const drawType = markerType === "marker" ? "Point" : "Polygon";

        const drawStyle =
            markerType === "marker"
                ? markerStyle
                : [
                      new Style({
                          fill: new Fill({
                              color: "rgba(66, 133, 244, 0.1)",
                          }),
                          stroke: new Stroke({
                              color: "#4285f4",
                              width: 2,
                              lineDash: [10, 10],
                          }),
                      }),
                      new Style({
                          image: new CircleStyle({
                              radius: 5,
                              fill: new Fill({ color: "#4285f4" }),
                              stroke: new Stroke({ color: "#fff", width: 2 }),
                          }),
                      }),
                  ];

        const draw = new Draw({
            source: drawSourceRef.current,
            type: drawType as "Point" | "Polygon",
            style: drawStyle,
        });

        draw.on("drawstart", () => {
            setIsDrawingInProgress(true);
        });

        draw.on("drawend", (e: DrawEvent) => {
            setIsDrawingInProgress(false);
            if (markerType === "marker") {
                const coords = (
                    e.feature.getGeometry() as Point
                ).getCoordinates();
                const [lon, lat] = toLonLat(coords);

                handleDrawPolygonRef.current({
                    layer: {
                        getLatLng: () => ({ lat, lng: lon }),
                        _latlng: { lat, lng: lon },
                    },
                });

                setIsMarkerSelected(true);
                setCurrentMarker({ lat, lng: lon });

                draw.setActive(false);
            } else {
                // Polygon mode
                const geom = e.feature.getGeometry() as Polygon;
                const outerRing = geom.getCoordinates()[0];
                const latLngs = outerRing.map((c: number[]) => {
                    const [lon, lat] = toLonLat(c);
                    return { lat, lng: lon };
                });

                handleDrawPolygonRef.current({
                    layer: {
                        getLatLngs: () => [latLngs],
                    },
                });
                setIsMarkerSelected(true); // Show delete button for polygon too
            }
        });

        drawInteractionRef.current = draw;
        map.addInteraction(draw);

        // --- Modify interaction ---
        if (markerType === "marker") {
            const modify = new Modify({
                source: drawSourceRef.current,
                style: new Style({
                    image: new CircleStyle({
                        radius: 20,
                        fill: new Fill({ color: "rgba(0,0,0,0.01)" }),
                        stroke: new Stroke({
                            color: "rgba(0,0,0,0.01)",
                            width: 1,
                        }),
                    }),
                }),
            });

            modify.on("modifystart", () => setIsDragging(true));
            modify.on("modifyend", (e: ModifyEvent) => {
                setIsDragging(false);
                const features = e.features.getArray();
                if (features.length > 0) {
                    const coords = (
                        features[0].getGeometry() as Point
                    ).getCoordinates();
                    const [lon, lat] = toLonLat(coords);

                    handleDrawPolygonRef.current({
                        layer: {
                            getLatLng: () => ({ lat, lng: lon }),
                            _latlng: { lat, lng: lon },
                        },
                    });

                    setIsMarkerSelected(true);
                    setCurrentMarker({ lat, lng: lon });
                }
            });

            modifyInteractionRef.current = modify;
            map.addInteraction(modify);
        }

        // --- Pre-populate marker from formState ---
        if (
            markerType === "marker" &&
            formState?.station?.lat &&
            formState?.station?.lon
        ) {
            const lat = parseFloat(formState.station.lat);
            const lon = parseFloat(formState.station.lon);

            if (!isNaN(lat) && !isNaN(lon)) {
                const feature = new Feature({
                    geometry: new Point(fromLonLat([lon, lat])),
                });
                drawSourceRef.current.addFeature(feature);
                setIsMarkerSelected(true);
                setCurrentMarker({ lat, lng: lon });
                draw.setActive(false);
            }
        }

        // --- Persist zoom & position to localStorage ---
        const view = map.getView();
        const onZoomChange = () => {
            const currentZoom = view.getZoom();
            if (currentZoom !== undefined) {
                setLastZoomLevel(currentZoom.toString());
            }
        };
        const onCenterChange = () => {
            const center = view.getCenter();
            if (center) {
                const [lon, lat] = toLonLat(center);
                setLastPosition([lat, lon].toString());
            }
        };
        view.on("change:resolution", onZoomChange);
        view.on("change:center", onCenterChange);

        return () => {
            view.un("change:resolution", onZoomChange);
            view.un("change:center", onCenterChange);
            map.removeInteraction(draw);
            if (modifyInteractionRef.current) {
                map.removeInteraction(modifyInteractionRef.current);
            }
            map.removeLayer(drawLayer);
            drawSourceRef.current.clear();
        };
        // Init only once when map is ready
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        const map = mapInstance.current;
        const viewport = map.getViewport();

        const handlePointerMove = (e: any) => {
            if (isDragging) {
                viewport.style.cursor = "grabbing";
                return;
            }

            // If we are currently in drawing mode, don't show grab
            if (drawInteractionRef.current?.getActive()) {
                viewport.style.cursor = "";
                return;
            }

            // Detect if we are over the features we already drew
            const hit = map.hasFeatureAtPixel(e.pixel, {
                hitTolerance: 5,
                layerFilter: (layer) => layer === drawLayerRef.current,
            });

            viewport.style.cursor = hit ? "grab" : "";
        };

        map.on("pointermove", handlePointerMove);

        return () => {
            map.un("pointermove", handlePointerMove);
        };
    }, [isMapReady, isDragging]);

    useEffect(() => {
        if (mapInstance.current) {
            mapInstance.current.getViewport().style.cursor = isDragging
                ? "grabbing"
                : "";
        }
    }, [isDragging]);

    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !mapRef.current) return;

        const map = mapInstance.current;
        const container = mapRef.current;

        // Helper: update size only when the container has dimensions
        const tryUpdateSize = () => {
            const { width, height } = container.getBoundingClientRect();
            if (width > 0 && height > 0) {
                map.updateSize();
                return true;
            }
            return false;
        };

        if (tryUpdateSize()) return;

        // Necessary bcs sometimes the map is not visible when the component is mounted
        const dialog = container.closest("dialog");
        if (dialog) {
            const observer = new MutationObserver(() => {
                if (dialog.open) {
                    requestAnimationFrame(() => {
                        tryUpdateSize();
                    });
                }
            });
            observer.observe(dialog, {
                attributes: true,
                attributeFilter: ["open"],
            });

            if (dialog.open) {
                requestAnimationFrame(() => tryUpdateSize());
            }

            return () => observer.disconnect();
        }

        const intervalId = setInterval(() => {
            if (tryUpdateSize()) {
                clearInterval(intervalId);
            }
        }, 100);

        return () => clearInterval(intervalId);
    }, [isMapReady]);

    // Fetch stations data (marker mode only)

    useEffect(() => {
        if (markerType === "marker") {
            setLoadingMap(true);
            Promise.all([
                getStations(),
                getStationStatuses(),
                getStationTypes(),
            ]).then(() => {
                setLoadingMap(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markerType]);

    // -------------------------------------------------------
    // Center map when formState changes
    // -------------------------------------------------------

    useEffect(() => {
        if (
            formState?.station?.lat &&
            formState?.station?.lon &&
            mapInstance.current &&
            isMapReady
        ) {
            const lat = parseFloat(formState.station.lat);
            const lon = parseFloat(formState.station.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
                mapInstance.current.getView().animate({
                    center: fromLonLat([lon, lat]),
                    duration: 300,
                });
            }
        }
    }, [formState, isMapReady]);

    return (
        <Modal
            close={true}
            modalId="map"
            size="md"
            handleCloseModal={handleCloseModal}
            setModalState={setShowMapModal}
        >
            <div className="flex flex-col justify-center items-center gap-y-4">
                <h1 className="text-2xl font-bold text-gray-800">
                    Select Coordinates
                </h1>

                <div className="relative w-full">
                    {markerType === "polygon" && isDrawingInProgress && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[999] bg-white/90 px-3 py-1 rounded-full border border-black-400 shadow-sm text-xs font-semibold text-blue-600 animate-pulse">
                            Click to add points, Double Click to Finish
                        </div>
                    )}

                    {loadingMap && markerType === "marker" && (
                        <div className="absolute inset-0 z-[1000] bg-base-100">
                            <MapSkeleton styles={{ height: "100%" }} />
                        </div>
                    )}

                    {markerType === "marker" && isMarkerSelected && (
                        <div className="z-[999] bg-white absolute top-2 left-2 p-2 rounded-md w-48">
                            <input
                                type="range"
                                className="range range-xs range-neutral w-full"
                                value={rangeValue}
                                onChange={(e) =>
                                    setRangeValue(parseInt(e.target.value))
                                }
                                step="10"
                                min="0"
                                max="1000"
                            />
                            <label className="font-bold text-sm mb-1 block">
                                {"Radius: " + rangeValue + " KM"}
                            </label>
                        </div>
                    )}

                    {isMarkerSelected && (
                        <button
                            className="z-[999] absolute top-2 right-12 btn btn-sm"
                            onClick={handleDelete}
                            title="Delete marker"
                        >
                            <TrashIcon className="size-5 text-red-500" />
                        </button>
                    )}

                    <div ref={mapRef} className="h-[60vh]" />

                    {markerType === "marker" &&
                        isMarkerSelected &&
                        isMapReady && (
                            <MapStationCreate
                                mapInstance={mapInstance}
                                stations={stations}
                                types={types}
                                statuses={statuses}
                                rangeValue={rangeValue}
                                currentMarker={currentMarker}
                                tooltipRef={stationTooltipRef}
                            />
                        )}

                    <div
                        ref={stationTooltipRef}
                        style={{
                            display: "none",
                            position: "absolute",
                            background: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            fontSize: "14px",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            pointerEvents: "none",
                            zIndex: 2000,
                        }}
                    />
                </div>

                <button
                    className="btn btn-success btn-md w-32"
                    disabled={disableButton}
                    onClick={() => {
                        // If drawing a polygon but not finished, try to finish it
                        if (
                            markerType === "polygon" &&
                            isDrawingInProgress &&
                            drawInteractionRef.current
                        ) {
                            try {
                                drawInteractionRef.current.finishDrawing();
                            } catch (e) {
                                // Ignore if cannot finish (e.g. no points)
                            }
                        }

                        // Short delay to let finishDrawing callbacks execute
                        setTimeout(() => {
                            handleCloseModal();
                            setShowMapModal({
                                show: false,
                                title: "",
                                type: "none",
                            });
                        }, 50);
                    }}
                >
                    Save
                </button>
            </div>
        </Modal>
    );
};

export default MapModal;

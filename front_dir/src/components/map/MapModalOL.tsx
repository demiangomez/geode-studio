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
import Polygon from "ol/geom/Polygon";
import { Draw, Modify } from "ol/interaction";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import Icon from "ol/style/Icon";
import type { Geometry } from "ol/geom";
import type { DrawEvent } from "ol/interaction/Draw";
import type { ModifyEvent } from "ol/interaction/Modify";

import { MapSkeleton, Modal } from "@componentsReact";
import MapStationCreate from "@components/map/StationCreateMapOL";
import StationTooltip from "@components/map/StationTooltip";

import { useAuth, useApi } from "@hooks";
import { useMapInit } from "@hooks/ol/useMapInit";

import { getLastCenterLonLat, getLastZoom, pinIconUrl } from "@olUtils";

import { METADATA_STATE } from "@utils/reducerFormStates";

export interface MapSelection {
    marker?: { lat: number; lng: number; radiusKm: number };
    polygon?: { lat: number; lng: number }[];
}

import { TrashIcon } from "@heroicons/react/24/outline";
import { useMetadata, useStationCatalog } from "@hooks/queries";

import "ol/ol.css";

const MARKER_PIN_SVG = pinIconUrl("#e53935");

interface MapModalProps {
    setShowMapModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    handleDrawPolygon?: (e: any) => void;
    markerType: "marker" | "polygon";
    formState?: typeof METADATA_STATE;
    title?: string;
    /** Con onSave la seleccion se confirma solo al apretar Save (tacho o cierre = cancelar). */
    onSave?: (selection: MapSelection | null) => void;
    initialSelection?: MapSelection;
    /** Modo polygon: catalogo entero con su icono; con poligono, las de afuera en gris. */
    showStations?: boolean;
}

const MapModal = ({
    setShowMapModal,
    handleDrawPolygon,
    markerType,
    formState,
    title = "Select Coordinates",
    onSave,
    initialSelection,
    showStations = false,
}: MapModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    // DOM refs
    const mapRef = useRef<HTMLDivElement>(null);
    const stationTooltipRef = useRef<HTMLDivElement>(null);

    // State

    const [disableButton] = useState(false);
    const [isMarkerSelected, setIsMarkerSelected] = useState(false);
    const [currentMarker, setCurrentMarker] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [rangeValue, setRangeValue] = useState(
        initialSelection?.marker?.radiusKm ?? 40,
    );
    const [isDragging, setIsDragging] = useState(false);
    const [isDrawingInProgress, setIsDrawingInProgress] = useState(false);
    const [currentPolygon, setCurrentPolygon] = useState<
        { lat: number; lng: number }[] | null
    >(null);

    // Compute initial center from formState or the last navigated position
    const initialCenter = useMemo<[number, number]>(() => {
        if (formState?.station?.lat && formState?.station?.lon) {
            return [
                parseFloat(formState.station.lon),
                parseFloat(formState.station.lat),
            ];
        }
        const marker = initialSelection?.marker;
        if (marker) return [marker.lng, marker.lat];
        const ring = initialSelection?.polygon;
        if (ring?.length) {
            return [
                ring.reduce((acc, p) => acc + p.lng, 0) / ring.length,
                ring.reduce((acc, p) => acc + p.lat, 0) / ring.length,
            ];
        }
        return getLastCenterLonLat() ?? [0, 0];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initialZoom = useMemo(() => getLastZoom(4), []);

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

    // Lo que hay dibujado al momento de Save: null si el usuario lo borro
    const readSelection = (): MapSelection | null => {
        const features = drawSourceRef.current.getFeatures();
        const feature = features[features.length - 1];
        const geometry = feature?.getGeometry();
        if (!geometry) return null;
        if (markerType === "marker") {
            const [lng, lat] = toLonLat((geometry as Point).getCoordinates());
            return { marker: { lat, lng, radiusKm: rangeValue } };
        }
        const ring = (geometry as Polygon).getCoordinates()[0].map((c) => {
            const [lng, lat] = toLonLat(c);
            return { lat, lng };
        });
        return { polygon: ring.slice(0, -1) };
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
        setCurrentPolygon(null);

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
            if (markerType === "polygon") {
                drawSourceRef.current.clear();
                setCurrentPolygon(null);
            }
            setIsDrawingInProgress(true);
        });

        draw.on("drawend", (e: DrawEvent) => {
            setIsDrawingInProgress(false);
            if (markerType === "marker") {
                const coords = (
                    e.feature.getGeometry() as Point
                ).getCoordinates();
                const [lon, lat] = toLonLat(coords);

                handleDrawPolygonRef.current?.({
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

                handleDrawPolygonRef.current?.({
                    layer: {
                        getLatLngs: () => [latLngs],
                    },
                });
                setCurrentPolygon(latLngs.slice(0, -1));
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

                    handleDrawPolygonRef.current?.({
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

        // --- Pre-populate marker from formState / initialSelection ---
        if (
            markerType === "marker" &&
            ((formState?.station?.lat && formState?.station?.lon) ||
                initialSelection?.marker)
        ) {
            const lat = parseFloat(
                formState?.station?.lat ||
                    String(initialSelection?.marker?.lat),
            );
            const lon = parseFloat(
                formState?.station?.lon ||
                    String(initialSelection?.marker?.lng),
            );

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

        const ring = initialSelection?.polygon;
        if (markerType === "polygon" && ring && ring.length >= 3) {
            const coords = ring.map((p) => fromLonLat([p.lng, p.lat]));
            coords.push(coords[0]);
            drawSourceRef.current.addFeature(
                new Feature({ geometry: new Polygon([coords]) }),
            );
            setCurrentPolygon(ring);
            setIsMarkerSelected(true);
        }

        return () => {
            map.removeInteraction(draw);
            if (modifyInteractionRef.current) {
                map.removeInteraction(modifyInteractionRef.current);
            }
            map.removeLayer(drawLayer);
            // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady, isDragging]);

    useEffect(() => {
        if (mapInstance.current) {
            mapInstance.current.getViewport().style.cursor = isDragging
                ? "grabbing"
                : "";
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady]);

    // Fetch stations data (marker mode only)

    const drawStations = markerType === "marker" || showStations;
    const { data: stations, isLoading: loadingMap } = useStationCatalog(api, {
        enabled: drawStations,
    });
    const { statuses, types } = useMetadata(api, {
        enabled: drawStations,
        only: ["types", "statuses"],
    });

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>

                <div className="relative w-full">
                    {markerType === "polygon" && isDrawingInProgress && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[999] bg-white/90 px-3 py-1 rounded-full border border-black-400 shadow-sm text-xs font-semibold text-blue-600 animate-pulse">
                            Click to add points, Double Click to Finish · a new
                            polygon replaces the previous one
                        </div>
                    )}

                    {loadingMap && drawStations && (
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

                    {isMapReady &&
                        (markerType === "marker"
                            ? isMarkerSelected
                            : showStations) && (
                            <MapStationCreate
                                mapInstance={mapInstance}
                                stations={stations?.data}
                                types={types ?? []}
                                statuses={statuses ?? []}
                                rangeValue={rangeValue}
                                currentMarker={currentMarker}
                                showAll={markerType === "polygon"}
                                polygon={currentPolygon ?? undefined}
                                tooltipRef={stationTooltipRef}
                            />
                        )}

                    <StationTooltip ref={stationTooltipRef} />
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
                            onSave?.(readSelection());
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

import React, { useEffect, useRef } from "react";

import { fromLonLat } from "ol/proj";
import { Style } from "ol/style";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Icon from "ol/style/Icon";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import MapBrowserEvent from "ol/MapBrowserEvent";

import { Popup } from "@componentsReact";

import { useMapInit, useKmlLayer } from "@hooks";

import {
    iconUrl,
    iconClass,
    getCachedColoredIcon,
    getIconScale,
    getLastZoom,
} from "@olUtils";

import { StationData } from "@types";
import type { Geometry } from "ol/geom";

import "./MapOL.css";

interface MapVisitOLProps {
    base64Data: string;
    station: StationData;
    types: { image: string; name: string }[];
    statuses: { name: string; color: string }[];
}

const MapVisitOL: React.FC<MapVisitOLProps> = ({
    base64Data,
    station,
    types,
    statuses,
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const center: [number, number] = station
        ? [station.lon, station.lat]
        : [0, 0];

    const { mapInstance, popupOverlay, isMapReady } = useMapInit({
        center,
        zoom: 10,
        mapRef,
        popupRef,
    });

    const { loadKml } = useKmlLayer({ mapInstance });

    // Station marker
    const markerLayerRef = useRef<VectorLayer | null>(null);

    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !station) return;

        let isCancelled = false;

        // Remove previous marker layer
        if (markerLayerRef.current) {
            mapInstance.current.removeLayer(markerLayerRef.current);
        }

        const addMarker = async () => {
            const iconSrc = iconUrl(station, types);
            const cssClass = iconClass(station, statuses);
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
            const layer = new VectorLayer({ source });
            markerLayerRef.current = layer;
            mapInstance.current!.addLayer(layer);

        };

        addMarker();

        return () => {
            isCancelled = true;
        };
    }, [isMapReady, station, types, statuses, mapInstance, popupOverlay]);

    // Center on station change
    useEffect(() => {
        if (!mapInstance.current || !station) return;
        const view = mapInstance.current.getView();
        view.setCenter(fromLonLat([station.lon, station.lat]));
    }, [station, mapInstance]);

    // Load KML
    useEffect(() => {
        if (!isMapReady || !base64Data) return;
        loadKml(base64Data, { fitView: true });
    }, [isMapReady, base64Data, loadKml]);

    // Handle pointer cursor style on hover
    useEffect(() => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;
        const handlePointerMove = (evt: any) => {
            const feature = map.forEachFeatureAtPixel(
                evt.pixel,
                (feature) => feature,
            );

            if (feature) {
                const station = feature.get("station");
                if (station) {
                    map.getTargetElement().classList.add("has-feature");
                }
            } else {
                map.getTargetElement().classList.remove("has-feature");
            }
        };
        map.on("pointermove" as any, handlePointerMove);
        return () => {
            map.un("pointermove" as any, handlePointerMove);
        };
    }, [mapInstance]);

    // Open popup on click
    useEffect(() => {
        if (!mapInstance.current || !popupOverlay.current) return;
        const map = mapInstance.current;
        const popup = popupOverlay.current;
        const listener = (e: MapBrowserEvent) => {
            const feature = map.forEachFeatureAtPixel(
                e.pixel,
                (feature) => feature,
            );
            if (feature) {
                const station = feature.get("station");
                if (station) {
                    const coord = (feature.getGeometry() as Point)?.getCoordinates();
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
                }
            } else {
                popup.setPosition(undefined);
            }
        };
        map.on("click", listener);
        return () => {
            map.un("click", listener);
        };
    }, [mapInstance, popupOverlay])

    return (
        <div className="z-10 pt-6 flex justify-center">
            <div className="w-full" style={{ position: "relative" }}>
                <div
                    id="map"
                    ref={mapRef}
                    className="h-[30vh]"
                    style={{ border: "1px solid #ccc", borderRadius: "4px" }}
                />

                <Popup
                    popupRef={popupRef}
                    popupOverlay={popupOverlay}
                    showPopup={isMapReady}
                    fromMain={undefined}
                    station={station}
                />

            </div>
        </div>
    );
};

export default MapVisitOL;

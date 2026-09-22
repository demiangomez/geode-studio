import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AxiosInstance } from "axios";

import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style, Text } from "ol/style";
import Icon from "ol/style/Icon";
import { fromLonLat } from "ol/proj";
import { unByKey } from "ol/Observable";
import type { Geometry } from "ol/geom";

import { MapSkeleton } from "@componentsReact";
import StationCreateMapOL from "@components/map/StationCreateMapOL";
import StationTooltip from "@components/map/StationTooltip";

import { useMetadata } from "@hooks/queries";
import { useMapInit } from "@hooks/ol/useMapInit";

import { CampaignPlanResult, StationData } from "@types";

import {
    getLastCenterLonLat,
    getLastZoom,
    pinIconUrl,
    toWorldCoordinate,
    worldExtentOf,
} from "@olUtils";

import { PlanMapPoint, dayColor } from "./plannerForm";

import "ol/ol.css";

export type { PlanMapPoint } from "./plannerForm";

interface Props {
    api: AxiosInstance;
    stations: StationData[];
    points: PlanMapPoint[];
    plan: CampaignPlanResult | undefined;
    loading?: boolean;
}

// Sede nueva en azul (pedido del cliente, en vez del naranja original)
const PIN_COLORS: Record<PlanMapPoint["kind"], string> = {
    city: "#e53935",
    site: "#1d4ed8",
};

const pointStyle = (point: PlanMapPoint) =>
    new Style({
        image: new Icon({
            src: pinIconUrl(PIN_COLORS[point.kind]),
            anchor: [0.5, 1],
            scale: 1.4,
        }),
        text: new Text({
            text: point.label,
            offsetY: 12,
            font: "bold 12px sans-serif",
            fill: new Fill({ color: "#1f2937" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
        }),
    });

const FIT_PADDING = [40, 40, 40, 40];
const FIT_MAX_ZOOM = 12;
const SINGLE_POINT_ZOOM = 8;

const CampaignPlanMapOL = ({ api, stations, points, plan, loading }: Props) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const initialCenter = useMemo<[number, number]>(
        () => getLastCenterLonLat() ?? [0, 0],
        [],
    );
    const initialZoom = useMemo(() => getLastZoom(4), []);

    const { mapInstance, isMapReady } = useMapInit({
        center: initialCenter,
        zoom: initialZoom,
        mapRef,
        enableZoomControl: true,
    });
    // El contenedor crece con el panel de paradas de al lado: OL solo escucha
    // el resize de la ventana, no el del contenedor
    useEffect(() => {
        const map = mapInstance.current;
        const container = mapRef.current;
        if (!isMapReady || !map || !container) return;
        const observer = new ResizeObserver(() => map.updateSize());
        observer.observe(container);
        return () => observer.disconnect();
    }, [isMapReady, mapInstance]);

    const { types, statuses } = useMetadata(api, {
        only: ["types", "statuses"],
    });

    // useState con inicializador: useRef(new X()) construiria un source por render
    const [pointsSource] = useState(
        () => new VectorSource<Feature<Geometry>>(),
    );
    const [routeSource] = useState(() => new VectorSource<Feature<Geometry>>());

    useEffect(() => {
        const map = mapInstance.current;
        if (!isMapReady || !map) return;
        const routeLayer = new VectorLayer({
            source: routeSource,
            zIndex: 40,
        });
        const pointsLayer = new VectorLayer({
            source: pointsSource,
            zIndex: 60,
        });
        map.addLayer(routeLayer);
        map.addLayer(pointsLayer);
        return () => {
            map.removeLayer(routeLayer);
            map.removeLayer(pointsLayer);
        };
    }, [isMapReady, mapInstance, pointsSource, routeSource]);

    useEffect(() => {
        const source = pointsSource;
        source.clear();
        source.addFeatures(
            points.map((point) => {
                const feature = new Feature({
                    geometry: new Point(fromLonLat([point.lon, point.lat])),
                });
                feature.setStyle(pointStyle(point));
                return feature;
            }),
        );
    }, [points, pointsSource]);

    // Una LineString por tramo, con el color del dia (igual que el HTML del plan)
    useEffect(() => {
        const source = routeSource;
        source.clear();
        if (!plan) return;
        const features: Feature<Geometry>[] = [];
        for (const day of plan.days) {
            const style = new Style({
                stroke: new Stroke({
                    color: dayColor(day.day_number),
                    width: 3,
                }),
            });
            for (const stop of day.stops) {
                if (stop.geometry.length < 2) continue;
                const feature = new Feature({
                    geometry: new LineString(
                        stop.geometry.map((c) => fromLonLat(c)),
                    ),
                });
                feature.setStyle(style);
                features.push(feature);
            }
        }
        source.addFeatures(features);
    }, [plan, routeSource]);

    // Encuadre sobre todo lo dibujado. Dentro del dialog el mapa puede medir 0x0
    // al principio: se espera al primer change:size real.
    useEffect(() => {
        const map = mapInstance.current;
        if (!isMapReady || !map) return;

        const coords: [number, number][] = [];
        for (const s of stations) coords.push([s.lon, s.lat]);
        for (const p of points) coords.push([p.lon, p.lat]);
        for (const day of plan?.days ?? [])
            for (const stop of day.stops) coords.push(...stop.geometry);
        if (coords.length === 0) return;

        const fit = () => {
            const size = map.getSize();
            if (!size || size[0] === 0 || size[1] === 0) return false;
            const view = map.getView();
            if (coords.length === 1) {
                view.animate({
                    center: toWorldCoordinate(coords[0]),
                    zoom: SINGLE_POINT_ZOOM,
                    duration: 300,
                });
            } else {
                view.fit(worldExtentOf(coords), {
                    padding: FIT_PADDING,
                    maxZoom: FIT_MAX_ZOOM,
                    duration: 300,
                });
            }
            return true;
        };

        if (fit()) return;
        const key = map.once("change:size", () => fit());
        return () => unByKey(key);
    }, [isMapReady, mapInstance, stations, points, plan]);

    return (
        <div className="relative w-full flex-1 flex flex-col">
            {loading && (
                <div className="absolute inset-0 z-[1000] bg-base-100">
                    <MapSkeleton styles={{ height: "100%" }} />
                </div>
            )}
            <div
                ref={mapRef}
                className="w-full flex-1 min-h-[45vh] rounded-md"
            />
            {isMapReady && (
                <StationCreateMapOL
                    mapInstance={mapInstance}
                    stations={stations}
                    types={types}
                    statuses={statuses}
                    rangeValue={0}
                    currentMarker={null}
                    showAll={true}
                    tooltipRef={tooltipRef}
                />
            )}
            <StationTooltip ref={tooltipRef} />
            <div className="z-[999] bg-white absolute bottom-2 left-2 p-2 rounded-md text-xs flex flex-col gap-1">
                <span className="flex items-center gap-1">
                    <img
                        src={pinIconUrl(PIN_COLORS.city)}
                        alt=""
                        className="size-4"
                    />
                    Start / end city
                </span>
                <span className="flex items-center gap-1">
                    <img
                        src={pinIconUrl(PIN_COLORS.site)}
                        alt=""
                        className="size-4"
                    />
                    New site
                </span>
                <span className="opacity-70">Stations use their own icon</span>
            </div>
        </div>
    );
};

// memo: las props (stations, points memoizados; plan; api) son estables y el
// padre se rerenderiza con cada tecla del formulario
export default memo(CampaignPlanMapOL);

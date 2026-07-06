import Feature from "ol/Feature";
import { type Geometry } from "ol/geom";
import Icon from "ol/style/Icon";
import { Fill, Stroke, Style, Text } from "ol/style";
import CircleStyle from "ol/style/Circle";

import caution from "@assets/images/caution.png";
import star from "@assets/images/star.png";

import { StationData } from "@types";

export const CLUSTER_MAX_ZOOM = 10;
export const CLUSTER_MIN_DISTANCE = 7;

// 1. Caché globales
const clusterStyleCache = new Map<number, Style>(); // Clave: tamaño del cluster y si tiene problemas

// Estilo base por defecto instanciado UNA sola vez
const CAUTION_STYLE = new Style({
    image: new Icon({
        src: caution,
        scale: 0.6,
    }),
});

export const clusterMemberStyle = (clusterMember: Feature<Geometry>): Style => {
    const existingStyle = clusterMember.getStyle();
    if (existingStyle) {
        return existingStyle as Style;
    }
    return CAUTION_STYLE;
};

export const clusterStyle = (feature: Feature<Geometry>): Style => {
    const size = feature.get("features").length;
    if (size === 1) {
        return clusterMemberStyle(feature.get("features")[0]);
    }

    const clusterMembers = feature.get("features");
    const hasProblems = clusterMembers.some((memberFeature: Feature) => {
        const station = memberFeature.get("station") as StationData;
        return station && (!station.has_stationinfo || station.has_gaps);
    });

    const cacheKey = size * (hasProblems ? -1 : 1);

    if (clusterStyleCache.has(cacheKey)) {
        return clusterStyleCache.get(cacheKey)!;
    }

    const clusterColor = hasProblems
        ? "rgba(255, 59, 48, 0.85)"
        : "rgba(52, 199, 89, 0.85)";

    const newClusterStyle = new Style({
        image: new CircleStyle({
            radius: 15,
            fill: new Fill({ color: clusterColor }),
            stroke: new Stroke({
                color: "rgba(255, 255, 255, 0.8)",
                width: 2,
            }),
        }),
        text: new Text({
            text: size.toString(),
            fill: new Fill({ color: "#fff" }),
            stroke: new Stroke({
                color: "rgba(0,0,0,0.2)",
                width: 1,
            }),
            font: "bold 16px Arial",
            textAlign: "center",
            textBaseline: "middle",
            offsetY: 0,
        }),
    });

    clusterStyleCache.set(cacheKey, newClusterStyle);
    return newClusterStyle;
};

export const earthquakeSelectedStyle = (
    isChosen: boolean,
    scale?: number,
): Style => {
    const iconScale = (scale ?? isChosen) ? 0.55 : 0.4;
    return new Style({
        image: new Icon({
            src: star,
            scale: iconScale,
            crossOrigin: "anonymous",
        }),
    });
};

export const EMPTY_STYLE = new Style({});

export const clusterStyleFn = (feature: Feature<Geometry>): Style | void => {
    const members = feature.get("features") as Feature<Geometry>[] | undefined;
    if (!members || members.length === 0) return;

    if (members.length === 1) {
        const existing = members[0].getStyle();
        if (existing) return existing as Style;
        return CAUTION_STYLE;
    }

    const hasProblems = members.some((f) => {
        const s = f.get("station") as StationData;
        return s && (!s.has_stationinfo || s.has_gaps);
    });

    const cacheKey = members.length * (hasProblems ? -1 : 1);

    if (clusterStyleCache.has(cacheKey)) {
        return clusterStyleCache.get(cacheKey)!;
    }

    const clusterColor = hasProblems
        ? "rgba(255, 59, 48, 0.85)"
        : "rgba(52, 199, 89, 0.85)";

    const newClusterStyle = new Style({
        image: new CircleStyle({
            radius: 15,
            fill: new Fill({ color: clusterColor }),
            stroke: new Stroke({
                color: "rgba(255, 255, 255, 0.8)",
                width: 2,
            }),
        }),
        text: new Text({
            text: members.length.toString(),
            fill: new Fill({ color: "#fff" }),
            font: "bold 14px Arial",
            textAlign: "center",
            textBaseline: "middle",
        }),
    });

    clusterStyleCache.set(cacheKey, newClusterStyle);
    return newClusterStyle;
};

export const createClusterHoverStyle = (
    feature: Feature<Geometry>,
): Style | void => {
    const members = feature.get("features") as Feature<Geometry>[] | undefined;
    if (!members || members.length <= 1) return;

    const hasProblems = members.some((f) => {
        const s = f.get("station") as StationData;
        return s && (!s.has_stationinfo || s.has_gaps);
    });

    const clusterColor = hasProblems
        ? "rgba(255, 59, 48, 0.95)"
        : "rgba(52, 199, 89, 0.95)";

    return new Style({
        image: new CircleStyle({
            radius: 18,
            fill: new Fill({ color: clusterColor }),
            stroke: new Stroke({
                color: "rgba(0, 0, 0, 0.25)",
                width: 6,
            }),
        }),
        text: new Text({
            text: members.length.toString(),
            fill: new Fill({ color: "#fff" }),
            font: "bold 15px Arial",
            textAlign: "center",
            textBaseline: "middle",
        }),
    });
};

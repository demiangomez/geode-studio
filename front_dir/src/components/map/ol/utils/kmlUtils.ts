import GeoJSON from "ol/format/GeoJSON";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Icon from "ol/style/Icon";
import { Fill, Stroke, Style } from "ol/style";
import JSZip from "jszip";
import { kml } from "@tmcw/togeojson";
import { hexToRgba } from "./coordinateUtils";
import type { Geometry } from "ol/geom";

export type KmlLayerOptions = {
    fitView?: boolean;
    zIndex?: number;
    defaultColor?: string;
    hidePoints?: boolean;
};

export const parseKmlFromBase64 = async (
    base64Data: string,
): Promise<Feature<Geometry>[]> => {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    let kmlString = "";

    try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const kmlFile = zip.file(/.*\.kml/)[0];
        if (kmlFile) {
            kmlString = await kmlFile.async("string");
        } else {
            throw new Error("No KML file found in KMZ.");
        }
    } catch {
        kmlString = new TextDecoder().decode(arrayBuffer);
    }

    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlString, "application/xml");
    const geojson = kml(kmlDoc);

    const geoJsonFormat = new GeoJSON();
    return geoJsonFormat.readFeatures(geojson, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
    }) as Feature<Geometry>[];
};

const createKmlPointStyle = (properties: Record<string, unknown>): Style => {
    const iconUrlVal =
        (properties.icon as string) ||
        "https://maps.google.com/mapfiles/kml/shapes/star.png";
    const iconScale =
        properties["icon-scale"] !== undefined
            ? parseFloat(properties["icon-scale"] as string)
            : 1;
    const iconOpacity =
        properties["icon-opacity"] !== undefined
            ? parseFloat(properties["icon-opacity"] as string)
            : 1;
    const iconColor = properties["icon-color"] as string | undefined;

    const baseSize = 32;
    const scaledSize = baseSize * iconScale;

    if (iconColor) {
        return new Style({
            image: new Icon({
                src: iconUrlVal,
                scale: scaledSize / 64,
                opacity: iconOpacity,
                anchor: [0.5, 0.5],
                crossOrigin: "anonymous",
                color: iconColor.startsWith("#") ? iconColor : undefined,
            }),
        });
    }

    return new Style({
        image: new Icon({
            src: iconUrlVal,
            scale: scaledSize / 32,
            opacity: iconOpacity,
            anchor: [0.5, 0.5],
            crossOrigin: "anonymous",
        }),
    });
};

const createKmlPolygonStyle = (properties: Record<string, unknown>): Style => {
    const strokeColor = (properties.stroke as string) || "rgba(204, 85, 0, 1)";
    const strokeOpacity =
        properties["stroke-opacity"] !== undefined
            ? parseFloat(properties["stroke-opacity"] as string)
            : 1;
    const strokeWidth =
        properties["stroke-width"] !== undefined
            ? parseFloat(properties["stroke-width"] as string)
            : 2;
    let fillColor = properties["fill-color"] as string | undefined;
    let fillOpacity =
        properties["fill-opacity"] !== undefined
            ? parseFloat(properties["fill-opacity"] as string)
            : 0.4;
    if (!fillColor) {
        fillColor = strokeColor;
        fillOpacity = 0.2;
    }

    const strokeRGBA = strokeColor.startsWith("#")
        ? hexToRgba(strokeColor, strokeOpacity)
        : strokeColor;
    const fillRGBA = fillColor.startsWith("#")
        ? hexToRgba(fillColor, fillOpacity)
        : fillColor;

    return new Style({
        stroke: new Stroke({ color: strokeRGBA, width: strokeWidth }),
        fill: new Fill({ color: fillRGBA }),
    });
};

const createKmlLineStyle = (properties: Record<string, unknown>): Style => {
    const strokeColor = (properties.stroke as string) || "rgba(204, 85, 0, 1)";
    const strokeOpacity =
        properties["stroke-opacity"] !== undefined
            ? parseFloat(properties["stroke-opacity"] as string)
            : 1;
    const strokeRGBA = strokeColor.startsWith("#")
        ? hexToRgba(strokeColor, strokeOpacity)
        : strokeColor;

    return new Style({
        stroke: new Stroke({ color: strokeRGBA, width: 2 }),
    });
};

const defaultKmlStyle = new Style({
    stroke: new Stroke({ color: "rgba(204, 85, 0, 1)", width: 2 }),
    fill: new Fill({ color: "rgba(255, 153, 0, 0.4)" }),
});

export const createKmlLayer = (
    features: Feature<Geometry>[],
    options: KmlLayerOptions = {},
): VectorLayer => {
    const { zIndex = 99, defaultColor, hidePoints = false } = options;

    // wrapX: true allows KML features to duplicate in each world copy for infinite horizontal panning
    const kmlSource = new VectorSource({ features, wrapX: true });

    return new VectorLayer({
        source: kmlSource,
        style: (feature) => {
            const geometry = feature.getGeometry();
            const properties = feature.getProperties();
            const type = geometry?.getType();

            if (type === "Polygon" || type === "MultiPolygon") {
                if (defaultColor) {
                    return new Style({
                        stroke: new Stroke({ color: defaultColor, width: 2 }),
                        fill: new Fill({
                            color: defaultColor
                                .replace("rgb", "rgba")
                                .replace(")", ", 0.2)"),
                        }),
                    });
                }
                return createKmlPolygonStyle(properties);
            }
            if (type === "LineString" || type === "MultiLineString") {
                if (defaultColor) {
                    return new Style({
                        stroke: new Stroke({ color: defaultColor, width: 2 }),
                    });
                }
                return createKmlLineStyle(properties);
            }
            if (type === "Point") {
                if (hidePoints) return new Style({});
                return createKmlPointStyle(properties);
            }
            return defaultKmlStyle;
        },
        zIndex,
    });
};

import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import { fromLonLat } from "ol/proj";
import { Stroke, Style } from "ol/style";
import type { Geometry } from "ol/geom";
import { CoseismicDisplacement } from "@types";

/** Create arrow features (main line + arrowhead) for a coseismic vector */
export function createVectorArrowFeatures(
    origin: { lat: number; lon: number },
    displacement: CoseismicDisplacement,
    magnitude: number,
): Feature<Geometry>[] {
    const SIZE = 100000;
    const METERS_PER_DEGREE_LAT = 111111;
    const METERS_PER_DEGREE_LON =
        METERS_PER_DEGREE_LAT * Math.cos((origin.lat * Math.PI) / 180);

    const scaledN = displacement.n * magnitude * SIZE;
    const scaledE = displacement.e * magnitude * SIZE;

    const deltaLat = scaledN / METERS_PER_DEGREE_LAT;
    const deltaLon = scaledE / METERS_PER_DEGREE_LON;

    const endLat = origin.lat + deltaLat;
    const endLon = origin.lon + deltaLon;

    const vectorAngle = Math.atan2(deltaLon, deltaLat);
    const vectorLength = Math.sqrt(deltaLat ** 2 + deltaLon ** 2);
    const arrowHeadLength = vectorLength * 0.1;

    const leftHead = [
        endLat - arrowHeadLength * Math.cos(vectorAngle + Math.PI / 6),
        endLon - arrowHeadLength * Math.sin(vectorAngle + Math.PI / 6),
    ];
    const rightHead = [
        endLat - arrowHeadLength * Math.cos(vectorAngle - Math.PI / 6),
        endLon - arrowHeadLength * Math.sin(vectorAngle - Math.PI / 6),
    ];

    const arrowStroke = new Style({
        stroke: new Stroke({ color: "red", width: 6 }),
    });

    // Main line
    const mainLine = new Feature<Geometry>({
        geometry: new LineString([
            fromLonLat([origin.lon, origin.lat]),
            fromLonLat([endLon, endLat]),
        ]),
    });
    mainLine.setStyle(arrowStroke);

    // Left arrowhead
    const leftLine = new Feature<Geometry>({
        geometry: new LineString([
            fromLonLat([leftHead[1], leftHead[0]]),
            fromLonLat([endLon, endLat]),
        ]),
    });
    leftLine.setStyle(arrowStroke);

    // Right arrowhead
    const rightLine = new Feature<Geometry>({
        geometry: new LineString([
            fromLonLat([rightHead[1], rightHead[0]]),
            fromLonLat([endLon, endLat]),
        ]),
    });
    rightLine.setStyle(arrowStroke);

    return [mainLine, leftLine, rightLine];
}

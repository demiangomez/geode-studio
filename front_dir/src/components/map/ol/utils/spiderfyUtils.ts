import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import VectorSource from "ol/source/Vector";
import { Stroke, Style } from "ol/style";
import type { Geometry } from "ol/geom";

// ---------- Constants ----------
const SPIDER_LEG_SEPARATION = 28;
const SPIDER_START_ANGLE = Math.PI / 2;

const SPIDER_LEG_REACH = 0.7; // leg line reaches 70% of the way to the icon
const SPIDER_ANIM_DURATION = 300; // ms

export const SPIDER_LEG_STYLE = new Style({
    stroke: new Stroke({
        color: "rgb(87, 84, 84)",
        width: 1.5,
    }),
});

// ---------- Functions ----------

/** Compute circle positions for spiderfied stations */
export const generateSpiderfyPoints = (
    count: number,
    center: number[],
    resolution: number,
): number[][] => {
    const circumference = SPIDER_LEG_SEPARATION * (2 + count);
    // prettier-ignore
    let legLength = circumference / (Math.PI * 2)
    legLength = Math.max(legLength, 35) * resolution; // min distance to clear icon
    const angleStep = (Math.PI * 2) / count; // 360 / station count
    const points: number[][] = [];
    for (let i = 0; i < count; i++) {
        const angle = SPIDER_START_ANGLE + i * angleStep;
        points.push([
            center[0] + legLength * Math.cos(angle),
            center[1] + legLength * Math.sin(angle),
        ]);
    }
    return points;
};

/** Animate spider legs expanding from center outward */
export function animateSpiderfyExpand(
    center: number[],
    positions: number[][],
    features: Feature<Geometry>[],
    animRef: { current: number | null },
    duration: number = SPIDER_ANIM_DURATION,
) {
    const start = performance.now();
    const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const p = t * (2 - t); // easeOutQuad
        for (let i = 0; i < positions.length; i++) {
            const target = positions[i];

            const iconPos = [
                center[0] + (target[0] - center[0]) * p,
                center[1] + (target[1] - center[1]) * p,
            ];
            const legEnd = [
                center[0] + (target[0] - center[0]) * p * SPIDER_LEG_REACH,
                center[1] + (target[1] - center[1]) * p * SPIDER_LEG_REACH,
            ];
            (features[i * 2].getGeometry() as LineString).setCoordinates([
                center,
                legEnd,
            ]);
            (features[i * 2 + 1].getGeometry() as Point).setCoordinates(
                iconPos,
            );
        }
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
}

/** Animate spider legs collapsing back to center, then invoke callback */
export function animateSpiderfyCollapse(
    source: VectorSource<Feature<Geometry>>,
    animRef: { current: number | null },
    onComplete: () => void,
    duration: number = SPIDER_ANIM_DURATION * 0.7,
) {
    const features = source.getFeatures();
    if (features.length === 0) {
        onComplete();
        return;
    }
    const center = (
        features[0].getGeometry() as LineString
    ).getCoordinates()[0];
    const pairCount = Math.floor(features.length / 2);
    const startPositions: number[][] = [];
    for (let i = 0; i < pairCount; i++) {
        startPositions.push(
            (features[i * 2 + 1].getGeometry() as Point)
                .getCoordinates()
                .slice(),
        );
    }
    const startTime = performance.now();
    const step = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const p = t * t; // easeInQuad
        for (let i = 0; i < startPositions.length; i++) {
            const from = startPositions[i];
            const legFrom = [
                center[0] + (from[0] - center[0]) * SPIDER_LEG_REACH,
                center[1] + (from[1] - center[1]) * SPIDER_LEG_REACH,
            ];
            const iconPos = [
                from[0] + (center[0] - from[0]) * p,
                from[1] + (center[1] - from[1]) * p,
            ];
            const legEnd = [
                legFrom[0] + (center[0] - legFrom[0]) * p,
                legFrom[1] + (center[1] - legFrom[1]) * p,
            ];
            (features[i * 2].getGeometry() as LineString).setCoordinates([
                center,
                legEnd,
            ]);
            (features[i * 2 + 1].getGeometry() as Point).setCoordinates(
                iconPos,
            );
        }
        if (t < 1) {
            animRef.current = requestAnimationFrame(step);
        } else {
            animRef.current = null;
            source.clear();
            onComplete();
        }
    };
    animRef.current = requestAnimationFrame(step);
}

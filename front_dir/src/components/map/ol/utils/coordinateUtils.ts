import { Coordinate } from "ol/coordinate";

export const hexToRgba = (hex: string, opacity: number = 1): string => {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const generatePointsCircle = (
    count: number,
    clusterCenter: Coordinate,
    resolution: number,
): number[][] => {
    const circleDistanceMultiplier = 1;
    const circleFootSeparation = 28;
    const circleStartAngle = Math.PI / 2;

    const circumference =
        circleDistanceMultiplier * circleFootSeparation * (2 + count);
    let legLength = circumference / (Math.PI * 2);
    const angleStep = (Math.PI * 2) / count;

    legLength = Math.max(legLength, 35) * resolution;

    const res: number[][] = [];
    for (let i = 0; i < count; ++i) {
        const angle = circleStartAngle + i * angleStep;
        res.push([
            clusterCenter[0] + legLength * Math.cos(angle),
            clusterCenter[1] + legLength * Math.sin(angle),
        ]);
    }
    return res;
};

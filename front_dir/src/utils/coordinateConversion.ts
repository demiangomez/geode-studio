// Conversión WGS84: ECEF (XYZ) ↔ LLA (lat/lon/alt)

export function lla2ecef(llaArr: number[]): {
    x: number;
    y: number;
    z: number;
} {
    const [lat, lon, alt] = llaArr;

    const rad_lat = (lat * Math.PI) / 180;
    const rad_lon = (lon * Math.PI) / 180;

    // Parámetros WGS84
    const a = 6378137.0;
    const finv = 298.257223563;
    const f = 1 / finv;
    const e2 = 1 - (1 - f) * (1 - f);

    const v = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(rad_lat), 2));

    const x = (v + alt) * Math.cos(rad_lat) * Math.cos(rad_lon);
    const y = (v + alt) * Math.cos(rad_lat) * Math.sin(rad_lon);
    const z = (v * (1 - e2) + alt) * Math.sin(rad_lat);

    return {
        x: parseFloat(x.toFixed(3)),
        y: parseFloat(y.toFixed(3)),
        z: parseFloat(z.toFixed(3)),
    };
}

export function ecef2lla(ecefArr: number[]): {
    lat: number;
    lon: number;
    alt: number;
} {
    const [x, y, z] = ecefArr;

    // Parámetros WGS84
    const a = 6378137;
    const e = 8.1819190842622e-2;

    const asq = Math.pow(a, 2);
    const esq = Math.pow(e, 2);

    const b = Math.sqrt(asq * (1 - esq));
    const bsq = Math.pow(b, 2);

    const ep = Math.sqrt((asq - bsq) / bsq);
    const p = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    const th = Math.atan2(a * z, b * p);

    const lon = Math.atan2(y, x);
    const lat = Math.atan2(
        z + Math.pow(ep, 2) * b * Math.pow(Math.sin(th), 3),
        p - esq * a * Math.pow(Math.cos(th), 3),
    );

    const N = a / Math.sqrt(1 - esq * Math.pow(Math.sin(lat), 2));
    const alt = p / Math.cos(lat) - N;

    return {
        lat: parseFloat(((lat * 180) / Math.PI).toFixed(8)),
        lon: parseFloat(((lon * 180) / Math.PI).toFixed(8)),
        alt: parseFloat(alt.toFixed(3)),
    };
}

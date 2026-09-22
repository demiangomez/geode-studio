// Listas de `net.code` de estaciones (proyectos de procesamiento, planner de
// campañas): el backend matchea sin distinguir mayúsculas, así que acá también.
const codeKey = (code: string) => code.trim().toLowerCase();

export const mergeStationCodes = (
    current: string[],
    incoming: string[],
): { merged: string[]; added: number } => {
    const seen = new Set(current.map(codeKey));
    const merged = [...current];
    for (const code of incoming) {
        const key = codeKey(code);
        if (key === "" || seen.has(key)) continue;
        seen.add(key);
        merged.push(code.trim());
    }
    return { merged, added: merged.length - current.length };
};

export const removeStationCode = (current: string[], code: string) => {
    const key = codeKey(code);
    return current.filter((c) => codeKey(c) !== key);
};

type StationLike = { network_code: string; station_code: string };

export const stationCodeOf = (station: StationLike) =>
    `${station.network_code}.${station.station_code}`;

// Orden de las listas en pantalla: por station code y, a igual code, por red
const stationPart = (code: string) => codeKey(code).split(".").pop() ?? "";
const compareCodes = (a: string, b: string) =>
    stationPart(a).localeCompare(stationPart(b)) ||
    codeKey(a).localeCompare(codeKey(b));

export const sortByStationCode = (codes: string[]) =>
    [...codes].sort(compareCodes);

export const sortStationsByCode = <T extends StationLike>(stations: T[]) =>
    [...stations].sort((a, b) =>
        compareCodes(stationCodeOf(a), stationCodeOf(b)),
    );

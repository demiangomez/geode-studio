import {
    CampaignNewSite,
    CampaignPlanData,
    CampaignPlanParams,
    CampaignPlanResult,
} from "@types";

import { dateFromDay, dayFromDate, possibleColors } from "@utils";

// Tope de los cards de la lista y del planner: el mismo que la tabla de Campaigns
export const PLANNER_WIDTH = "80vw";

export interface NewSiteForm {
    key: string;
    name: string;
    mode: "city" | "coords";
    city: string;
    lat: string;
    lon: string;
    // Resultado de Locate para la ciudad `query`: solo para el mapa, no viaja al backend
    geo?: { query: string; lat: number; lon: number };
}

// Todo texto: son valores de inputs. Los numeros los convierte buildPlannerPayload
export type PlannerFormValues = {
    start_city: string;
    end_city: string;
    start_date: string;
    stations: string[];
    new_sites: NewSiteForm[];
    time_on_site_minutes: string;
    station_time_overrides: Record<string, string>;
    fuel_cost_per_km: string;
    lodging_cost_per_night: string;
    per_diem_cost_per_day: string;
    num_participants: string;
    day_start: string;
    hard_stop: string;
};

// Defaults del contrato (DEFAULT_CONFIG de geode.campaign_planner)
export const PLANNER_DEFAULTS: PlannerFormValues = {
    start_city: "",
    end_city: "",
    start_date: "",
    stations: [],
    new_sites: [],
    time_on_site_minutes: "120",
    station_time_overrides: {},
    fuel_cost_per_km: "0",
    lodging_cost_per_night: "70",
    per_diem_cost_per_day: "0",
    num_participants: "1",
    day_start: "08:00",
    hard_stop: "20:00",
};

let siteKeySeq = 0;
export const newSite = (partial: Partial<NewSiteForm> = {}): NewSiteForm => ({
    key: `site-${siteKeySeq++}`,
    name: "",
    mode: "city",
    city: "",
    lat: "",
    lon: "",
    ...partial,
});

// Las cuatro formas del contrato: "lat,lon", "Ciudad, Pais", {name, lat, lon}, {name, city}
export const parseNewSite = (entry: CampaignNewSite): NewSiteForm => {
    if (typeof entry === "string") {
        const coords = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(entry);
        return coords
            ? newSite({ mode: "coords", lat: coords[1], lon: coords[2] })
            : newSite({ city: entry.trim() });
    }
    if ("city" in entry) {
        return newSite({ name: entry.name ?? "", city: entry.city });
    }
    return newSite({
        name: entry.name ?? "",
        mode: "coords",
        lat: String(entry.lat),
        lon: String(entry.lon),
    });
};

export const newSiteToEntry = (
    site: NewSiteForm,
): CampaignNewSite | undefined => {
    const name = site.name.trim();
    if (site.mode === "city") {
        const city = site.city.trim();
        if (!city) return undefined;
        return name ? { name, city } : city;
    }
    if (!site.lat.trim() || !site.lon.trim()) return undefined;
    const lat = Number(site.lat);
    const lon = Number(site.lon);
    return name ? { name, lat, lon } : `${lat},${lon}`;
};

// Clave en station_time_overrides: el nombre de la sede o, sin nombre, la ciudad
// (para el backend ese string es el nombre). Una sede por coordenadas sin nombre
// recibe un nombre inventado por el backend, asi que no tiene clave predecible.
export const overrideKeyOf = (site: NewSiteForm) =>
    site.name.trim() ||
    (site.mode === "city" ? site.city.trim() : "") ||
    undefined;

// Posicion para el mapa: coordenadas propias, o las de Locate mientras la ciudad no cambie
export const newSitePosition = (site: NewSiteForm) => {
    if (site.mode === "coords") {
        const lat = Number(site.lat);
        const lon = Number(site.lon);
        return site.lat && site.lon && !isNaN(lat) && !isNaN(lon)
            ? { lat, lon }
            : undefined;
    }
    return site.geo && site.geo.query === site.city.trim()
        ? { lat: site.geo.lat, lon: site.geo.lon }
        : undefined;
};

// Los decimales del backend pueden venir como string ("70.00") o numero (70.0)
const numberText = (value: unknown, fallback: string) =>
    value === null ||
    value === undefined ||
    value === "" ||
    isNaN(Number(value))
        ? fallback
        : String(Number(value));

export const planToFormValues = (
    plan: CampaignPlanData | undefined,
): PlannerFormValues => {
    if (!plan) {
        return {
            ...PLANNER_DEFAULTS,
            stations: [],
            new_sites: [],
            station_time_overrides: {},
        };
    }
    return {
        start_city: plan.start_city ?? "",
        end_city: plan.end_city ?? "",
        start_date: plan.start_date ?? "",
        stations: [...(plan.stations ?? [])],
        new_sites: (plan.new_sites ?? []).map(parseNewSite),
        time_on_site_minutes: numberText(plan.time_on_site_minutes, "120"),
        station_time_overrides: Object.fromEntries(
            Object.entries(plan.station_time_overrides ?? {}).map(
                ([key, minutes]) => [key, String(minutes)],
            ),
        ),
        fuel_cost_per_km: numberText(plan.fuel_cost_per_km, "0"),
        lodging_cost_per_night: numberText(plan.lodging_cost_per_night, "70"),
        per_diem_cost_per_day: numberText(plan.per_diem_cost_per_day, "0"),
        num_participants: numberText(plan.num_participants, "1"),
        // "HH:MM:SS" → "HH:MM": el input de hora con paso de un minuto no muestra segundos
        day_start: (plan.day_start || "08:00").slice(0, 5),
        hard_stop: (plan.hard_stop || "20:00").slice(0, 5),
    };
};

export const buildPlannerPayload = (
    values: PlannerFormValues,
): CampaignPlanParams => ({
    start_city: values.start_city.trim(),
    end_city: values.end_city.trim(),
    start_date: values.start_date,
    stations: values.stations,
    new_sites: values.new_sites
        .map(newSiteToEntry)
        .filter((entry): entry is CampaignNewSite => entry !== undefined),
    time_on_site_minutes: Number(values.time_on_site_minutes),
    station_time_overrides: Object.fromEntries(
        Object.entries(values.station_time_overrides)
            .filter(([, minutes]) => minutes.trim() !== "")
            .map(([key, minutes]) => [key, Number(minutes)]),
    ),
    fuel_cost_per_km: Number(values.fuel_cost_per_km),
    lodging_cost_per_night: Number(values.lodging_cost_per_night),
    per_diem_cost_per_day: Number(values.per_diem_cost_per_day),
    num_participants: Number(values.num_participants),
    day_start: values.day_start,
    hard_stop: values.hard_stop,
});

export interface PlanMapPoint {
    key: string;
    label: string;
    lat: number;
    lon: number;
    kind: "city" | "site";
}

// Con el plan calculado, las posiciones salen de sus paradas (origen, destino y sedes
// nuevas ya geocodificadas por el backend); las estaciones las dibuja el catalogo.
export const mapPointsFromPlan = (plan: CampaignPlanResult): PlanMapPoint[] => {
    const stops = plan.days
        .flatMap((day) => day.stops)
        .filter((stop) => stop.lat !== null && stop.lon !== null);
    const origin = stops.find((s) => s.type === "origin");
    const destination = [...stops]
        .reverse()
        .find((s) => s.type === "destination");
    const sameCity =
        origin &&
        destination &&
        origin.lat === destination.lat &&
        origin.lon === destination.lon;
    const points: PlanMapPoint[] = [];
    if (origin) {
        points.push({
            key: "start",
            label: sameCity ? "Start / end" : "Start",
            lat: origin.lat!,
            lon: origin.lon!,
            kind: "city",
        });
    }
    if (destination && !sameCity) {
        points.push({
            key: "end",
            label: "End",
            lat: destination.lat!,
            lon: destination.lon!,
            kind: "city",
        });
    }
    stops.forEach((stop, index) => {
        if (stop.type === "new_site") {
            points.push({
                key: `plan-site-${index}`,
                label: stop.name,
                lat: stop.lat!,
                lon: stop.lon!,
                kind: "site",
            });
        }
    });
    return points;
};

// GregorianDatePicker habla en year/doy; el planner guarda YYYY-MM-DD
export const isoToYearDoy = (iso: string) => {
    if (!iso) return { year: "", doy: "" };
    const [year = "", doy = ""] = dayFromDate(iso)?.split(" ") ?? [];
    return { year, doy };
};

export const yearDoyToIso = (year: string, doy: string) =>
    dateFromDay(`${year} ${doy}`).toISOString().split("T")[0];

// --- Resumen del plan, alineado con el HTML que genera el backend ---

export const formatDriveMinutes = (minutes: number) => {
    const total = Math.max(0, Math.round(minutes));
    return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
};

// Un color por dia para las trazas del mapa y el resumen: la paleta de la app, ciclando
export const dayColor = (dayNumber: number) =>
    possibleColors[(dayNumber - 1) % possibleColors.length];

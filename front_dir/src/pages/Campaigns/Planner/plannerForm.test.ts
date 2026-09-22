import { describe, expect, it } from "vitest";

import { CampaignPlanData, CampaignPlanResult, CampaignPlanStop } from "@types";

import {
    PLANNER_DEFAULTS,
    buildPlannerPayload,
    formatDriveMinutes,
    isoToYearDoy,
    mapPointsFromPlan,
    newSiteToEntry,
    newSitePosition,
    overrideKeyOf,
    parseNewSite,
    planToFormValues,
    yearDoyToIso,
} from "./plannerForm";

// Request de ejemplo del contrato (docs/contrato-campaign-planner.md §7)
const saved: CampaignPlanData = {
    id: 12,
    name: "December 2026 campaign",
    start_city: "La Plata, Buenos Aires, Argentina",
    end_city: "La Plata, Buenos Aires, Argentina",
    start_date: "2026-12-06",
    stations: ["arg.lhcl", "arg.tucu"],
    new_sites: [
        "La Toma, San Luis, Argentina",
        "-34.1667,-69.7167",
        { name: "Site A", lat: -33.0, lon: -65.0 },
        { name: "Site B", city: "San Luis, Argentina" },
    ],
    time_on_site_minutes: 120,
    station_time_overrides: { "arg.lhcl": 60, "Site A": 30 },
    fuel_cost_per_km: 0.15,
    lodging_cost_per_night: 70,
    per_diem_cost_per_day: 50,
    num_participants: 2,
    day_start: "08:00",
    hard_stop: "20:00",
};

describe("sedes nuevas", () => {
    it("recorre las cuatro formas del contrato ida y vuelta", () => {
        for (const entry of saved.new_sites) {
            expect(newSiteToEntry(parseNewSite(entry))).toEqual(entry);
        }
    });

    it("sin ciudad ni coordenadas no genera entrada", () => {
        expect(newSiteToEntry(parseNewSite("   "))).toBeUndefined();
        expect(
            newSiteToEntry({ ...parseNewSite("1,2"), lon: "" }),
        ).toBeUndefined();
    });

    it("la clave del override es el nombre, la ciudad si no hay nombre, y nada para coordenadas sin nombre", () => {
        expect(
            overrideKeyOf(parseNewSite({ name: "Site A", lat: 1, lon: 2 })),
        ).toBe("Site A");
        expect(
            overrideKeyOf(parseNewSite("La Toma, San Luis, Argentina")),
        ).toBe("La Toma, San Luis, Argentina");
        expect(
            overrideKeyOf(parseNewSite("-34.1667,-69.7167")),
        ).toBeUndefined();
    });

    it("la posicion sale de las coordenadas, o de Locate mientras la ciudad no cambie", () => {
        expect(newSitePosition(parseNewSite("-34.1667,-69.7167"))).toEqual({
            lat: -34.1667,
            lon: -69.7167,
        });
        const city = parseNewSite("San Luis, Argentina");
        expect(newSitePosition(city)).toBeUndefined();
        const located = {
            ...city,
            geo: { query: "San Luis, Argentina", lat: -33.3, lon: -66.3 },
        };
        expect(newSitePosition(located)).toEqual({ lat: -33.3, lon: -66.3 });
        expect(
            newSitePosition({ ...located, city: "San Juan, Argentina" }),
        ).toBeUndefined();
    });
});

describe("formulario ↔ backend", () => {
    it("sin plan precarga los defaults del contrato", () => {
        expect(planToFormValues(undefined)).toEqual(PLANNER_DEFAULTS);
    });

    it("con plan guardado normaliza numeros y horas a texto de input", () => {
        const values = planToFormValues({
            ...saved,
            lodging_cost_per_night: "70.00" as unknown as number,
            day_start: "07:30:00",
        });
        expect(values.lodging_cost_per_night).toBe("70");
        expect(values.fuel_cost_per_km).toBe("0.15");
        expect(values.day_start).toBe("07:30");
        expect(values.station_time_overrides).toEqual({
            "arg.lhcl": "60",
            "Site A": "30",
        });
    });

    it("reconstruye el request del contrato desde el formulario", () => {
        const params: Record<string, unknown> = { ...saved };
        delete params.id;
        delete params.name;
        expect(buildPlannerPayload(planToFormValues(saved))).toEqual(params);
    });

    it("descarta los overrides vacios", () => {
        const values = planToFormValues(saved);
        values.station_time_overrides = { "arg.lhcl": "60", "Site A": "" };
        expect(buildPlannerPayload(values).station_time_overrides).toEqual({
            "arg.lhcl": 60,
        });
    });
});

describe("puntos del mapa desde el plan calculado", () => {
    const stop = (
        type: CampaignPlanStop["type"],
        name: string,
        lat: number | null,
        lon: number | null,
    ): CampaignPlanStop => ({
        type,
        name,
        code: type === "station" ? "arg.lhcl" : null,
        lat,
        lon,
        arrival: null,
        departure: null,
        leg_km: 0,
        leg_drive_minutes: 0,
        leg_fuel_cost: 0,
        warning: null,
        geometry: [],
    });
    const plan = (stops: CampaignPlanStop[]): CampaignPlanResult => ({
        days: [
            {
                day_number: 1,
                date: "2026-12-06",
                stops,
                day_total_km: 0,
                day_total_drive_minutes: 0,
                day_total_fuel_cost: 0,
            },
        ],
        summary: {
            total_km: 0,
            total_drive_minutes: 0,
            total_fuel_cost: 0,
            total_lodging_cost: 0,
            total_per_diem_cost: 0,
            total_days: 1,
            total_stations: 1,
            num_participants: 1,
        },
    });

    it("origen y destino iguales son un solo punto; las sedes nuevas van con su nombre; el pernocte sin coordenadas se saltea", () => {
        const points = mapPointsFromPlan(
            plan([
                stop("origin", "La Plata", -34.9, -57.9),
                stop("station", "Las Heras", -32.1, -70.0),
                stop("new_site", "La Toma", -33.0, -65.1),
                stop("intermediate", "Overnight stop", null, null),
                stop("destination", "La Plata", -34.9, -57.9),
            ]),
        );
        expect(points.map((p) => [p.label, p.kind])).toEqual([
            ["Start / end", "city"],
            ["La Toma", "site"],
        ]);
    });

    it("con destino distinto aparecen Start y End", () => {
        const points = mapPointsFromPlan(
            plan([
                stop("origin", "La Plata", -34.9, -57.9),
                stop("destination", "Salta", -24.8, -65.4),
            ]),
        );
        expect(points.map((p) => p.label)).toEqual(["Start", "End"]);
    });
});

describe("fechas y formatos", () => {
    it("ISO ↔ year/doy sin corrimiento", () => {
        expect(isoToYearDoy("2026-12-06")).toEqual({
            year: "2026",
            doy: "340",
        });
        expect(yearDoyToIso("2026", "340")).toBe("2026-12-06");
        expect(isoToYearDoy("")).toEqual({ year: "", doy: "" });
    });

    it("minutos de manejo como en el HTML", () => {
        expect(formatDriveMinutes(2221)).toBe("37h 01m");
        expect(formatDriveMinutes(0)).toBe("0h 00m");
    });
});

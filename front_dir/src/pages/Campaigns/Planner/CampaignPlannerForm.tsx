import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosInstance } from "axios";

import {
    Alert,
    GregorianDatePicker,
    TableCard,
    TimeInput,
} from "@componentsReact";

import { useFormReducer } from "@hooks";
import { useGeocodeCity, useStationCatalog } from "@hooks/queries";

import {
    AlertMsg,
    CampaignPlanData,
    CampaignPlanResult,
    StationData,
} from "@types";

import { modalActions, showModal, stationCodeOf, toAlertMsg } from "@utils";

import BackToPlansLink from "./BackToPlansLink";
import CampaignPlanMapOL from "./CampaignPlanMapOL";
import PlanSummary from "./PlanSummary";
import PlannerStopsPanel from "./PlannerStopsPanel";
import SavePlanModal, { SavedPlanRef } from "./SavePlanModal";
import {
    PLANNER_WIDTH,
    PlanMapPoint,
    PlannerFormValues,
    buildPlannerPayload,
    isoToYearDoy,
    mapPointsFromPlan,
    newSitePosition,
    planToFormValues,
    yearDoyToIso,
} from "./plannerForm";
import { useRunCampaignPlanner } from "./useRunCampaignPlanner";

interface Props {
    api: AxiosInstance;
    plan: CampaignPlanData | undefined;
}

type CityKey = "start_city" | "end_city";
// Geocodificada para el texto `query`: si el usuario edita la ciudad, deja de valer
type CityGeo = { query: string; lat: number; lon: number };

const CITY_FIELDS: { name: CityKey; label: string }[] = [
    { name: "start_city", label: "Start city" },
    { name: "end_city", label: "End city" },
];

const TIME_FIELDS = [
    { name: "day_start", label: "Day start" },
    { name: "hard_stop", label: "Hard stop" },
] as const;

const NUMBER_FIELDS = [
    {
        name: "num_participants",
        label: "Participants",
        min: 1,
        step: 1,
        hint: "multiplies lodging and per diem",
    },
    {
        name: "time_on_site_minutes",
        label: "Time on site",
        min: 1,
        step: 1,
        hint: "minutes per stop",
    },
    {
        name: "fuel_cost_per_km",
        label: "Fuel cost",
        min: 0,
        step: "any",
        hint: "per km · 0 hides fuel costs",
    },
    {
        name: "lodging_cost_per_night",
        label: "Lodging cost",
        min: 0,
        step: "any",
        hint: "per night per person",
    },
    {
        name: "per_diem_cost_per_day",
        label: "Per diem",
        min: 0,
        step: "any",
        hint: "per day per person",
    },
] as const;

const CampaignPlannerForm = ({ api, plan }: Props) => {
    const { formState, dispatch } = useFormReducer<PlannerFormValues>(
        planToFormValues(plan),
    );

    const [savedPlan, setSavedPlan] = useState<SavedPlanRef | undefined>(
        plan ? { id: plan.id, name: plan.name } : undefined,
    );
    const [planResult, setPlanResult] = useState<CampaignPlanResult>();
    const [msg, setMsg] = useState<AlertMsg | undefined>();
    const [cityGeo, setCityGeo] = useState<Partial<Record<CityKey, CityGeo>>>(
        {},
    );
    const [showSave, setShowSave] = useState(false);

    useEffect(() => {
        showSave && showModal("SavePlan");
    }, [showSave]);

    const { data: catalog, isLoading: loadingCatalog } = useStationCatalog(api);
    const geocode = useGeocodeCity(api);
    const runner = useRunCampaignPlanner(api);

    // Estable: es lo que permite el memo de PlannerStopsPanel
    const setValue = useCallback(
        (
            name: keyof PlannerFormValues,
            value: PlannerFormValues[keyof PlannerFormValues],
        ) =>
            dispatch({
                type: "change_value",
                payload: { inputName: name, inputValue: value },
            }),
        [dispatch],
    );

    const onApiError = (error: unknown) => setMsg(toAlertMsg(error));

    // Errores del backend por campo (attr); los del motor (attr null) van al Alert
    const fieldErrors = useMemo(
        () =>
            new Map(
                (msg?.errors?.errors ?? [])
                    .filter((e) => e.attr && e.attr !== "non_field_errors")
                    .map((e) => [e.attr.split(".")[0], e]),
            ),
        [msg],
    );
    const badge = (name: string, position = "-top-2") => {
        const error = fieldErrors.get(name);
        return error ? (
            <span
                className={`badge badge-error absolute right-2 z-[1] ${position}`}
                title={error.detail}
            >
                {error.code.toUpperCase()}
            </span>
        ) : null;
    };

    const geoOf = (key: CityKey) =>
        cityGeo[key]?.query === formState[key].trim()
            ? cityGeo[key]
            : undefined;

    const locateCity = (key: CityKey) => {
        const query = formState[key].trim();
        if (!query) return;
        setMsg(undefined);
        geocode.mutate(query, {
            onSuccess: (data) =>
                setCityGeo((prev) => ({
                    ...prev,
                    [key]: { query, lat: data.lat, lon: data.lon },
                })),
            onError: onApiError,
        });
    };

    // para dibujar los puntos en un plan ya guardado
    useEffect(() => {
        const start = plan?.start_city.trim() ?? "";
        const end = plan?.end_city.trim() ?? "";
        if (!start) return;
        geocode.mutate(start, {
            onSuccess: (data) => {
                const geo = { query: start, lat: data.lat, lon: data.lon };
                setCityGeo(
                    end === start
                        ? { start_city: geo, end_city: geo }
                        : { start_city: geo },
                );
                if (end && end !== start)
                    geocode.mutate(end, {
                        onSuccess: (d) =>
                            setCityGeo((prev) => ({
                                ...prev,
                                end_city: {
                                    query: end,
                                    lat: d.lat,
                                    lon: d.lon,
                                },
                            })),
                        onError: onApiError,
                    });
            },
            onError: onApiError,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedStations = useMemo(() => {
        const codes = new Set(formState.stations.map((c) => c.toLowerCase()));
        return (catalog?.data ?? []).filter(
            (s: StationData) =>
                s.lat && s.lon && codes.has(stationCodeOf(s).toLowerCase()),
        );
    }, [catalog, formState.stations]);

    const startGeo = geoOf("start_city");
    const endGeo = geoOf("end_city");
    // Con plan calculado mandan sus paradas: origen, destino y sedes ya geocodificadas
    const mapPoints = useMemo<PlanMapPoint[]>(() => {
        if (planResult) return mapPointsFromPlan(planResult);
        const sameCity =
            startGeo &&
            endGeo &&
            startGeo.lat === endGeo.lat &&
            startGeo.lon === endGeo.lon;
        const points: PlanMapPoint[] = [];
        if (startGeo)
            points.push({
                key: "start",
                label: sameCity ? "Start / end" : "Start",
                lat: startGeo.lat,
                lon: startGeo.lon,
                kind: "city",
            });
        if (endGeo && !sameCity)
            points.push({
                key: "end",
                label: "End",
                lat: endGeo.lat,
                lon: endGeo.lon,
                kind: "city",
            });
        for (const site of formState.new_sites) {
            const position = newSitePosition(site);
            if (position)
                points.push({
                    key: site.key,
                    label:
                        site.name ||
                        (site.mode === "city" ? site.city : "Site"),
                    ...position,
                    kind: "site",
                });
        }
        return points;
    }, [planResult, startGeo, endGeo, formState.new_sites]);

    const handlePlan = () => {
        setMsg(undefined);
        runner.run(buildPlannerPayload(formState), {
            onSuccess: (data) => {
                setPlanResult(data.plan);
                setMsg({
                    status: 200,
                    msg: `Plan opened in a new tab · ${data.plan.summary.total_days} days · ${data.plan.summary.total_km.toFixed(1)} km`,
                });
            },
            onError: onApiError,
        });
    };

    const { year, doy } = isoToYearDoy(formState.start_date);
    const running = runner.isPending;

    return (
        <TableCard
            title="Planner"
            size={PLANNER_WIDTH}
            headerContent={
                savedPlan && (
                    <span
                        className="badge badge-neutral badge-lg"
                        title="Saved plan loaded in the form"
                    >
                        {savedPlan.name}
                    </span>
                )
            }
            headerActions={<BackToPlansLink />}
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-4 lg:grid-cols-2 gap-3">
                    {CITY_FIELDS.map(({ name, label }) => {
                        const geo = geoOf(name);
                        return (
                            <label
                                key={name}
                                className="form-control col-span-2 lg:col-span-full"
                            >
                                <span className="label-text font-bold">
                                    {label} *
                                </span>
                                <div className="join w-full">
                                    <div className="relative grow">
                                        <input
                                            type="text"
                                            maxLength={255}
                                            autoComplete="off"
                                            className={`input input-bordered join-item w-full ${fieldErrors.has(name) ? "input-error" : ""}`}
                                            value={formState[name]}
                                            onChange={(e) =>
                                                setValue(name, e.target.value)
                                            }
                                        />
                                        {badge(name)}
                                    </div>
                                    {name === "end_city" && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost join-item"
                                            title="Use the start city"
                                            disabled={
                                                !formState.start_city.trim()
                                            }
                                            onClick={() => {
                                                setValue(
                                                    "end_city",
                                                    formState.start_city,
                                                );
                                                // la posicion ya localizada del origen vale para el destino
                                                setCityGeo((prev) =>
                                                    prev.start_city
                                                        ? {
                                                              ...prev,
                                                              end_city:
                                                                  prev.start_city,
                                                          }
                                                        : prev,
                                                );
                                            }}
                                        >
                                            Same as start
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-neutral join-item"
                                        title="Show the city on the map"
                                        disabled={
                                            !formState[name].trim() ||
                                            geocode.isPending
                                        }
                                        onClick={() => locateCity(name)}
                                    >
                                        Locate
                                    </button>
                                </div>
                                <span className="label-text-alt mt-1 opacity-70">
                                    {geo
                                        ? `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`
                                        : 'Be specific: "City, Province, Country"'}
                                </span>
                            </label>
                        );
                    })}

                    <div className="form-control relative">
                        {/* top-3: salta el label propio del picker */}
                        {badge("start_date", "top-3")}
                        <GregorianDatePicker
                            year={year}
                            doy={doy}
                            label="Start date *"
                            labelAbove
                            onChange={(newYear, newDoy) =>
                                setValue(
                                    "start_date",
                                    yearDoyToIso(newYear, newDoy),
                                )
                            }
                        />
                    </div>
                    {TIME_FIELDS.map(({ name, label }) => (
                        <label key={name} className="form-control">
                            <span className="label-text font-bold">
                                {label} *
                            </span>
                            <div className="relative">
                                <TimeInput
                                    value={formState[name]}
                                    step={60}
                                    className={`input input-bordered w-full ${fieldErrors.has(name) ? "input-error" : ""}`}
                                    onChange={(value) => setValue(name, value)}
                                />
                                {badge(name)}
                            </div>
                        </label>
                    ))}
                    {NUMBER_FIELDS.map(({ name, label, min, step, hint }) => (
                        <label key={name} className="form-control">
                            <span className="label-text font-bold">
                                {label} *
                            </span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={min}
                                    step={step}
                                    className={`input input-bordered w-full ${fieldErrors.has(name) ? "input-error" : ""}`}
                                    value={formState[name]}
                                    onChange={(e) =>
                                        setValue(name, e.target.value)
                                    }
                                />
                                {badge(name)}
                            </div>
                            <span className="label-text-alt mt-1 opacity-70">
                                {hint}
                            </span>
                        </label>
                    ))}
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                    <PlannerStopsPanel
                        api={api}
                        catalog={catalog?.data}
                        loadingCatalog={loadingCatalog}
                        stations={formState.stations}
                        newSites={formState.new_sites}
                        overrides={formState.station_time_overrides}
                        defaultMinutes={formState.time_on_site_minutes}
                        onChange={setValue}
                        errors={fieldErrors}
                    />
                    <div className="card bg-base-200 shadow-xl">
                        <h2 className="card-title border-b-2 border-base-300 p-2">
                            Map
                        </h2>
                        <div className="p-3 flex-1 flex flex-col">
                            <CampaignPlanMapOL
                                api={api}
                                stations={selectedStations}
                                points={mapPoints}
                                plan={planResult}
                                loading={loadingCatalog}
                            />
                        </div>
                    </div>
                </div>

                {planResult && <PlanSummary plan={planResult} />}

                <Alert msg={msg} />

                <div className={modalActions.container}>
                    <button
                        type="button"
                        className={modalActions.secondary}
                        disabled={running}
                        onClick={() => {
                            setMsg(undefined);
                            setShowSave(true);
                        }}
                    >
                        Save plan
                    </button>
                    <button
                        type="button"
                        className={modalActions.primary}
                        disabled={running}
                        onClick={handlePlan}
                    >
                        Plan campaign
                        {running && (
                            <span className="loading loading-spinner loading-md"></span>
                        )}
                    </button>
                </div>
            </div>

            {showSave && (
                <SavePlanModal
                    api={api}
                    params={buildPlannerPayload(formState)}
                    saved={savedPlan}
                    onSaved={(saved) => {
                        setSavedPlan({ id: saved.id, name: saved.name });
                        setMsg({
                            status: 200,
                            msg: `Plan "${saved.name}" saved`,
                        });
                    }}
                    closeModal={() => setShowSave(false)}
                />
            )}
        </TableCard>
    );
};

export default CampaignPlannerForm;

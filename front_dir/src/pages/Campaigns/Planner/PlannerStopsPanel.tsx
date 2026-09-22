import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AxiosInstance } from "axios";

import { MapPinIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Alert, StationSelectList } from "@componentsReact";
import MapModal, { MapSelection } from "@components/map/MapModalOL";

import { useGeocodeCity } from "@hooks/queries";

import { AlertMsg, Errors, StationData } from "@types";

import {
    mergeStationCodes,
    removeStationCode,
    showModal,
    sortByStationCode,
    sortStationsByCode,
    stationCodeOf,
    toAlertMsg,
} from "@utils";

import {
    NewSiteForm,
    PlannerFormValues,
    newSite,
    newSitePosition,
    newSiteToEntry,
    overrideKeyOf,
} from "./plannerForm";

interface Props {
    api: AxiosInstance;
    catalog: StationData[] | undefined;
    loadingCatalog: boolean;
    stations: string[];
    newSites: NewSiteForm[];
    overrides: Record<string, string>;
    defaultMinutes: string;
    onChange: (
        name: keyof PlannerFormValues,
        value: PlannerFormValues[keyof PlannerFormValues],
    ) => void;
    errors: Map<string, Errors["errors"][number]>;
}

const PlannerStopsPanel = ({
    api,
    catalog,
    loadingCatalog,
    stations,
    newSites,
    overrides,
    defaultMinutes,
    onChange,
    errors,
}: Props) => {
    const [draft, setDraft] = useState<NewSiteForm>(newSite);
    const [msg, setMsg] = useState<AlertMsg | undefined>();
    const [showMapModal, setShowMapModal] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);
    // Que sede se esta geocodificando: la mutation es una sola y su isPending
    // deshabilitaria el Locate de todas las filas a la vez
    const [locating, setLocating] = useState<string | undefined>();

    const geocode = useGeocodeCity(api);

    useEffect(() => {
        showMapModal?.show && showModal(showMapModal.title);
    }, [showMapModal]);

    const catalogByCode = useMemo(
        () =>
            new Map(
                (catalog ?? []).map((s) => [stationCodeOf(s).toLowerCase(), s]),
            ),
        [catalog],
    );
    const listedApiIds = useMemo(
        () =>
            new Set(
                stations
                    .map(
                        (code) => catalogByCode.get(code.toLowerCase())?.api_id,
                    )
                    .filter((id): id is number => id !== undefined),
            ),
        [stations, catalogByCode],
    );

    const sortedStations = useMemo(
        () => sortByStationCode(stations),
        [stations],
    );
    const sortedCatalog = useMemo(
        () => catalog && sortStationsByCode(catalog),
        [catalog],
    );

    // Los overrides sin la clave de la parada que se saca
    const without = (key: string | undefined) => {
        const next = { ...overrides };
        if (key) delete next[key];
        return next;
    };

    const toggleStation = useCallback(
        (station: StationData) => {
            const code = stationCodeOf(station);
            if (
                station.api_id !== undefined &&
                listedApiIds.has(station.api_id)
            ) {
                onChange("stations", removeStationCode(stations, code));
                const next = { ...overrides };
                delete next[code];
                onChange("station_time_overrides", next);
            } else {
                onChange(
                    "stations",
                    mergeStationCodes(stations, [code]).merged,
                );
            }
        },
        [stations, listedApiIds, overrides, onChange],
    );

    const removeStation = (code: string) => {
        onChange("stations", removeStationCode(stations, code));
        onChange("station_time_overrides", without(code));
    };

    const removeSite = (site: NewSiteForm) => {
        onChange(
            "new_sites",
            newSites.filter((s) => s.key !== site.key),
        );
        onChange("station_time_overrides", without(overrideKeyOf(site)));
    };

    const setOverride = (key: string, minutes: string) =>
        onChange(
            "station_time_overrides",
            minutes.trim() ? { ...overrides, [key]: minutes } : without(key),
        );

    const locate = (
        query: string,
        id: string,
        apply: (geo: NewSiteForm["geo"]) => void,
    ) => {
        if (!query) return;
        setMsg(undefined);
        setLocating(id);
        geocode.mutate(query, {
            onSuccess: (data) => apply({ query, lat: data.lat, lon: data.lon }),
            onError: (err) => setMsg(toAlertMsg(err)),
            onSettled: () => setLocating(undefined),
        });
    };

    const addDraft = () => {
        onChange("new_sites", [
            ...newSites,
            { ...draft, name: draft.name.trim() },
        ]);
        setDraft(newSite());
    };

    const handleMapSave = (selection: MapSelection | null) => {
        const marker = selection?.marker;
        if (marker)
            setDraft((d) => ({
                ...d,
                mode: "coords",
                lat: marker.lat.toFixed(6),
                lon: marker.lng.toFixed(6),
            }));
    };

    const draftPosition = newSitePosition(draft);
    const stopsCount = stations.length + newSites.length;
    const badge = (name: string) => {
        const error = errors.get(name);
        return error ? (
            <span className="badge badge-error" title={error.detail}>
                {error.code.toUpperCase()}
            </span>
        ) : null;
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                <span className="flex items-center gap-2">
                    Stops
                    <span className="badge badge-accent">{stopsCount}</span>
                    {badge("stations")}
                </span>
                <button
                    type="button"
                    className="btn btn-ghost btn-sm text-error"
                    disabled={stopsCount === 0}
                    onClick={() => {
                        onChange("stations", []);
                        onChange("new_sites", []);
                        onChange("station_time_overrides", {});
                    }}
                >
                    Clear stops
                </button>
            </h2>
            <div className="flex flex-col gap-3 p-3">
                <div className="flex flex-col gap-2">
                    <span className="font-bold">Existing stations</span>
                    <StationSelectList
                        stations={sortedCatalog}
                        isLoading={loadingCatalog}
                        selectedApiId={undefined}
                        selectedApiIds={listedApiIds}
                        onSelect={toggleStation}
                        height={200}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-2 font-bold">
                        New site
                        {badge("new_sites")}
                    </span>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <label className="form-control">
                            <span className="label-text">Name (optional)</span>
                            <input
                                type="text"
                                className="input input-bordered input-sm"
                                value={draft.name}
                                maxLength={100}
                                autoComplete="off"
                                onChange={(e) =>
                                    setDraft((d) => ({
                                        ...d,
                                        name: e.target.value,
                                    }))
                                }
                            />
                        </label>
                        <div className="form-control">
                            <span className="label-text">Location by</span>
                            <div className="join">
                                {(["city", "coords"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={`btn btn-sm join-item ${draft.mode === mode ? "btn-neutral" : "btn-outline"}`}
                                        onClick={() =>
                                            setDraft((d) => ({ ...d, mode }))
                                        }
                                    >
                                        {mode === "city"
                                            ? "City"
                                            : "Coordinates"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {draft.mode === "city" ? (
                            <label className="form-control col-span-full">
                                <span className="label-text">
                                    City (e.g. "San Luis, Argentina")
                                </span>
                                <div className="join">
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm join-item w-full"
                                        value={draft.city}
                                        maxLength={255}
                                        autoComplete="off"
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                city: e.target.value,
                                            }))
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-neutral join-item"
                                        title="Show the city on the map"
                                        disabled={
                                            !draft.city.trim() ||
                                            locating !== undefined
                                        }
                                        onClick={() =>
                                            locate(
                                                draft.city.trim(),
                                                "draft",
                                                (geo) =>
                                                    setDraft((d) => ({
                                                        ...d,
                                                        geo,
                                                    })),
                                            )
                                        }
                                    >
                                        Locate
                                        {locating === "draft" && (
                                            <span className="loading loading-spinner loading-xs"></span>
                                        )}
                                    </button>
                                </div>
                                {draftPosition && (
                                    <span className="label-text-alt">
                                        {draftPosition.lat.toFixed(4)},{" "}
                                        {draftPosition.lon.toFixed(4)}
                                    </span>
                                )}
                            </label>
                        ) : (
                            <div className="col-span-full flex gap-2 items-end">
                                <label className="form-control flex-1">
                                    <span className="label-text">Latitude</span>
                                    <input
                                        type="number"
                                        step="any"
                                        min={-90}
                                        max={90}
                                        className="input input-bordered input-sm"
                                        value={draft.lat}
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                lat: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="form-control flex-1">
                                    <span className="label-text">
                                        Longitude
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min={-180}
                                        max={180}
                                        className="input input-bordered input-sm"
                                        value={draft.lon}
                                        onChange={(e) =>
                                            setDraft((d) => ({
                                                ...d,
                                                lon: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline"
                                    onClick={() =>
                                        setShowMapModal({
                                            show: true,
                                            title: "map",
                                            type: "edit",
                                        })
                                    }
                                >
                                    <MapPinIcon className="size-4" />
                                    Pick on map
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={newSiteToEntry(draft) === undefined}
                            onClick={addDraft}
                        >
                            + Add site
                        </button>
                    </div>
                </div>

                <Alert msg={msg} />

                <div className="overflow-x-auto">
                    <table className="table table-sm bg-neutral-content">
                        <thead>
                            <tr>
                                <th className="w-28">Type</th>
                                <th>Stop</th>
                                <th>Location</th>
                                <th className="whitespace-nowrap">
                                    Time on site (min){" "}
                                    {badge("station_time_overrides")}
                                </th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {stopsCount === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-center opacity-70"
                                    >
                                        No stops yet: pick stations above or add
                                        a new site
                                    </td>
                                </tr>
                            )}
                            {sortedStations.map((code) => {
                                const station = catalogByCode.get(
                                    code.toLowerCase(),
                                );
                                return (
                                    <tr key={code}>
                                        <td>
                                            <span className="badge badge-neutral whitespace-nowrap">
                                                station
                                            </span>
                                        </td>
                                        <td>
                                            <span className="font-mono font-bold">
                                                {code.toUpperCase()}
                                            </span>
                                            {station?.station_name && (
                                                <span className="opacity-70">
                                                    {" "}
                                                    · {station.station_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {station?.lat && station?.lon
                                                ? `${station.lat.toFixed(4)}, ${station.lon.toFixed(4)}`
                                                : station
                                                  ? "No coordinates"
                                                  : "Not in the catalog"}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                className="input input-bordered input-sm w-24"
                                                placeholder={defaultMinutes}
                                                value={overrides[code] ?? ""}
                                                onChange={(e) =>
                                                    setOverride(
                                                        code,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                title="Remove stop"
                                                onClick={() =>
                                                    removeStation(code)
                                                }
                                            >
                                                <XMarkIcon className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {newSites.map((site) => {
                                const key = overrideKeyOf(site);
                                const position = newSitePosition(site);
                                return (
                                    <tr key={site.key}>
                                        <td>
                                            <span className="badge badge-warning whitespace-nowrap">
                                                new site
                                            </span>
                                        </td>
                                        <td>
                                            {site.name ? (
                                                <>
                                                    <span className="font-bold">
                                                        {site.name}
                                                    </span>
                                                    {site.mode === "city" && (
                                                        <span className="opacity-70">
                                                            {" "}
                                                            · {site.city}
                                                        </span>
                                                    )}
                                                </>
                                            ) : site.mode === "city" ? (
                                                site.city
                                            ) : (
                                                <span className="opacity-70">
                                                    Unnamed site
                                                </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {position ? (
                                                `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`
                                            ) : site.mode === "city" ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs"
                                                    title="Show the city on the map"
                                                    disabled={
                                                        locating !== undefined
                                                    }
                                                    onClick={() =>
                                                        locate(
                                                            site.city.trim(),
                                                            site.key,
                                                            (geo) =>
                                                                onChange(
                                                                    "new_sites",
                                                                    newSites.map(
                                                                        (s) =>
                                                                            s.key ===
                                                                            site.key
                                                                                ? {
                                                                                      ...s,
                                                                                      geo,
                                                                                  }
                                                                                : s,
                                                                    ),
                                                                ),
                                                        )
                                                    }
                                                >
                                                    <MapPinIcon className="size-4" />
                                                    Locate
                                                    {locating === site.key && (
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                    )}
                                                </button>
                                            ) : (
                                                "Invalid coordinates"
                                            )}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                className="input input-bordered input-sm w-24"
                                                placeholder={defaultMinutes}
                                                disabled={!key}
                                                title={
                                                    key
                                                        ? undefined
                                                        : "Give the site a name to set its own time"
                                                }
                                                value={
                                                    key
                                                        ? (overrides[key] ?? "")
                                                        : ""
                                                }
                                                onChange={(e) =>
                                                    key &&
                                                    setOverride(
                                                        key,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                title="Remove stop"
                                                onClick={() => removeSite(site)}
                                            >
                                                <XMarkIcon className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <span className="text-xs opacity-70">
                    Empty time uses the default. Stop order does not matter: the
                    planner routes them from the start city.
                </span>
            </div>

            {showMapModal?.show && showMapModal.title === "map" && (
                <MapModal
                    setShowMapModal={setShowMapModal}
                    onSave={handleMapSave}
                    initialSelection={
                        draft.mode === "coords" && draftPosition
                            ? {
                                  marker: {
                                      lat: draftPosition.lat,
                                      lng: draftPosition.lon,
                                      radiusKm: 0,
                                  },
                              }
                            : undefined
                    }
                    markerType="marker"
                    title="Pick the new site"
                />
            )}
        </div>
    );
};

// memo: cada tecla del formulario padre rearma su estado; las props de este
// panel son estables (memos y callbacks del padre) y el catalogo es grande
export default memo(PlannerStopsPanel);

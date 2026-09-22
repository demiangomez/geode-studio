import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxiosInstance } from "axios";

import { MapIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Alert, StationSelectList } from "@componentsReact";
import MapModal, { MapSelection } from "@components/map/MapModalOL";
import StationListMapModal from "@components/map/StationListMapModal";

import { useMetadata, useStationCatalog } from "@hooks/queries";
import { useResolveProcessingStations } from "@hooks/queries";

import { AlertMsg, ProcessingStationListParams, StationData } from "@types";

import {
    mergeStationCodes,
    removeStationCode,
    showModal,
    sortStationsByCode,
    stationCodeOf,
    toAlertMsg,
} from "@utils";

const DEFAULT_RADIUS_KM = 40;

type LatLng = { lat: number; lng: number };

// memo + onRemove estable: con miles de badges, quitar una no debe repintar el resto
const StationCodeBadge = memo(
    ({
        code,
        onRemove,
    }: {
        code: string;
        onRemove: (code: string) => void;
    }) => (
        <span className="badge badge-neutral badge-lg gap-2 font-mono">
            {code}
            <XMarkIcon
                className="size-3 cursor-pointer"
                onClick={() => onRemove(code)}
            />
        </span>
    ),
);

interface Props {
    api: AxiosInstance;
    stationList: string[];
    onChange: (next: string[]) => void;
    error?: string;
}

const ProcessingStationsPanel = ({
    api,
    stationList,
    onChange,
    error,
}: Props) => {
    const { data: catalog, isLoading: loadingCatalog } = useStationCatalog(api);
    const { types, countries } = useMetadata(api, {
        only: ["types", "countries"],
    });

    const [stationType, setStationType] = useState("");
    const [countryCodes, setCountryCodes] = useState<string[]>([]);
    const [location, setLocation] = useState<LatLng | undefined>();
    const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
    const [polygon, setPolygon] = useState<LatLng[] | undefined>();

    const [mapMode, setMapMode] = useState<"marker" | "polygon">("polygon");
    const [showMapModal, setShowMapModal] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);
    const [msg, setMsg] = useState<AlertMsg | undefined>();

    const resolve = useResolveProcessingStations(api);
    const [resolvedFor, setResolvedFor] = useState<
        ProcessingStationListParams | undefined
    >();

    useEffect(() => {
        showMapModal?.show && showModal(showMapModal.title);
    }, [showMapModal]);

    const openMap = (mode: "marker" | "polygon") => {
        setMapMode(mode);
        setShowMapModal({ show: true, title: "map", type: "edit" });
    };

    const openListMap = () =>
        setShowMapModal({ show: true, title: "stations-map", type: "none" });

    const handleMapSave = (selection: MapSelection | null) => {
        if (mapMode === "marker") {
            setLocation(selection?.marker);
            if (selection?.marker) setRadiusKm(selection.marker.radiusKm);
        } else {
            setPolygon(selection?.polygon);
        }
    };

    const params = useMemo<ProcessingStationListParams | undefined>(() => {
        const p: ProcessingStationListParams = {};
        if (stationType) p.station_type = Number(stationType);
        if (countryCodes.length) p.country_code = countryCodes;
        if (location) {
            p.lat = location.lat;
            p.lon = location.lng;
            p.distance_km = radiusKm;
        }
        if (polygon && polygon.length >= 3) {
            p.polygon = polygon.map((v) => ({ lat: v.lat, lon: v.lng }));
        }
        return Object.keys(p).length ? p : undefined;
    }, [stationType, countryCodes, location, radiusKm, polygon]);

    const handleResolve = () => {
        if (!params) return;
        setMsg(undefined);
        setResolvedFor(params);
        resolve.mutate(params, {
            onError: (err) => setMsg(toAlertMsg(err)),
        });
    };

    // El resultado vale solo para los filtros con los que se pidio
    const result = resolvedFor === params ? resolve.data : undefined;
    const summary = useMemo(() => {
        if (!result) return undefined;
        const { merged, added } = mergeStationCodes(
            stationList,
            result.station_list,
        );
        return {
            merged,
            added,
            already: result.count - added,
            noCoords: result.stations.filter((s) => !s.lat || !s.lon).length,
        };
    }, [result, stationList]);

    const listedApiIds = useMemo(() => {
        const codes = new Set(stationList.map((c) => c.toLowerCase()));
        const ids = new Set<number>();
        for (const s of catalog?.data ?? []) {
            if (
                s.api_id !== undefined &&
                codes.has(stationCodeOf(s).toLowerCase())
            )
                ids.add(s.api_id);
        }
        return ids;
    }, [stationList, catalog]);

    const toggleStation = useCallback(
        (station: StationData) => {
            const code = stationCodeOf(station);
            onChange(
                station.api_id !== undefined && listedApiIds.has(station.api_id)
                    ? removeStationCode(stationList, code)
                    : mergeStationCodes(stationList, [code]).merged,
            );
        },
        [stationList, listedApiIds, onChange],
    );
    // Sin las redes placeholder "?", igual que el resolvedor del backend
    const addAllStations = () =>
        onChange(
            mergeStationCodes(
                stationList,
                (catalog?.data ?? [])
                    .filter((s) => !s.network_code.startsWith("?"))
                    .map(stationCodeOf),
            ).merged,
        );

    const sortedCatalog = useMemo(
        () => catalog && sortStationsByCode(catalog.data),
        [catalog],
    );

    const stationListRef = useRef(stationList);
    stationListRef.current = stationList;
    const removeCode = useCallback(
        (code: string) =>
            onChange(removeStationCode(stationListRef.current, code)),
        [onChange],
    );

    const availableCountries = useMemo(
        () =>
            countries.filter(
                (c) => !countryCodes.includes(c.three_digits_code),
            ),
        [countries, countryCodes],
    );

    return (
        <div className="card bg-base-200 shadow-xl">
            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                <span className="flex items-center gap-2">
                    Processing stations
                    <span className="badge badge-accent">
                        {stationList.length}
                    </span>
                    {error && (
                        <span className="badge badge-error">{error}</span>
                    )}
                </span>
                <span className="flex gap-1">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={stationList.length === 0}
                        onClick={openListMap}
                    >
                        <MapIcon className="size-4" />
                        View on map
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!catalog?.data?.length}
                        onClick={addAllStations}
                    >
                        All stations
                    </button>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error"
                        disabled={stationList.length === 0}
                        onClick={() => onChange([])}
                    >
                        Clear list
                    </button>
                </span>
            </h2>
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 p-3">
                <div className="flex flex-col gap-2">
                    <StationSelectList
                        stations={sortedCatalog}
                        isLoading={loadingCatalog}
                        selectedApiId={undefined}
                        selectedApiIds={listedApiIds}
                        onSelect={toggleStation}
                        height={240}
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <span className="font-bold">Add stations by filter</span>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                        <label className="form-control">
                            <span className="label-text">Station type</span>
                            <select
                                className="select select-bordered select-sm"
                                value={stationType}
                                onChange={(e) => setStationType(e.target.value)}
                            >
                                <option value="">Any type</option>
                                {types.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="form-control">
                            <span className="label-text">Countries</span>
                            <select
                                className="select select-bordered select-sm"
                                value=""
                                onChange={(e) =>
                                    e.target.value &&
                                    setCountryCodes((prev) => [
                                        ...prev,
                                        e.target.value,
                                    ])
                                }
                            >
                                <option value="">Add country...</option>
                                {availableCountries.map((c) => (
                                    <option
                                        key={c.three_digits_code}
                                        value={c.three_digits_code}
                                    >
                                        {c.name} ({c.three_digits_code})
                                    </option>
                                ))}
                            </select>
                            {countryCodes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {countryCodes.map((code) => (
                                        <span
                                            key={code}
                                            className="badge badge-neutral gap-1"
                                        >
                                            {code}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCountryCodes((prev) =>
                                                        prev.filter(
                                                            (c) => c !== code,
                                                        ),
                                                    )
                                                }
                                            >
                                                <XMarkIcon className="size-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </label>
                        <div className="form-control">
                            <span className="label-text">Location</span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    className={`btn btn-sm flex-1 normal-case ${location ? "btn-success" : "btn-outline"}`}
                                    onClick={() => openMap("marker")}
                                >
                                    {location
                                        ? `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)} · ${radiusKm} km`
                                        : "Pick on map (marker + radius)"}
                                </button>
                                {location && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-square btn-outline hover:btn-error"
                                        title="Clear location"
                                        onClick={() => setLocation(undefined)}
                                    >
                                        <XMarkIcon className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="form-control">
                            <span className="label-text">Polygon</span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    className={`btn btn-sm flex-1 normal-case ${polygon ? "btn-success" : "btn-outline"}`}
                                    onClick={() => openMap("polygon")}
                                >
                                    {polygon
                                        ? `Polygon with ${polygon.length} vertices`
                                        : "Draw on map"}
                                </button>
                                {polygon && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-square btn-outline hover:btn-error"
                                        title="Clear polygon"
                                        onClick={() => setPolygon(undefined)}
                                    >
                                        <XMarkIcon className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={!params || resolve.isPending}
                            onClick={handleResolve}
                        >
                            Resolve
                            {resolve.isPending && (
                                <span className="loading loading-spinner loading-xs"></span>
                            )}
                        </button>
                        <span className="text-sm opacity-80">
                            Filters combine with AND · at least one required
                        </span>
                    </div>

                    <Alert msg={msg} />

                    {result && summary && (
                        <div className="rounded-md bg-neutral-content p-3 flex items-center justify-between gap-3">
                            <div className="flex flex-col">
                                <span className="font-bold">
                                    {result.count} stations found ·{" "}
                                    {summary.added} new
                                </span>
                                <span className="text-xs opacity-80">
                                    {summary.already} already in the list ·{" "}
                                    {summary.noCoords} without coordinates
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-success"
                                disabled={summary.added === 0}
                                onClick={() => onChange(summary.merged)}
                            >
                                Add {summary.added} to list
                            </button>
                        </div>
                    )}
                </div>
                <div className="col-span-full rounded-md bg-neutral-content p-2 max-h-28 overflow-y-auto flex flex-wrap gap-1 content-start">
                    {stationList.length === 0 ? (
                        <span className="opacity-70 text-sm">
                            No stations in the processing list
                        </span>
                    ) : (
                        stationList.map((code) => (
                            <StationCodeBadge
                                key={code}
                                code={code}
                                onRemove={removeCode}
                            />
                        ))
                    )}
                </div>
            </div>

            {showMapModal?.show && showMapModal.title === "stations-map" && (
                <StationListMapModal
                    api={api}
                    highlightedApiIds={listedApiIds}
                    setShowMapModal={setShowMapModal}
                    title="Processing Stations"
                />
            )}

            {showMapModal?.show && showMapModal.title === "map" && (
                <MapModal
                    setShowMapModal={setShowMapModal}
                    onSave={handleMapSave}
                    initialSelection={
                        mapMode === "marker"
                            ? location && { marker: { ...location, radiusKm } }
                            : polygon && { polygon }
                    }
                    markerType={mapMode}
                    title={
                        mapMode === "marker"
                            ? "Select location and radius"
                            : "Draw polygon"
                    }
                    showStations={true}
                />
            )}
        </div>
    );
};

export default ProcessingStationsPanel;

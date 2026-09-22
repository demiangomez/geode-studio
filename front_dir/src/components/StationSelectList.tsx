import { useDeferredValue, useMemo, useRef, useState } from "react";
import { List, type RowComponentProps } from "react-window";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import { CountryFlag, MenuButton } from "@componentsReact";

import { useClickOutside } from "@hooks";

import { StationData } from "@types";

const ROW_HEIGHT = 56;
// li py-2 (16) + boton con el padding de daisyUI (16) + text-lg (28) + divisor (2).
const MENU_ROW_HEIGHT = 62;

interface SearchableStation {
    station: StationData;
    apiId: number;
    label: string;
    haystack: string;
}

interface RowProps {
    items: SearchableStation[];
    selectedApiId: number | undefined;
    selectedApiIds: ReadonlySet<number> | undefined;
    onSelect: (station: StationData) => void;
    variant: "list" | "menu";
}

// react-window ya memoiza las filas contra `rowProps`; no hace falta React.memo.
const StationRow = ({
    ariaAttributes,
    index,
    style,
    items,
    selectedApiId,
    selectedApiIds,
    onSelect,
    variant,
}: RowComponentProps<RowProps>) => {
    const { station, apiId, label } = items[index];
    const selected = apiId === selectedApiId || !!selectedApiIds?.has(apiId);

    // El <li> dentro del <ul class="menu"> es lo que hace que daisyUI aplique
    // sus propios estilos de item (padding, rounded, hover, active) al boton:
    // el selector es `.menu :where(li:not(.menu-title) > *)`. Replicarlos a mano
    // se desincronizaria con la version de daisyUI.
    if (variant === "menu") {
        return (
            <li
                style={style}
                className="py-2 px-4 font-semibold text-lg w-full border-b-2 border-base-100"
                {...ariaAttributes}
            >
                <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(station)}
                    className={`w-full flex flex-wrap items-start justify-between text-left
                        ${selected ? "active" : ""}`}
                >
                    <span className="flex-1 mr-2 truncate">{label}</span>
                </button>
            </li>
        );
    }

    return (
        <div style={style} className="px-1 py-[2px]" {...ariaAttributes}>
            <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(station)}
                className={`btn btn-sm w-full normal-case [&.btn]:h-full [&.btn]:animate-none [&.btn]:flex-nowrap [&.btn]:justify-start [&.btn]:gap-3 [&.btn]:font-normal
                    ${selected ? "btn-neutral" : "btn-ghost bg-base-100"}`}
            >
                <CountryFlag
                    iso3={station.country_code}
                    className="w-[30px] h-[20px] shrink-0"
                />
                <span className="flex min-w-0 flex-col items-start text-left leading-tight">
                    <span className="font-bold">{label}</span>
                    <span className="max-w-full truncate text-xs opacity-70">
                        {station.station_name}
                    </span>
                </span>
            </button>
        </div>
    );
};

interface StationSelectListProps {
    stations: StationData[] | undefined;
    isLoading?: boolean;
    selectedApiId: number | undefined;
    selectedApiIds?: ReadonlySet<number>;
    onSelect: (station: StationData) => void;
    excludeApiId?: number;
    height?: number;
    collapsible?: boolean;
}

const StationSelectList = ({
    stations,
    isLoading,
    selectedApiId,
    selectedApiIds,
    onSelect,
    excludeApiId,
    height = 320,
    collapsible = false,
}: StationSelectListProps) => {
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);

    const [open, setOpen] = useState(false);
    const isOpen = !collapsible || open;

    const rootRef = useRef<HTMLDivElement>(null);
    useClickOutside(
        rootRef,
        () => setOpen(false),
        collapsible && open,
        "click",
    );

    const selectedLabel = useMemo(() => {
        if (selectedApiId === undefined) return "";
        const found = stations?.find((s) => s.api_id === selectedApiId);
        return found
            ? `${found.network_code?.toUpperCase()}.${found.station_code?.toUpperCase()}`
            : "";
    }, [stations, selectedApiId]);

    const toggle = () => {
        // Al reabrir sobre la seleccion, limpiar el termino para volver a ver
        // el catalogo entero en vez de la unica fila ya elegida.
        if (!open && search === selectedLabel) setSearch("");
        setOpen(!open);
    };

    const handleSelect = (station: StationData) => {
        onSelect(station);
        if (!collapsible) return;
        setSearch(
            `${station.network_code?.toUpperCase()}.${station.station_code?.toUpperCase()}`,
        );
        setOpen(false);
    };

    const searchableStations = useMemo<SearchableStation[]>(() => {
        if (!stations) return [];
        return stations.reduce<SearchableStation[]>((acc, station) => {
            const apiId = station.api_id;
            if (apiId === undefined || apiId === excludeApiId) return acc;

            const label = `${station.network_code?.toUpperCase() ?? ""}.${station.station_code?.toUpperCase() ?? ""}`;
            acc.push({
                station,
                apiId,
                label,
                haystack:
                    `${label} ${station.station_name ?? ""} ${station.country_code ?? ""}`.toLowerCase(),
            });
            return acc;
        }, []);
    }, [stations, excludeApiId]);

    const filteredStations = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();
        if (!term) return searchableStations;
        return searchableStations.filter((s) => s.haystack.includes(term));
    }, [searchableStations, deferredSearch]);

    const rowProps = useMemo<RowProps>(
        () => ({
            items: filteredStations,
            selectedApiId,
            selectedApiIds,
            onSelect: handleSelect,
            variant: collapsible ? "menu" : "list",
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            filteredStations,
            selectedApiId,
            selectedApiIds,
            onSelect,
            collapsible,
        ],
    );

    return (
        <div
            className={collapsible ? "w-full" : "flex flex-col gap-2"}
            ref={rootRef}
        >
            <label
                className={
                    collapsible
                        ? "w-full input input-bordered flex items-center gap-2"
                        : "input input-bordered input-sm flex items-center gap-2"
                }
                title="Stations"
            >
                {!collapsible && (
                    <MagnifyingGlassIcon className="size-4 opacity-60" />
                )}
                <input
                    type="text"
                    className="grow"
                    placeholder="Search station"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (collapsible) setOpen(true);
                    }}
                    autoComplete="off"
                />
                {collapsible && (
                    <MenuButton
                        typeKey="stations"
                        showMenu={
                            open ? { type: "stations", show: true } : undefined
                        }
                        setShowMenu={() => toggle()}
                    />
                )}
            </label>

            {isOpen && (
                <div
                    className={
                        collapsible
                            ? "mt-2 bg-neutral-content rounded-box overflow-hidden"
                            : "rounded-md border border-base-300 bg-base-200"
                    }
                    style={{ height }}
                >
                    {isLoading ? (
                        <div className="flex h-full w-full items-center justify-center gap-2">
                            <span className="loading loading-spinner loading-md" />
                            <span>Loading stations</span>
                        </div>
                    ) : filteredStations.length === 0 ? (
                        <div className="flex h-full w-full items-center justify-center opacity-70">
                            No stations found
                        </div>
                    ) : (
                        <List
                            tagName={collapsible ? "ul" : "div"}
                            className={collapsible ? "menu p-0" : undefined}
                            rowComponent={StationRow}
                            rowCount={filteredStations.length}
                            rowHeight={
                                collapsible ? MENU_ROW_HEIGHT : ROW_HEIGHT
                            }
                            rowProps={rowProps}
                            overscanCount={4}
                            style={{ height: "100%", width: "100%" }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default StationSelectList;

import { useDeferredValue, useMemo, useState } from "react";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Modal, Table } from "@componentsReact";

import { SourcesStationsData } from "@types";

interface SourcesStationsTableModalProps {
    handleCloseModal: () => void;
    sourcesStations: SourcesStationsData[] | undefined;
    loading: boolean;
    serverName?: string;
}

type FilterKey = "network_code" | "station_code";

const TITLES = ["network_code", "station_code", "try_order", "path", "format"];

const FILTERS: { key: FilterKey; label: string; placeholder: string }[] = [
    {
        key: "network_code",
        label: "NETWORK",
        placeholder: "Filter by network code",
    },
    {
        key: "station_code",
        label: "STATION",
        placeholder: "Filter by station code",
    },
];

const EMPTY_FILTERS: Record<FilterKey, string> = {
    network_code: "",
    station_code: "",
};

interface FilterInputProps {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}

const FilterInput = ({
    label,
    placeholder,
    value,
    onChange,
}: FilterInputProps) => (
    <label className="input input-bordered flex items-center gap-2 w-full">
        <div className="label">
            <span className="font-bold">{label}</span>
        </div>
        <MagnifyingGlassIcon className="size-4 opacity-60" />
        <input
            type="text"
            className="grow"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
        />
        {value && (
            <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                title="Clear"
                onClick={() => onChange("")}
            >
                <XMarkIcon className="size-4" />
            </button>
        )}
    </label>
);

const SourcesStationsTableModal = ({
    handleCloseModal,
    sourcesStations,
    loading,
    serverName,
}: SourcesStationsTableModalProps) => {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const deferredFilters = useDeferredValue(filters);

    const rows = useMemo(() => {
        const network = deferredFilters.network_code.trim().toLowerCase();
        const station = deferredFilters.station_code.trim().toLowerCase();
        return (sourcesStations ?? [])
            .filter(
                (s) =>
                    s.network_code.toLowerCase().includes(network) &&
                    s.station_code.toLowerCase().includes(station),
            )
            .map((s) => [
                s.network_code,
                s.station_code,
                String(s.try_order),
                s.path ?? "-",
                s.format,
            ]);
    }, [sourcesStations, deferredFilters]);

    const total = sourcesStations?.length ?? 0;

    return (
        <Modal
            modalId="Sources Stations"
            size="md"
            handleCloseModal={handleCloseModal}
            close={false}
        >
            <div className="flex flex-col gap-4 items-center">
                <div className="flex flex-col items-center">
                    <h2 className="text-2xl font-bold">Sources Stations</h2>
                    {serverName && (
                        <span className="text-sm text-gray-500">
                            {serverName}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                    {FILTERS.map(({ key, label, placeholder }) => (
                        <FilterInput
                            key={key}
                            label={label}
                            placeholder={placeholder}
                            value={filters[key]}
                            onChange={(value) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    [key]: value,
                                }))
                            }
                        />
                    ))}
                </div>
                <div className="w-full max-h-[50vh] overflow-y-auto">
                    {loading || rows.length > 0 ? (
                        <Table
                            table="sources"
                            titles={TITLES}
                            body={rows}
                            loading={loading}
                            dataOnly={true}
                            onClickFunction={() => {}}
                            deleteRegister={false}
                            dataFetchUrl="api/sources-stations"
                        />
                    ) : (
                        <div className="text-center text-neutral text-xl font-bold w-full rounded-md bg-neutral-content p-6">
                            {total === 0
                                ? "This server has no stations associated"
                                : "No stations match the current filters"}
                        </div>
                    )}
                </div>
                {!loading && total > 0 && (
                    <span className="text-sm text-gray-500 self-end">
                        Showing {rows.length} of {total} stations
                    </span>
                )}
            </div>
        </Modal>
    );
};

export default SourcesStationsTableModal;

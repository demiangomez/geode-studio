import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
} from "react";
import { CopyButton, Spinner, Toast } from "@componentsReact";

import { useAuth, useApi } from "@hooks";
import {
    ArrowDownTrayIcon,
    InformationCircleIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

import { formattedDates } from "@utils";
import { removeEarthquakesAffectedStationsCache } from "@services";

import {
    EarthquakeData,
    StationsAffectedServiceData,
    ErrorResponse,
} from "@types";

import { useMapStore } from "@store";

interface EarthQuakeScrollerProps {
    earthquakes: EarthquakeData[];
    earthquakeChosen: EarthquakeData | undefined;
    handleEarthquakeState: (
        earthquake: EarthquakeData,
        isMulti?: boolean,
    ) => void;
    handleEarthquakeClose: () => void;
    scrollerCondition: boolean;
    spinner: boolean;
    earthquakeAffectedStations: StationsAffectedServiceData | undefined;
}

const EarthQuakeScroller: React.FC<EarthQuakeScrollerProps> = ({
    earthquakes,
    earthquakeChosen,
    handleEarthquakeState,
    handleEarthquakeClose,
    spinner,
    scrollerCondition,
    earthquakeAffectedStations,
}) => {
    const forceSyncMapScroller = useMapStore((s) => s.forceSyncScrollerMap);
    const setToggleEarthquakeMask = useMapStore(
        (s) => s.setToggleEarthquakeMask,
    );
    const setToggleCoseismicVector = useMapStore(
        (s) => s.setToggleCoseismicVector,
    );
    const selectedEarthquakes = useMapStore((s) => s.selectedEarthquakes);
    const setSelectedEarthquakes = useMapStore((s) => s.setSelectedEarthquakes);
    const setChosenEarthquake = useMapStore((s) => s.setChosenEarthquake);
    const multiSelectMode = useMapStore((s) => s.multiSelectMode);
    const setMultiSelectMode = useMapStore((s) => s.setMultiSelectMode);
    const setTemporalFilter = useMapStore((s) => s.setTemporalFilter);

    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    //---------------------------------------------------------UseState-------------------------------------------------------------
    const [currentSort, setCurrentSort] = useState<string>("none");

    const [toast, setToast] = useState({
        visible: false,
        message: "",
        error: false,
    });

    const toastTimerRef = useRef<number | null>(null);

    //---------------------------------------------------------Funciones-------------------------------------------------------------

    const selectedIds = useMemo(
        () => new Set(selectedEarthquakes.map((eq) => eq.api_id)),
        [selectedEarthquakes],
    );

    const selectedMap = useMemo(
        () => new Map(selectedEarthquakes.map((eq) => [eq.api_id, eq])),
        [selectedEarthquakes],
    );

    const isStateTrue = useCallback(
        (earthquake: EarthquakeData) => {
            return selectedIds.has(earthquake.api_id);
        },
        [selectedIds],
    );

    const handleToggleChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        eq?: EarthquakeData,
    ) => {
        if (!eq) return;
        const isChecked = e.target.checked;

        const updatedList = selectedEarthquakes.map((item) =>
            item.api_id === eq.api_id
                ? { ...item, ui_toggle_mask: isChecked }
                : item,
        );
        setSelectedEarthquakes(updatedList);

        // If this is also the chosen one, sync it too
        if (earthquakeChosen?.api_id === eq.api_id) {
            setToggleEarthquakeMask(isChecked);
            setChosenEarthquake({
                ...earthquakeChosen,
                ui_toggle_mask: isChecked,
            });
        }
    };

    const handleToggleVector = (
        e: React.ChangeEvent<HTMLInputElement>,
        eq?: EarthquakeData,
    ) => {
        if (!eq) return;
        const isChecked = e.target.checked;

        const updatedList = selectedEarthquakes.map((item) =>
            item.api_id === eq.api_id
                ? { ...item, ui_toggle_vector: isChecked }
                : item,
        );
        setSelectedEarthquakes(updatedList);

        if (earthquakeChosen?.api_id === eq.api_id) {
            setToggleCoseismicVector(isChecked);
            setChosenEarthquake({
                ...earthquakeChosen,
                ui_toggle_vector: isChecked,
            });
        }
    };

    const downloadFile = (
        data: string | undefined,
        filename: string,
        fileType: "kml" | "csv",
    ) => {
        if (!data) {
            console.warn(`No data available for ${filename}`);
            return;
        }

        let dataUrl: string;

        if (fileType === "kml") {
            dataUrl = `data:application/octet-stream;base64,${data}`;
        } else {
            const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
            dataUrl = URL.createObjectURL(blob);
        }

        const downloadLink = document.createElement("a");
        downloadLink.href = dataUrl;
        downloadLink.download = filename;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        if (fileType === "csv") {
            URL.revokeObjectURL(dataUrl);
        }
    };

    const deleteCacheEarthquakes = async () => {
        try {
            const res =
                await removeEarthquakesAffectedStationsCache<ErrorResponse>(
                    api,
                );
            if (res?.statusCode === 201) {
                setToast({
                    visible: true,
                    message: "Earthquake cache cleared successfully.",
                    error: false,
                });
            }
        } catch (error) {
            setToast({
                visible: true,
                message: "Failed to clear earthquake cache.",
                error: true,
            });
        }
    };

    //---------------------------------------------------------UseCallback-------------------------------------------------------------
    const sortedList = useMemo(() => {
        if (!earthquakes) return [];

        const newSorted = [...earthquakes];

        if (currentSort === "date-") {
            newSorted.sort(
                (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
        } else if (currentSort === "date+") {
            newSorted.sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
        } else if (currentSort === "mag+") {
            newSorted.sort((a, b) => b.mag - a.mag);
        } else if (currentSort === "depth+") {
            newSorted.sort((a, b) => b.depth - a.depth);
        }

        return newSorted.sort((a, b) => {
            const aState = selectedIds.has(a.api_id);
            const bState = selectedIds.has(b.api_id);
            if (aState && !bState) return -1;
            if (!aState && bState) return 1;
            return 0;
        });
    }, [earthquakes, currentSort, selectedIds]);

    //---------------------------------------------------------UseEffect-------------------------------------------------------------

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("earthquakeChosen");
            const parsed = stored ? JSON.parse(stored) : null;
            if (
                parsed &&
                earthquakeChosen &&
                parsed.api_id === earthquakeChosen.api_id
            ) {
                const mask =
                    typeof parsed.ui_toggle_mask === "boolean"
                        ? parsed.ui_toggle_mask
                        : true;
                const vector =
                    typeof parsed.ui_toggle_vector === "boolean"
                        ? parsed.ui_toggle_vector
                        : false;

                // Sync the individual toggle in selectedEarthquakes if present
                setSelectedEarthquakes(
                    selectedEarthquakes.map((eq) =>
                        eq.api_id === earthquakeChosen.api_id
                            ? {
                                ...eq,
                                ui_toggle_mask: mask,
                                ui_toggle_vector: vector,
                            }
                            : eq,
                    ),
                );

                useMapStore.setState({
                    toggleStateEarthquakeMask: mask,
                    toggleCoseismicVector: vector,
                });
            } else {
                useMapStore.setState({
                    toggleStateEarthquakeMask: true,
                    toggleCoseismicVector: false,
                });
            }
        } catch (err) {
            console.error("Failed to restore earthquakeChosen toggles", err);
        }
    }, [earthquakeChosen]);

    return (
        <>
            {scrollerCondition ? (
                <div
                    id="controller"
                    className="z-[100002] max-h-[92vh] w-[20vw] scrollbar-thin overflow-y-auto  overflow-x-hidden absolute top-0 left-0"
                >
                    <div className="overflow-y-auto min-h-[92vh] max-h-full h-auto bg-white rounded-md border-t border-l border-b border-gray-400 overflow-x-hidden">
                        {spinner ? (
                            <div className="flex items-center justify-center min-h-[92vh] border-gray-400 border-r">
                                <Spinner size="lg" />
                            </div>
                        ) : (
                            <div className="flex justify-end mr-2">
                                <XMarkIcon
                                    className="size-6 cursor-pointer mt-2 mr-1 hover:bg-gray-200 hover:rounded-full hover:shadow-md"
                                    onClick={() => {
                                        handleEarthquakeClose();
                                    }}
                                />
                            </div>
                        )}
                        {!spinner && (
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-bold text-lg text-gray-800">
                                            Earthquakes
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            {earthquakes.length} results found
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <button
                                            onClick={deleteCacheEarthquakes}
                                            className="text-[10px] text-gray-400 hover:underline hover:text-red-500 transition-all uppercase tracking-wider font-bold"
                                        >
                                            Clear Cache
                                        </button>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="group relative">
                                                <InformationCircleIcon className="size-3 text-gray-400 cursor-help" />
                                                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-xl z-[100003]">
                                                    You can also use CTRL +
                                                    Click to select multiple
                                                    earthquakes.
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                Multi
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={multiSelectMode}
                                                onChange={() => {
                                                    const nextMode =
                                                        !multiSelectMode;
                                                    setMultiSelectMode(
                                                        nextMode,
                                                    );
                                                    if (
                                                        !nextMode &&
                                                        selectedEarthquakes.length >
                                                        1
                                                    ) {
                                                        const lastOne =
                                                            selectedEarthquakes[
                                                            selectedEarthquakes.length -
                                                            1
                                                            ];
                                                        setSelectedEarthquakes([
                                                            lastOne,
                                                        ]);
                                                    }
                                                }}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                style={{
                                                    borderRadius: "50px",
                                                }}
                                                className="toggle toggle-md"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <select
                                                value={currentSort}
                                                className="w-full text-xs border border-gray-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-[#ED8936] focus:border-[#ED8936] outline-none transition-all shadow-sm"
                                                onChange={(e) =>
                                                    setCurrentSort(
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="none">
                                                    Sort by...
                                                </option>
                                                <option value="date+">
                                                    Newest First
                                                </option>
                                                <option value="date-">
                                                    Oldest First
                                                </option>
                                                <option value="mag+">
                                                    Highest Magnitude
                                                </option>
                                                <option value="depth+">
                                                    Deepest
                                                </option>
                                            </select>
                                        </div>
                                    </div>

                                    {multiSelectMode && (
                                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <button
                                                onClick={() => {
                                                    setSelectedEarthquakes(
                                                        earthquakes.map(
                                                            (eq) => ({
                                                                ...eq,
                                                                ui_toggle_mask:
                                                                    true,
                                                            }),
                                                        ),
                                                    );
                                                    if (
                                                        earthquakes.length > 0
                                                    ) {
                                                        setChosenEarthquake(
                                                            earthquakes[0],
                                                        );
                                                        setToggleEarthquakeMask(
                                                            true,
                                                        );
                                                    }
                                                }}
                                                className="flex-1 text-[10px] font-bold uppercase tracking-tight bg-white border border-gray-200 py-1.5 px-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-gray-600"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedEarthquakes([]);
                                                    setChosenEarthquake(
                                                        undefined,
                                                    );
                                                    setToggleEarthquakeMask(
                                                        false,
                                                    );
                                                    setToggleCoseismicVector(
                                                        false,
                                                    );
                                                    setTemporalFilter({
                                                        enabled: false,
                                                        dateStart: null,
                                                        dateEnd: null,
                                                        hiddenPoints: false,
                                                        exactDate: false,
                                                    });
                                                }}
                                                className="flex-1 text-[10px] font-bold uppercase tracking-tight bg-white border border-gray-200 py-1.5 px-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-gray-600"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {toast.visible && (
                                    <Toast
                                        msg={toast.message}
                                        error={toast.error}
                                        duration={toast.error ? 3000 : 1500}
                                        onClose={() =>
                                            setToast({
                                                visible: false,
                                                message: "",
                                                error: false,
                                            })
                                        }
                                    />
                                )}
                            </div>
                        )}
                        {!spinner &&
                            sortedList.map((earthquake) => {
                                const isSelected = isStateTrue(earthquake);
                                const selectedEq = selectedMap.get(
                                    earthquake.api_id,
                                );

                                const itemToggle = isSelected
                                    ? (selectedEq?.ui_toggle_mask ?? true)
                                    : true;
                                const itemVector = isSelected
                                    ? (selectedEq?.ui_toggle_vector ?? false)
                                    : false;
                                const eqData =
                                    earthquakeAffectedStations
                                        ?.individual_data?.[
                                    earthquake.api_id.toString()
                                    ];
                                const disableDisplacements =
                                    eqData?.coseismic_displacements &&
                                    eqData?.coseismic_displacements.length ===
                                    0;

                                return (
                                    <div
                                        key={
                                            earthquake.api_id +
                                            forceSyncMapScroller
                                        }
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (e.ctrlKey || e.metaKey) {
                                                e.preventDefault();
                                            }

                                            handleEarthquakeState(
                                                earthquake,
                                                e.ctrlKey ||
                                                e.metaKey ||
                                                multiSelectMode,
                                            );
                                        }}
                                        className={
                                            isSelected
                                                ? "label cursor-pointer border border-gray-950 bg-slate-400 flex items-center justify-start flex-row p-2"
                                                : "label cursor-pointer border border-gray-400 flex items-center justify-start flex-row p-2"
                                        }
                                        id={earthquake.api_id.toString()}
                                    >
                                        <div className="flex items-start gap-4 m-2 mr-6 w-full">
                                            <div>
                                                {earthquake.mag.toFixed(1)}
                                            </div>
                                            <div className="flex flex-col w-full px-4">
                                                <span className="font-bold mr-2 break-words">
                                                    {earthquake.location}
                                                </span>
                                                <div>
                                                    <span className="mr-2 truncate">
                                                        {formattedDates(
                                                            earthquake.date,
                                                        )}
                                                    </span>
                                                    <span>
                                                        {earthquake.depth +
                                                            "km"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span>{earthquake.id}</span>
                                                </div>
                                                {isSelected ? (
                                                    <div className="mt-4">
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold">
                                                                    Masks
                                                                </span>
                                                                <input
                                                                    type="checkbox"
                                                                    className={`toggle`}
                                                                    style={{
                                                                        borderRadius:
                                                                            "50px",
                                                                    }}
                                                                    checked={
                                                                        itemToggle
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleToggleChange(
                                                                            e,
                                                                            earthquake,
                                                                        )
                                                                    }
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="text-xs text-gray-600 mb-2 text-right">
                                                                {itemToggle
                                                                    ? "Coseismic + Postseismic"
                                                                    : "Coseismic only"}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {itemToggle ? (
                                                                    <>
                                                                        <div className="flex flex-col items-center justify-center">
                                                                            <button
                                                                                className="btn btn-ghost btn-circle"
                                                                                title="Download Postseismic KML"
                                                                                onClick={(
                                                                                    e,
                                                                                ) => {
                                                                                    e.stopPropagation();
                                                                                    downloadFile(
                                                                                        eqData?.kml_including_postseismic,
                                                                                        `${earthquake.id}.kml`,
                                                                                        "kml",
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <ArrowDownTrayIcon className="size-6" />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <button
                                                                            className="btn btn-ghost btn-circle"
                                                                            title="Download Coseismic KML"
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                downloadFile(
                                                                                    eqData?.kml_without_postseismic,
                                                                                    `${earthquake.id}.kml`,
                                                                                    "kml",
                                                                                );
                                                                            }}
                                                                        >
                                                                            <ArrowDownTrayIcon className="size-6" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold">
                                                                    Stations
                                                                    Affected
                                                                </span>

                                                                <div className="flex items-center justify-end">
                                                                    <input
                                                                        disabled={
                                                                            disableDisplacements
                                                                        }
                                                                        type="checkbox"
                                                                        className={`toggle`}
                                                                        style={{
                                                                            borderRadius:
                                                                                "50px",
                                                                        }}
                                                                        checked={
                                                                            itemVector
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleToggleVector(
                                                                                e,
                                                                                earthquake,
                                                                            )
                                                                        }
                                                                        onClick={(
                                                                            e,
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="text-xs text-gray-600 mb-2 text-right">
                                                                Show
                                                                displacements
                                                            </div>

                                                            {/* Coseismic Section */}
                                                            {itemToggle ? (
                                                                <div className="mt-2">
                                                                    <div className="grid grid-cols-2 gap-4 justify-items-center">
                                                                        <button
                                                                            className="btn btn-ghost btn-circle"
                                                                            title="Download Coseismic + Postseismic CSV"
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                downloadFile(
                                                                                    eqData?.csv_including_postseismic,
                                                                                    `${earthquake.id}.csv`,
                                                                                    "csv",
                                                                                );
                                                                            }}
                                                                        >
                                                                            <ArrowDownTrayIcon className="size-6" />
                                                                        </button>
                                                                        < span className='mt-0 p-0 self-center' onClick={(e) => e.stopPropagation()}>
                                                                            <CopyButton
                                                                                text={eqData?.csv_including_postseismic ?? ""}
                                                                                iconClassName="size-6"
                                                                            />
                                                                        </span >
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                // Show only Coseismic if itemToggle is false
                                                                <div className="mt-2">
                                                                    <div className="grid grid-cols-2 gap-4 justify-items-center">
                                                                        <button
                                                                            className="btn btn-ghost btn-circle"
                                                                            title="Download Coseismic CSV"
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                downloadFile(
                                                                                    eqData?.csv_without_postseismic,
                                                                                    `${earthquake.id}.csv`,
                                                                                    "csv",
                                                                                );
                                                                            }}
                                                                        >
                                                                            <ArrowDownTrayIcon className="size-6" />
                                                                        </button>
                                                                        < span className='mt-0 p-0 self-center' onClick={(e) => e.stopPropagation()}>
                                                                            <CopyButton
                                                                                text={eqData?.csv_without_postseismic ?? ""}
                                                                                iconClassName="size-6"
                                                                            />
                                                                        </span >
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ) : null}
        </>
    );
};
export default EarthQuakeScroller;

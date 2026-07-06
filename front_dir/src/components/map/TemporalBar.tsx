import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import TemporalBarSkeleton from "@components/skeleton/TemporalBarSkeleton";

import {
    dateFromDay,
    dayFromDate,
    dateToFractionalYear,
    fractionalYearToDate,
    getTemporalBounds,
    formattedDates,
    clampDateRange,
} from "@utils";

import { StationData, TemporalFilterState } from "@types";
import { useMapStore } from "@store";
import {
    CalendarDateRangeIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "@heroicons/react/24/outline";

interface TemporalBarProps {
    stations: StationData[] | undefined;
    loading?: boolean;
}

const TimelineSlider = ({
    minYear,
    maxYear,
    valStart,
    valEnd,
    exactDate,
    onChangeStart,
    onChangeEnd,
    disabled = false,
}: any) => {
    const trackRef = useRef<HTMLDivElement>(null);

    const getValFromX = (x: number) => {
        if (!trackRef.current) return minYear;
        const rect = trackRef.current.getBoundingClientRect();
        let pct = (x - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct));
        return minYear + pct * (maxYear - minYear);
    };

    const handlePointerDown = (
        e: React.PointerEvent,
        type: "start" | "end",
    ) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget as HTMLDivElement;
        el.setPointerCapture(e.pointerId);

        const onPointerMove = (moveEvent: PointerEvent) => {
            const val = getValFromX(moveEvent.clientX);
            if (type === "start") {
                onChangeStart(exactDate ? val : Math.min(val, valEnd), false);
            } else {
                onChangeEnd(Math.max(val, valStart), false);
            }
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            el.releasePointerCapture(upEvent.pointerId);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("pointerup", onPointerUp);
            const val = getValFromX(upEvent.clientX);
            if (type === "start") {
                onChangeStart(exactDate ? val : Math.min(val, valEnd), true);
            } else {
                onChangeEnd(Math.max(val, valStart), true);
            }
        };

        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
    };

    const pctStart = ((valStart - minYear) / (maxYear - minYear)) * 100;
    const pctEnd = exactDate
        ? pctStart
        : ((valEnd - minYear) / (maxYear - minYear)) * 100;

    return (
        <div
            ref={trackRef}
            className={`relative w-full h-1.5 ${disabled ? "bg-gray-600/30" : "bg-[#4A5568]/50"} rounded-full my-4 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            onPointerDown={(e) => {
                if (disabled) return;
                const val = getValFromX(e.clientX);
                if (exactDate) {
                    onChangeStart(val, true);
                } else {
                    if (Math.abs(val - valStart) <= Math.abs(val - valEnd)) {
                        onChangeStart(Math.min(val, valEnd), true);
                    } else {
                        onChangeEnd(Math.max(val, valStart), true);
                    }
                }
            }}
        >
            <div
                className={`absolute h-full ${disabled ? "bg-gray-500/50" : "bg-[#ED8936]"} rounded-full pointer-events-none`}
                style={{
                    left: `${pctStart}%`,
                    width: exactDate ? 0 : `${pctEnd - pctStart}%`,
                }}
            />

            <div
                className={`absolute w-4 h-4 ${disabled ? "bg-gray-500" : "bg-[#ED8936]"} rounded-full -top-[5px] -ml-2 ${disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:scale-125"} transition-transform`}
                style={{ left: `${pctStart}%`, zIndex: 10 }}
                onPointerDown={(e) => handlePointerDown(e, "start")}
            >
                <div
                    className={`absolute -top-9 left-1/2 -translate-x-1/2 ${disabled ? "bg-gray-600" : "bg-[#ED8936]"} text-white text-[11px] font-medium px-2 py-1 rounded shadow-md whitespace-nowrap pointer-events-none select-none`}
                >
                    {fractionalYearToDate(valStart).toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric", timeZone: "UTC" },
                    )}
                    <div
                        className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 ${disabled ? "bg-gray-600" : "bg-[#ED8936]"} rotate-45`}
                    ></div>
                </div>
            </div>

            {!exactDate && (
                <div
                    className={`absolute w-4 h-4 ${disabled ? "bg-gray-500" : "bg-[#ED8936]"} rounded-full -top-[5px] -ml-2 ${disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing hover:scale-125"} transition-transform`}
                    style={{ left: `${pctEnd}%`, zIndex: 11 }}
                    onPointerDown={(e) => handlePointerDown(e, "end")}
                >
                    <div
                        className={`absolute -top-9 left-1/2 -translate-x-1/2 ${disabled ? "bg-gray-600" : "bg-[#ED8936]"} text-white text-[11px] font-medium px-2 py-1 rounded shadow-md whitespace-nowrap pointer-events-none select-none`}
                    >
                        {fractionalYearToDate(valEnd).toLocaleDateString(
                            "en-US",
                            {
                                month: "short",
                                year: "numeric",
                                timeZone: "UTC",
                            },
                        )}
                        <div
                            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 ${disabled ? "bg-gray-600" : "bg-[#ED8936]"} rotate-45`}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Formatea una fecha al string del input DOY "YYYY DDD" (día en 3 dígitos). El
// horario no se muestra: el usuario solo elige la fecha (ver dayBoundaryFy).
const formatDoyInput = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) return "";
    const [year, day] = (dayFromDate(date) ?? "").split(" ");
    if (!year) return "";
    return `${year} ${day.padStart(3, "0")}`;
};

// Año fraccional de un día con el horario de borde correspondiente: el fin de un
// rango usa 23:59:59 (incluye el día completo); el inicio de rango y el exact
// date usan 00:00:00. El horario es interno, no lo elige el usuario.
const dayBoundaryFy = (
    year: string | number,
    doy: string | number,
    isRangeEnd: boolean,
): number => {
    const date = dateFromDay(`${year} ${doy}${isRangeEnd ? " 23 59 59" : ""}`);
    return dateToFractionalYear(date);
};

const TemporalBar = ({ stations, loading = false }: TemporalBarProps) => {
    const temporalFilter = useMapStore((s) => s.temporalFilter);
    const setTemporalFilter = useMapStore((s) => s.setTemporalFilter);
    const selectedEarthquakes = useMapStore((s) => s.selectedEarthquakes);
    const isMultiEq = selectedEarthquakes.length > 1;

    const [doyMode, setDoyMode] = useState(false);
    const [doyInputStart, setDoyInputStart] = useState("");
    const [doyInputEnd, setDoyInputEnd] = useState("");

    const [sliderLocalStart, setSliderLocalStart] = useState<number | null>(
        null,
    );
    const [sliderLocalEnd, setSliderLocalEnd] = useState<number | null>(null);

    const [selectedDateStart, setSelectedDateStart] = useState<Date | null>(
        null,
    );
    const [selectedDateEnd, setSelectedDateEnd] = useState<Date | null>(null);

    const rangeRef = useRef<{ minYear: number; maxYear: number } | null>(null);

    const { minYear, maxYear } = useMemo(() => {
        let { minYear: currentMin, maxYear: currentMax } =
            getTemporalBounds(stations);

        if (
            temporalFilter.dateStart !== null &&
            temporalFilter.dateStart < currentMin
        ) {
            currentMin = temporalFilter.dateStart;
        }
        if (
            temporalFilter.dateEnd !== null &&
            temporalFilter.dateEnd > currentMax
        ) {
            currentMax = temporalFilter.dateEnd;
        }

        // Sincronizar el rango de años para mantener estable la escala del slider
        if (!rangeRef.current) {
            rangeRef.current = { minYear: currentMin, maxYear: currentMax };
        } else {
            rangeRef.current = {
                minYear: Math.min(rangeRef.current.minYear, currentMin),
                maxYear: Math.max(rangeRef.current.maxYear, currentMax),
            };
        }

        return rangeRef.current;
    }, [stations, temporalFilter.dateStart, temporalFilter.dateEnd]);

    const minDate = useMemo(() => fractionalYearToDate(minYear), [minYear]);
    const maxDate = useMemo(() => fractionalYearToDate(maxYear), [maxYear]);

    const sliderStart =
        sliderLocalStart !== null
            ? sliderLocalStart
            : (temporalFilter.dateStart ?? minYear);
    const sliderEnd =
        sliderLocalEnd !== null
            ? sliderLocalEnd
            : (temporalFilter.dateEnd ?? maxYear);

    // Sincronizar estados para evadir el "rebote" (state race condition)
    useEffect(() => {
        if (
            sliderLocalStart !== null &&
            temporalFilter.dateStart === sliderLocalStart
        ) {
            setSliderLocalStart(null);
        }
    }, [sliderLocalStart, temporalFilter.dateStart]);

    useEffect(() => {
        if (
            sliderLocalEnd !== null &&
            temporalFilter.dateEnd === sliderLocalEnd
        ) {
            setSliderLocalEnd(null);
        }
    }, [sliderLocalEnd, temporalFilter.dateEnd]);

    // Sincronizar estados locales con el filtro global (por si cambia desde fuera, ej: Earthquakes)
    useEffect(() => {
        if (temporalFilter.dateStart !== null) {
            const d = fractionalYearToDate(temporalFilter.dateStart);
            setSelectedDateStart(d);
            setDoyInputStart(formatDoyInput(d));
        } else {
            setSelectedDateStart(null);
            setDoyInputStart("");
        }

        if (temporalFilter.dateEnd !== null) {
            const d = fractionalYearToDate(temporalFilter.dateEnd);
            setSelectedDateEnd(d);
            setDoyInputEnd(formatDoyInput(d));
        } else {
            setSelectedDateEnd(null);
            setDoyInputEnd("");
        }

        // Reset local slider state to force sync with global filter
        setSliderLocalStart(null);
        setSliderLocalEnd(null);
    }, [temporalFilter.dateStart, temporalFilter.dateEnd]);

    // Exact date RINEX logic is now handled in Main.tsx via useStationRinexOnDate

    const updateFilter = useCallback(
        (patch: Partial<TemporalFilterState>) => {
            setTemporalFilter((prev) => ({ ...prev, ...patch }));
        },
        [setTemporalFilter],
    );

    const handleToggleEnabled = useCallback(() => {
        setTemporalFilter((prev) => {
            if (isMultiEq)
                return {
                    ...prev,
                    enabled: !prev.enabled,
                };

            const enabled = !prev.enabled;

            let newDateStart = prev.dateStart;
            let newDateEnd = prev.dateEnd;

            // Initialize on first open if they are null
            if (enabled && prev.dateStart === null && prev.dateEnd === null) {
                newDateStart = minYear;
                newDateEnd = maxYear;

                const ds = fractionalYearToDate(minYear);
                const de = fractionalYearToDate(maxYear);
                setSelectedDateStart(ds);
                setSelectedDateEnd(de);
                setDoyInputStart(formatDoyInput(ds));
                setDoyInputEnd(formatDoyInput(de));
            }

            return {
                ...prev,
                enabled,
                dateStart: newDateStart,
                dateEnd: newDateEnd,
            };
        });
    }, [setTemporalFilter, minYear, maxYear]);

    const handleReset = useCallback(() => {
        updateFilter({
            dateStart: null,
            dateEnd: null,
            exactDate: false,
            hiddenPoints: false,
        });
        setSliderLocalStart(null);
        setSliderLocalEnd(null);
        setSelectedDateStart(null);
        setSelectedDateEnd(null);
        setDoyInputStart("");
        setDoyInputEnd("");
    }, [updateFilter]);

    const handleSliderStartChange = useCallback(
        (val: number, isDragEnd: boolean = true) => {
            const { val: clampedVal } = clampDateRange(
                val,
                true,
                minYear,
                maxYear,
                temporalFilter.exactDate ? maxYear : sliderEnd,
            );

            const d = fractionalYearToDate(clampedVal);
            setSelectedDateStart(d);
            setDoyInputStart(formatDoyInput(d));
            setSliderLocalStart(clampedVal);

            if (isDragEnd) {
                updateFilter({ dateStart: clampedVal });
            }
        },
        [updateFilter, minYear, maxYear, temporalFilter.exactDate, sliderEnd],
    );

    const handleSliderEndChange = useCallback(
        (val: number, isDragEnd: boolean = true) => {
            const { val: clampedVal } = clampDateRange(
                val,
                false,
                minYear,
                maxYear,
                sliderStart,
            );

            const d = fractionalYearToDate(clampedVal);
            setSelectedDateEnd(d);
            setDoyInputEnd(formatDoyInput(d));
            setSliderLocalEnd(clampedVal);

            if (isDragEnd) {
                updateFilter({ dateEnd: clampedVal });
            }
        },
        [updateFilter, minYear, maxYear, sliderStart],
    );

    // Mientras se escribe solo guardamos el texto local: no tocamos el filtro
    // (ni el mapa) para no interrumpir al usuario. El filtro se aplica con Enter.
    const handleDoyChange = (value: string, isStart: boolean) => {
        if (isStart) setDoyInputStart(value);
        else setDoyInputEnd(value);
    };

    // Aplica el valor escrito en el input DOY (Enter o blur).
    const commitDoy = (isStart: boolean) => {
        const value = isStart ? doyInputStart : doyInputEnd;
        const parts = value.trim().split(/\s+/);
        // Necesitamos al menos año y día para parsear
        if (parts.length < 2) return;

        const year = parseInt(parts[0]);
        const doy = parseInt(parts[1]);
        if (isNaN(year) || year < 1000 || isNaN(doy) || doy < 1 || doy > 366)
            return;

        const isRangeEnd = !isStart && !temporalFilter.exactDate;
        const fyRaw = dayBoundaryFy(year, doy, isRangeEnd);

        // Clamping a los limites del timebar y entre start/end
        const { val: fy } = clampDateRange(
            fyRaw,
            isStart,
            minYear,
            maxYear,
            temporalFilter.exactDate
                ? isStart
                    ? maxYear
                    : minYear
                : isStart
                  ? sliderEnd
                  : sliderStart,
        );

        const finalDate = fractionalYearToDate(fy);
        if (isStart) {
            setSelectedDateStart(finalDate);
            setDoyInputStart(formatDoyInput(finalDate));
        } else {
            setSelectedDateEnd(finalDate);
            setDoyInputEnd(formatDoyInput(finalDate));
        }

        updateFilter(isStart ? { dateStart: fy } : { dateEnd: fy });
    };

    const handleDoyKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        isStart: boolean,
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitDoy(isStart);
            e.currentTarget.blur();
        }
    };

    const handleDatePickerChange = (date: Date | null, isStart: boolean) => {
        if (isStart) setSelectedDateStart(date);
        else setSelectedDateEnd(date);

        if (date) {
            const [py, pdoy] = (dayFromDate(date) ?? "").split(" ");
            const isRangeEnd = !isStart && !temporalFilter.exactDate;
            const fyRaw = dayBoundaryFy(py, pdoy, isRangeEnd);
            // Clamping a los limites del timebar y entre start/end
            const { val: fy } = clampDateRange(
                fyRaw,
                isStart,
                minYear,
                maxYear,
                temporalFilter.exactDate
                    ? isStart
                        ? maxYear
                        : minYear
                    : isStart
                      ? sliderEnd
                      : sliderStart,
            );

            const finalDate = fractionalYearToDate(fy);
            const doy = formatDoyInput(finalDate);

            if (isStart) {
                setSelectedDateStart(finalDate);
                setDoyInputStart(doy);
            } else {
                setSelectedDateEnd(finalDate);
                setDoyInputEnd(doy);
            }

            updateFilter(isStart ? { dateStart: fy } : { dateEnd: fy });
        } else {
            if (isStart) setDoyInputStart("");
            else setDoyInputEnd("");
            updateFilter(isStart ? { dateStart: null } : { dateEnd: null });
        }
    };

    if (loading && temporalFilter.enabled) {
        return <TemporalBarSkeleton />;
    }

    return (
        <div
            style={{
                position: "absolute",
                bottom: "32px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100002,
                background: "#2D3748",
                borderRadius: "12px",
                padding: temporalFilter.enabled
                    ? "16px 32px 24px"
                    : "12px 24px",
                width: temporalFilter.enabled ? "800px" : "auto",
                maxWidth: "95vw",
                boxShadow:
                    "0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                color: "#E2E8F0",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                animation:
                    "temporalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
        >
            <style>{`
                @keyframes temporalSlideUp {
                    from { transform: translateX(-50%) translateY(16px); opacity: 0; }
                    to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
                }
                .react-datepicker-wrapper { width: auto; }
                .react-datepicker__input-container button {
                    color: #E2E8F0;
                }
                .react-datepicker-popper {
                    z-index: 99999 !important;
                }
            `}</style>

            {!temporalFilter.enabled ? (
                <button
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${temporalFilter.dateStart !== null ? "text-[#ED8936]" : "text-gray-300"} cursor-default`}
                >
                    <div
                        className={`absolute -top-6 left-1/2 -translate-x-1/2 rounded-t-lg px-6 py-1 transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] bg-[#2D3748] cursor-pointer hover:bg-[#4A5568] text-gray-300`}
                        onClick={handleToggleEnabled}
                        title={"Open Temporal Filter"}
                    >
                        <ChevronUpIcon className="size-4" />
                    </div>
                    {temporalFilter.dateStart === null
                        ? "Temporal Filter"
                        : temporalFilter.exactDate
                          ? `${formattedDates(
                                fractionalYearToDate(temporalFilter.dateStart),
                                true,
                            )}`
                          : `${formattedDates(fractionalYearToDate(temporalFilter.dateStart), true)} - ${formattedDates(fractionalYearToDate(temporalFilter.dateEnd ?? maxYear), true)}`}
                </button>
            ) : (
                <>
                    <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2D3748] rounded-t-lg px-6 py-1 cursor-pointer hover:bg-[#4A5568] transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
                        onClick={handleToggleEnabled}
                        title="Close Temporal Filter"
                    >
                        <ChevronDownIcon className="text-white size-4" />
                    </div>

                    <div className="relative">
                        <TimelineSlider
                            minYear={minYear}
                            maxYear={maxYear}
                            valStart={sliderStart}
                            valEnd={sliderEnd}
                            exactDate={temporalFilter.exactDate}
                            onChangeStart={handleSliderStartChange}
                            onChangeEnd={handleSliderEndChange}
                            disabled={false}
                        />

                        <div className="flex justify-between text-[11px] font-medium text-gray-400 select-none">
                            <span>{Math.floor(minYear)}</span>
                            <span>{Math.floor(maxYear)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-2 select-none">
                        <div
                            className={`flex items-center bg-[#1A202C] hover:bg-white/5 cursor-pointer rounded-lg border border-[#4A5568]/30 px-3 py-1.5 text-[13px] transition-colors`}
                        >
                            {doyMode ? (
                                <input
                                    type="text"
                                    className="bg-transparent border-none focus:outline-none text-gray-300 w-[120px] disabled:cursor-not-allowed"
                                    placeholder="Start"
                                    value={doyInputStart}
                                    disabled={false}
                                    onChange={(e) =>
                                        handleDoyChange(e.target.value, true)
                                    }
                                    onKeyDown={(e) =>
                                        handleDoyKeyDown(e, true)
                                    }
                                    onBlur={() => commitDoy(true)}
                                />
                            ) : (
                                <DatePicker
                                    selected={selectedDateStart}
                                    onChange={(d: Date | null) =>
                                        handleDatePickerChange(d, true)
                                    }
                                    minDate={minDate}
                                    maxDate={maxDate}
                                    showYearDropdown
                                    scrollableYearDropdown
                                    yearDropdownItemNumber={100}
                                    showMonthDropdown
                                    disabled={false}
                                    customInput={
                                        <button
                                            disabled={false}
                                            className="flex items-center justify-between gap-2 text-gray-300 hover:text-white whitespace-nowrap w-[120px] disabled:cursor-not-allowed disabled:hover:text-gray-300"
                                        >
                                            <span>
                                                {selectedDateStart
                                                    ? formattedDates(
                                                          selectedDateStart,
                                                          true,
                                                      )
                                                    : temporalFilter.exactDate
                                                      ? "Exact Date"
                                                      : "Start Date"}
                                            </span>
                                            <CalendarDateRangeIcon className="size-3.5 flex-shrink-0" />
                                        </button>
                                    }
                                />
                            )}
                        </div>

                        {!temporalFilter.exactDate && (
                            <div
                                className={`flex items-center bg-[#1A202C] hover:bg-white/5 cursor-pointer rounded-lg border border-[#4A5568]/30 px-3 py-1.5 text-[13px] transition-colors`}
                            >
                                {doyMode ? (
                                    <input
                                        type="text"
                                        className="bg-transparent border-none focus:outline-none text-gray-300 w-[120px] disabled:cursor-not-allowed"
                                        placeholder="End"
                                        value={doyInputEnd}
                                        disabled={false}
                                        onChange={(e) =>
                                            handleDoyChange(
                                                e.target.value,
                                                false,
                                            )
                                        }
                                        onKeyDown={(e) =>
                                            handleDoyKeyDown(e, false)
                                        }
                                        onBlur={() => commitDoy(false)}
                                    />
                                ) : (
                                    <DatePicker
                                        selected={selectedDateEnd}
                                        onChange={(d: Date | null) =>
                                            handleDatePickerChange(d, false)
                                        }
                                        minDate={minDate}
                                        maxDate={maxDate}
                                        showYearDropdown
                                        scrollableYearDropdown
                                        yearDropdownItemNumber={100}
                                        showMonthDropdown
                                        disabled={false}
                                        customInput={
                                            <button
                                                disabled={false}
                                                className="flex items-center justify-between gap-2 text-gray-300 hover:text-white whitespace-nowrap w-[120px] disabled:cursor-not-allowed disabled:hover:text-gray-300"
                                            >
                                                <span>
                                                    {selectedDateEnd
                                                        ? formattedDates(
                                                              selectedDateEnd,
                                                              true,
                                                          )
                                                        : "End Date"}
                                                </span>
                                                <CalendarDateRangeIcon className="size-3.5 flex-shrink-0" />
                                            </button>
                                        }
                                    />
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-3 bg-[#1A202C] rounded-lg border border-[#4A5568]/30 px-4 py-1.5 text-[13px] text-gray-300">
                            <label
                                className={`flex items-center gap-2 cursor-pointer hover:text-white transition-colors`}
                                title={"Use DOY (Day of Year) format for dates"}
                            >
                                <input
                                    type="checkbox"
                                    className="accent-[#ED8936] cursor-pointer disabled:cursor-not-allowed"
                                    checked={doyMode}
                                    disabled={false}
                                    onChange={() => {
                                        setDoyMode((prev) => !prev);
                                        if (selectedDateStart)
                                            setDoyInputStart(
                                                formatDoyInput(
                                                    selectedDateStart,
                                                ),
                                            );
                                        if (selectedDateEnd)
                                            setDoyInputEnd(
                                                formatDoyInput(selectedDateEnd),
                                            );
                                    }}
                                />
                                DOY
                            </label>
                            <div className="w-[1px] h-3.5 bg-[#4A5568]/50"></div>
                            <label
                                className={`flex items-center gap-2 cursor-pointer hover:text-white transition-colors`}
                                title="Show stations with no data as grayed out"
                            >
                                <input
                                    type="checkbox"
                                    className="accent-[#ED8936] cursor-pointer"
                                    checked={temporalFilter.hiddenPoints}
                                    disabled={false}
                                    onChange={() =>
                                        updateFilter({
                                            hiddenPoints:
                                                !temporalFilter.hiddenPoints,
                                        })
                                    }
                                />
                                Hide
                            </label>
                            <div className="w-[1px] h-3.5 bg-[#4A5568]/50"></div>
                            <label
                                className={`flex items-center gap-2 cursor-pointer hover:text-white transition-colors`}
                                title={
                                    "Filter to exact date using RINEX observations"
                                }
                            >
                                <input
                                    type="checkbox"
                                    className="accent-[#ED8936] cursor-pointer disabled:cursor-not-allowed"
                                    checked={temporalFilter.exactDate}
                                    disabled={false}
                                    onChange={() => {
                                        const newExactDate =
                                            !temporalFilter.exactDate;
                                        const updates: Partial<
                                            typeof temporalFilter
                                        > = {
                                            exactDate: newExactDate,
                                        };

                                        // Sanitizar fechas si pasamos de "exactDate" a "rango" y quedaron invertidas
                                        if (
                                            !newExactDate &&
                                            temporalFilter.dateStart !== null &&
                                            temporalFilter.dateEnd !== null &&
                                            temporalFilter.dateStart >
                                                temporalFilter.dateEnd
                                        ) {
                                            updates.dateEnd =
                                                temporalFilter.dateStart;
                                        }

                                        updateFilter(updates);
                                    }}
                                />
                                Exact Date
                            </label>
                            <div className="w-[1px] h-3.5 bg-[#4A5568]/50"></div>
                            <button
                                onClick={handleReset}
                                disabled={false}
                                className={`transition-colors font-medium px-1 text-red-400 hover:text-red-300`}
                                title={"Reset timeline and disable filter"}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TemporalBar;

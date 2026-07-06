import {
    FilterState,
    GapData,
    StationData,
    TokenPayload,
    EarthquakeData,
    EarthQuakeFormState,
} from "@types";

export * from "./lazyRetry";
export * from "./coordinateConversion";

export const downloadFromBase64 = (
    base64: string,
    filename: string,
    mimeType = "application/octet-stream",
) => {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const modalSizes = {
    sm: "500px",
    smPlus: "45%",
    md: "60%",
    lg: "70%",
    xl: "80%",
    fit: "fit-content",
};

export const apiMethods = ["get", "post", "put", "patch", "delete"];

export const apiOkStatuses = [200, 201, 204];

export const apiErrorStatuses = [400, 401, 403, 404, 405, 406, 415, 500];

export const validateCatalogFields = (
    formState: Record<string, any>,
    catalogs: Record<string, string[]>,
): { code: string; attr: string; detail: string }[] =>
    Object.entries(catalogs).flatMap(([attr, codes]) => {
        const value = String(formState[attr] ?? "").trim();
        if (value === "" || codes.includes(value)) return [];
        return [
            { code: "invalid", attr, detail: "Select a value from the list" },
        ];
    });

export const findLimits = (coordinates: any) => {
    const longitudes = coordinates.map((coordinate: any) => coordinate[1]);

    const latitudes = coordinates.map((coordinate: any) => coordinate[0]);

    const max_longitude = Math.max(...longitudes);

    const min_longitude = Math.min(...longitudes);

    const max_latitude = Math.max(...latitudes);

    const min_latitude = Math.min(...latitudes);

    return {
        max_longitude,
        min_longitude,
        max_latitude,
        min_latitude,
    };
};

export const classHtml = (s: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(s ? s : "", "text/html");

    const emptyStrings = [
        "<p><span class='ql-cursor'>﻿</span>\t</p>",
        "<p><br></p>",
        "<p>\t</p>",
        "<p>﻿</p>",
        "<p></p>",
    ];

    if (emptyStrings.includes(doc.body.innerHTML)) {
        return "";
    }

    // Añadir clases a listas
    doc.querySelectorAll("ol, ul").forEach((list) => {
        if (list.tagName.toLowerCase() === "ol") {
            list.classList.add("list-decimal");
            list.classList.add("ps-[19.5px]");
            list.classList.add("pl-[19.5px]");
        } else if (list.tagName.toLowerCase() === "ul") {
            list.classList.add("list-disc");
            list.classList.add("ps-[19.5px]");
            list.classList.add("pl-[19.5px]");
        }
    });

    const updatedRichText = doc.body.innerHTML;

    return updatedRichText;
};

export const datesFormatOpt: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
};

export const datesFormatOptShort: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
};

export const getRandomColor = (index: number) => {
    const chosenColor = possibleColors[index];
    return chosenColor;
};

export const possibleColors = [
    "#d81f2a",
    "#ff9900",
    "#e0d86e",
    "#9ea900",
    "#6ec9e0",
    "#007ea3",
    "#9e4770",
    "#631d76",
];

export const formattedDates = (
    date: Date | string | undefined,
    short: boolean = false,
) => {
    if (!date) return;

    const formattedDate = new Intl.DateTimeFormat(
        "en-US",
        short ? datesFormatOptShort : datesFormatOpt,
    ).format(new Date(date));
    return formattedDate;
};

export const adjustToLocalTimezone = (dateString: string) => {
    const localDate = new Date(dateString);
    const timezoneOffset = localDate.getTimezoneOffset();
    const adjustedDate = new Date(localDate.getTime() + timezoneOffset * 60000);
    return adjustedDate;
};

export const isValidNumber = (num: string) => {
    if (num === "") return true;
    const regex = /^(0|[1-9]\d*)(\.\d+)?$/;
    return regex.test(num);
};

export const isValidDate = (dateString: string) => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

export const dateToUTC = (date: Date | string) => {
    const now = new Date(date);
    const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    return utc;
};

export const ensureEndsWithZ = (str: string): string => {
    return str.endsWith("Z") ? str : str + "Z";
};

export const woTz = (d: Date | undefined) => {
    if (d === undefined) {
        return;
    }

    const tz = d && d?.getTimezoneOffset() * 60000;

    const dateWoTz = d && tz && new Date(d?.getTime() - tz);

    return dateWoTz;
};

export const doyToDate = (doy: string) => {
    const [year, dayOfYear] = doy.split(".");

    const date = new Date(`${year}-01-01`);

    const leapYear =
        (Number(year) % 4 == 0 && Number(year) % 100 != 0) ||
        Number(year) % 400 == 0;

    date.setTime(
        date.getTime() +
            (leapYear
                ? (366 / 1000) * Number(dayOfYear)
                : (365 / 1000) * Number(dayOfYear)) *
                86400000,
    );

    return date;
};

export const dateFromDay = (day: string) => {
    const [year, dayOfYear = "001", hours = "0", minutes = "0", seconds = "0"] =
        day.split(" ");

    // Asegurarse de que el día del año tenga 3 dígitos
    const formattedDayOfYear = dayOfYear?.padStart(3, "0");
    // Asegurarse de que las horas, minutos y segundos tengan 2 dígitos
    const formattedHours = hours.padStart(2, "0");
    const formattedMinutes = minutes.padStart(2, "0");
    const formattedSeconds = seconds.padStart(2, "0");

    const formattedYear = year.padStart(4, "0");
    const date = new Date(
        `${formattedYear}-01-01T${formattedHours}:${formattedMinutes}:${formattedSeconds}Z`,
    );
    // Corrección: Sumar los días como milisegundos al 1 de enero del año dado
    date.setTime(date.getTime() + (Number(formattedDayOfYear) - 1) * 86400000);
    return date;
};

export const dayFromDate = (date: Date | string) => {
    if (date === null) {
        return null;
    }

    const dateObj = new Date(date);
    const startOfYear = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
    const diff = dateObj.getTime() - startOfYear.getTime();
    const oneDay = 86400000; // milisegundos en un día
    const dayOfYear = Math.floor(diff / oneDay) + 1; // +1 porque el día 1 del año es 1, no 0

    const year = isNaN(dateObj.getUTCFullYear())
        ? ""
        : dateObj.getUTCFullYear();
    const day = isNaN(dayOfYear) ? "" : dayOfYear;
    const hours = isNaN(dateObj.getUTCHours()) ? "" : dateObj.getUTCHours();
    const minutes = isNaN(dateObj.getUTCMinutes())
        ? ""
        : dateObj.getUTCMinutes();
    const seconds = isNaN(dateObj.getUTCSeconds())
        ? ""
        : dateObj.getUTCSeconds();

    return `${year} ${day} ${hours} ${minutes} ${seconds}`;
    // return `${
    //     isNaN(dateObj.getUTCFullYear())
    //         ? new Date().getUTCFullYear()
    //         : dateObj.getUTCFullYear()
    // } ${
    //     isNaN(dayOfYear)
    //         ? Math.floor(
    //               (now.getTime() -
    //                   new Date(
    //                       Date.UTC(now.getUTCFullYear(), 0, 1),
    //                   ).getTime()) /
    //                   86400000,
    //           ) + 1
    //         : dayOfYear
    // }`;
};

/**
 * Converts a JavaScript Date to a fractional year number.
 * e.g. 2021-01-01 → 2021.0, 2021-07-02 → ~2021.499
 * This matches the format used in StationData.date_start / date_end.
 */
export const dateToFractionalYear = (date: Date): number => {
    const year = date.getUTCFullYear();
    const startOfYear = Date.UTC(year, 0, 1);
    const startOfNextYear = Date.UTC(year + 1, 0, 1);
    const daysInYear = (startOfNextYear - startOfYear) / 86400000;
    const dayOfYear = (date.getTime() - startOfYear) / 86400000 + 1;
    return year + (dayOfYear - 1) / daysInYear;
};

/**
 * Clamps a fractional year value within global bounds and relative range bounds.
 * @param val The value to clamp (fractional year)
 * @param isStart Whether this is the start or end of the range
 * @param min Global minimum
 * @param max Global maximum
 * @param other Boundary from the other side of the range (start or end)
 */
export const clampDateRange = (
    val: number,
    isStart: boolean,
    min: number,
    max: number,
    other: number,
): { val: number; wasClamped: boolean } => {
    let clampedVal = val;
    let wasClamped = false;

    if (clampedVal < min) {
        clampedVal = min;
        wasClamped = true;
    }
    if (clampedVal > max) {
        clampedVal = max;
        wasClamped = true;
    }

    if (isStart && clampedVal > other) {
        clampedVal = other;
        wasClamped = true;
    } else if (!isStart && clampedVal < other) {
        clampedVal = other;
        wasClamped = true;
    }

    return { val: clampedVal, wasClamped };
};

/**
 * Converts a fractional year number back to a JavaScript Date.
 * e.g. 2021.5 → approx 2021-07-02
 */
export const fractionalYearToDate = (fy: number): Date => {
    const year = Math.floor(fy);
    const startOfYear = Date.UTC(year, 0, 1);
    const startOfNextYear = Date.UTC(year + 1, 0, 1);
    const daysInYear = (startOfNextYear - startOfYear) / 86400000;
    const dayOffset = (fy - year) * daysInYear;
    // Redondear al ms más cercano: new Date(float) trunca hacia cero y el error
    // de coma flotante del round-trip restaba hasta 1ms, bajando un segundo entero.
    return new Date(Math.round(startOfYear + dayOffset * 86400000));
};

export const getTemporalBounds = (stations: StationData[] | undefined) => {
    const nowFractional = dateToFractionalYear(new Date());
    let minYear = nowFractional - 20;
    let maxYear = nowFractional;

    if (stations && stations.length > 0) {
        const starts = stations
            .map((s) => s.date_start)
            .filter((d): d is number => !!d && d > 0);
        const ends = stations
            .map((s) => s.date_end)
            .filter((d): d is number => !!d && d > 0);
        const all = [...starts, ...ends];
        if (all.length > 0) {
            minYear = Math.min(...all);
            maxYear = Math.max(Math.max(...all), nowFractional);
        }
    }
    return { minYear, maxYear };
};

/**
 * Returns true if a station has data within the given temporal window.
 * Rules:
 *  - Basta con que alguna datestart o dateend esta dentro del rango de fechas para que aparezca
 *  */
export const isStationInTemporalWindow = (
    station: StationData,
    windowStart: number | null,
    windowEnd: number | null,
): boolean => {
    const sStart = station.date_start;
    const sEnd = station.date_end;

    if (windowStart !== null && windowEnd !== null) {
        return (
            sStart !== null &&
            sStart <= windowEnd &&
            sEnd !== null &&
            sEnd >= windowStart
        );
    } else if (windowEnd !== null) {
        return sStart !== null && sStart <= windowEnd;
    } else if (windowStart !== null) {
        return sEnd !== null && sEnd >= windowStart;
    }

    return true; // no window specified
};

export const isStationFiltered = (
    station: StationData | undefined,
    filterState: FilterState | undefined,
    filters:
        | {
              openFilters: boolean;
              stationType: boolean;
              stationWithProblems: boolean;
              stationWithoutProblems: boolean;
              stationStatus: boolean;
          }
        | undefined,
) => {
    if (station && filterState) {
        const hasProblems = station.has_gaps || !station.has_stationinfo;
        const withoutProblems = !station.has_gaps && station.has_stationinfo;

        // Si se selecciona station with problems y cumple
        if (filters?.stationWithProblems && hasProblems) {
            if (
                filterState.statusOption.length === 0 &&
                filterState.typeOption.length === 0
            ) {
                return true;
            }
            if (
                filterState.statusOption.length > 0 &&
                filterState.statusOption.includes(station.status)
            ) {
                if (filterState.typeOption.length === 0) {
                    return true;
                } else if (
                    filterState.typeOption &&
                    station.type !== null &&
                    filterState.typeOption.includes(station.type)
                ) {
                    return true;
                } else {
                    return false;
                }
            }
            if (
                filterState.typeOption &&
                station.type !== null &&
                filterState.typeOption.includes(station.type)
            ) {
                if (filterState.statusOption.length === 0) {
                    return true;
                } else if (
                    filterState.statusOption.length > 0 &&
                    filterState.statusOption.includes(station.status)
                ) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Si se selecciona station without problems y cumple
        if (filters?.stationWithoutProblems && withoutProblems) {
            if (
                filterState.statusOption.length === 0 &&
                filterState.typeOption.length === 0
            ) {
                return true;
            }
            if (
                filterState.statusOption.length > 0 &&
                filterState.statusOption.includes(station.status)
            ) {
                if (filterState.typeOption.length === 0) {
                    return true;
                } else if (
                    filterState.typeOption &&
                    station.type !== null &&
                    filterState.typeOption.includes(station.type)
                ) {
                    return true;
                } else {
                    return false;
                }
            }
            if (
                filterState.typeOption &&
                station.type !== null &&
                filterState.typeOption.includes(station.type)
            ) {
                if (filterState.statusOption.length === 0) {
                    return true;
                } else if (
                    filterState.statusOption.length > 0 &&
                    filterState.statusOption.includes(station.status)
                ) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Si no se selecciona station with problems ni station without problems
        if (!filters?.stationWithProblems && !filters?.stationWithoutProblems) {
            if (
                filterState.statusOption.length === 0 &&
                filterState.typeOption.length === 0
            ) {
                return true;
            }
            if (
                filterState.statusOption.length > 0 &&
                filterState.statusOption.includes(station.status)
            ) {
                if (filterState.typeOption.length === 0) {
                    return true;
                } else if (
                    filterState.typeOption &&
                    station.type !== null &&
                    filterState.typeOption.includes(station.type)
                ) {
                    return true;
                } else {
                    return false;
                }
            }
            if (
                filterState.typeOption &&
                station.type !== null &&
                filterState.typeOption.includes(station.type)
            ) {
                if (filterState.statusOption.length === 0) {
                    return true;
                } else if (
                    filterState.statusOption.length > 0 &&
                    filterState.statusOption.includes(station.status)
                ) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    } else {
        return false;
    }
};

export const handleEarthquakeLimits = (
    earthquake: EarthquakeData,
    formState: EarthQuakeFormState,
) => {
    const { max_lattitude, min_lattitude, max_longitude, min_longitude } = {
        max_lattitude: Number(formState.max_latitude),
        min_lattitude: Number(formState.min_latitude),
        max_longitude: Number(formState.max_longitude),
        min_longitude: Number(formState.min_longitude),
    };

    if (max_lattitude && min_lattitude && max_longitude && min_longitude) {
        return (
            earthquake.lat <= max_lattitude &&
            earthquake.lat >= min_lattitude &&
            earthquake.lon <= max_longitude &&
            earthquake.lon >= min_longitude
        );
    } else if (max_lattitude && min_lattitude && max_longitude) {
        return (
            earthquake.lat <= max_lattitude &&
            earthquake.lat >= min_lattitude &&
            earthquake.lon <= max_longitude
        );
    } else if (max_lattitude && min_lattitude && min_longitude) {
        return (
            earthquake.lat <= max_lattitude &&
            earthquake.lat >= min_lattitude &&
            earthquake.lon >= min_longitude
        );
    } else if (max_lattitude && max_longitude && min_longitude) {
        return (
            earthquake.lat <= max_lattitude &&
            earthquake.lon <= max_longitude &&
            earthquake.lon >= min_longitude
        );
    } else if (min_lattitude && max_longitude && min_longitude) {
        return (
            earthquake.lat >= min_lattitude &&
            earthquake.lon <= max_longitude &&
            earthquake.lon >= min_longitude
        );
    } else if (max_lattitude && min_lattitude) {
        return (
            earthquake.lat <= max_lattitude && earthquake.lat >= min_lattitude
        );
    } else if (max_longitude && min_longitude) {
        return (
            earthquake.lon <= max_longitude && earthquake.lon >= min_longitude
        );
    } else if (max_lattitude && max_longitude) {
        return (
            earthquake.lat <= max_lattitude && earthquake.lon <= max_longitude
        );
    } else if (max_lattitude && min_longitude) {
        return (
            earthquake.lat <= max_lattitude && earthquake.lon >= min_longitude
        );
    } else if (min_lattitude && max_longitude) {
        return (
            earthquake.lat >= min_lattitude && earthquake.lon <= max_longitude
        );
    } else if (min_lattitude && min_longitude) {
        return (
            earthquake.lat >= min_lattitude && earthquake.lon >= min_longitude
        );
    } else if (max_lattitude) {
        return earthquake.lat <= max_lattitude;
    } else if (min_lattitude) {
        return earthquake.lat >= min_lattitude;
    } else if (max_longitude) {
        return earthquake.lon <= max_longitude;
    } else if (min_longitude) {
        return earthquake.lon >= min_longitude;
    }
    return false;
};

export const generateErrorMessages = (station: StationData) => {
    const errorMessages: string[] = [];

    if (!station.has_stationinfo) {
        errorMessages.push("Station has no station information records!");
    }

    if (station.gaps && station.gaps.length !== 0) {
        station?.gaps?.forEach((gap: GapData) => {
            const {
                record_start_date_start,
                record_end_date_end,
                record_end_date_start,
                record_start_date_end,
                rinex_count,
            } = gap;

            if (record_start_date_start && record_end_date_end) {
                errorMessages.push(
                    `At least ${rinex_count} RINEX file(s) outside of station info record ending at ${formattedDates(new Date(record_end_date_end))} and next record starting at ${formattedDates(new Date(record_start_date_start))}`,
                );
            } else if (
                record_start_date_start &&
                !record_end_date_end &&
                !record_end_date_start
            ) {
                errorMessages.push(
                    `At least ${rinex_count} RINEX file(s) outside of station info record starting at ${formattedDates(new Date(record_start_date_start))}`,
                );
            } else if (
                record_end_date_end &&
                !record_start_date_end &&
                !record_start_date_start
            ) {
                errorMessages.push(
                    `At least ${rinex_count} RINEX file(s) outside of station info record ending at ${formattedDates(new Date(record_end_date_end))}`,
                );
            }
        });
    }

    return errorMessages;
};

export const hasDifferences = (one: object, second: object) => {
    return JSON.stringify(one) !== JSON.stringify(second);
};

export const transformParams = (params: any) => {
    return Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
};

export const transformParamsForFilter = (params: any) => {
    return Object.entries(params)
        .map(([key, value]) => (value !== undefined ? `${key}=${value}` : null))
        .filter((el: any) => el !== null)
        .join("&");
};

export const jwtDeserializer = (token: string) => {
    if (token) {
        const tokenPayload = JSON.parse(
            atob(token.split(".")[1]),
        ) as TokenPayload;
        return tokenPayload;
    }
};

export const showModal = (title: string) => {
    const modal = document.getElementById(title + "-modal") as HTMLFormElement;
    if (modal) {
        modal.showModal();
    }
};

export const decimalToDMS = (coordinate: number, isLatitude: boolean) => {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;

    const direction = isLatitude
        ? coordinate >= 0
            ? "N"
            : "S"
        : coordinate >= 0
          ? "E"
          : "W";

    return `${degrees}°${minutes}'${seconds.toFixed(4)}"${direction}`;
};

export const formatValue = (
    val: string | boolean | number,
    subString = true,
): string => {
    const isDateFunc = (val: any) => {
        const isoDateRegex =
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
        return typeof val === "string" && isoDateRegex.test(val);
    };

    const isDate = isDateFunc(val) && val !== "";

    if (isDate) {
        return formattedDates(woTz(new Date(val as string)) as Date) ?? "";
    } else if (typeof val === "boolean") {
        return val ? "✔" : "✘";
    } else if (typeof val === "string" && val.length > 0) {
        return val.length > 15 && subString
            ? val.substring(0, 15) + "..."
            : val;
    } else if (typeof val === "number") {
        return val.toString();
    } else {
        return "-";
    }
};

export const rinexMockup = {
    data: [
        {
            related_station_info: [
                {
                    date_start: "2024-01-01",
                    date_end: "2024-01-02",
                },
                {
                    date_start: "2024-01-03",
                    date_end: "2024-01-04",
                },
            ],
            rinex: [
                {
                    related_station_info: [
                        {
                            date_start: "2024-01-01",
                            date_end: "2024-01-02",
                        },
                    ],
                    rinex: [
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            has_multiple_station_info_gap: false,
                            metadata_mismatch: false,
                            gap_type: null,
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.9,
                        },
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            has_multiple_station_info_gap: false,
                            metadata_mismatch: false,
                            gap_type: "AFTER LAST STATIONINFO",
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.81,
                        },
                    ],
                },
            ],
        },
        {
            related_station_info: [
                // STATIONS INFOS QUE ABARCA EL PRIMER GRUPO
                {
                    date_start: "2024-01-01",
                    date_end: "2024-01-02",
                },
                {
                    date_start: "2024-01-03",
                    date_end: "2024-01-04",
                },
            ],
            rinex: [
                {
                    // C/OBJETO CORRESPONDE AL SEGUNDO GRUPO, PUEDE TENR MAS DE UN RINEX ASOCIADO AL STATION INFO
                    related_station_info: [
                        {
                            date_start: "2024-01-01",
                            date_end: "2024-01-02",
                        },
                    ],
                    rinex: [
                        {
                            network_code: "sag",
                            station_code: "ceca",

                            has_station_info: true,
                            metadata_mismatch: false,
                            has_multiple_station_info_gap: false,
                            gap_type: null,

                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.7,
                        },
                        {
                            network_code: "sag",
                            station_code: "ceca",

                            has_station_info: false,
                            metadata_mismatch: false,
                            has_multiple_station_info_gap: false,
                            gap_type: "AFTER LAST STATIONINFO",

                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.86,
                        },
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            metadata_mismatch: false,
                            has_multiple_station_info_gap: false,
                            gap_type: "BEFORE FIRST STATIONINFO",
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.1,
                        },
                    ],
                },
                {
                    related_station_info: [
                        {
                            date_start: "2024-01-01",
                            date_end: "2024-01-02",
                        },
                    ],
                    rinex: [
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            has_multiple_station_info_gap: false,
                            metadata_mismatch: false,
                            gap_type: null,
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.7,
                        },
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            has_multiple_station_info_gap: false,
                            metadata_mismatch: false,
                            gap_type: "BEFORE FIRST STATIONINFO",
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.5,
                        },
                    ],
                },
            ],
        },
        {
            related_station_info: [
                {
                    date_start: "2024-01-01",
                    date_end: "2024-01-02",
                },
                {
                    date_start: "2024-01-03",
                    date_end: "2024-01-04",
                },
            ],
            rinex: [
                {
                    related_station_info: [
                        {
                            date_start: "2024-01-01",
                            date_end: "2024-01-02",
                        },
                    ],
                    rinex: [
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: true,
                            has_multiple_station_info_gap: true,
                            metadata_mismatch: false,
                            gap_type: null,
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.3,
                        },
                    ],
                },
            ],
        },
        {
            related_station_info: [
                {
                    date_start: "2024-01-01",
                    date_end: "2024-01-02",
                },
                {
                    date_start: "2024-01-03",
                    date_end: "2024-01-04",
                },
            ],
            rinex: [
                {
                    related_station_info: [
                        {
                            date_start: "2024-01-01",
                            date_end: "2024-01-02",
                        },
                    ],
                    rinex: [
                        {
                            network_code: "sag",
                            station_code: "ceca",
                            has_station_info: false,
                            has_multiple_station_info_gap: false,
                            metadata_mismatch: false,
                            gap_type: "AFTER LAST STATIONINFO",
                            year: null,
                            doy: null,
                            timestamp_start: null,
                            timestamp_end: null,
                            receiver: null,
                            rx_sn: null,
                            rx_firm: null,
                            antenna: null,
                            ant_sn: null,
                            dome: null,
                            offset: null,
                            int: null,
                            comp: 0.4,
                        },
                    ],
                },
            ],
        },
    ],
};

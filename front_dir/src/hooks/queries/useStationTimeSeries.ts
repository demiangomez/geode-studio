import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { useMemo } from "react";

import { getStackNamesService, getStationTimeSeriesService } from "@services";
import { ErrorResponse, StationTimeSeriesServiceData } from "@types";
import { unwrapApiResponse } from "@utils";

const TS_PLOT_KEYS = [
    "solution",
    "stack",
    "residuals",
    "missing_data",
    "plot_outliers",
    "plot_auto_jumps",
    "no_model",
    "remove_jumps",
    "remove_polynomial",
    "remove_periodic",
    "remove_stochastic",
    "date_start",
    "date_end",
];

const TS_ADJUSTMENT_KEYS: Record<string, string> = {
    least_squares_strategy: "adjustment_model",
    covariance_model: "covariance_function",
    default_relaxations: "relaxation",
};

const isEmpty = (v: any) =>
    v === "" ||
    v === undefined ||
    v === null ||
    (Array.isArray(v) && v.length === 0);

const toBackendDate = (v: any) =>
    typeof v === "string" ? v.replace(/-/g, "/") : v;

export const buildTimeSeriesParams = (
    params: Record<string, any>,
): Record<string, any> => {
    const out: Record<string, any> = {};

    for (const key of TS_PLOT_KEYS) {
        const value = params[key];
        if (isEmpty(value)) continue;
        out[key] = key.includes("date") ? toBackendDate(value) : value;
    }

    // Bajo ROBUST_LEAST_SQUARES la covarianza no aplica (la UI la deshabilita),
    // así que no se manda.
    const isRobust = params.least_squares_strategy === "ROBUST_LEAST_SQUARES";
    for (const [formKey, apiKey] of Object.entries(TS_ADJUSTMENT_KEYS)) {
        if (formKey === "covariance_model" && isRobust) continue;
        const value = params[formKey];
        if (isEmpty(value)) continue;
        out[apiKey] = value;
    }

    // fit_window_start/fit_window_end: o van los dos o ninguno (mandar uno solo
    // devuelve 400).
    const fitStart = params.fit_window_start;
    const fitEnd = params.fit_window_end;
    if (!isEmpty(fitStart) && !isEmpty(fitEnd)) {
        out.fit_window_start = toBackendDate(fitStart);
        out.fit_window_end = toBackendDate(fitEnd);
    }

    return out;
};

export const useStackNames = (api: AxiosInstance, stationId: number) => {
    const query = useQuery({
        queryKey: ["stackNames", stationId],
        queryFn: async () =>
            unwrapApiResponse(
                await getStackNamesService<
                    | { stack_names: string[]; statusCode: number }
                    | ErrorResponse
                >(api, stationId),
            ),
        enabled: !!stationId,
        staleTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    return { ...query, stacks: query.data?.stack_names };
};

export const useStationTimeSeries = (
    api: AxiosInstance,
    stationId: number,
    params: Record<string, any>,
    options: { enabled?: boolean } = {},
) => {
    const cleaned = useMemo(() => buildTimeSeriesParams(params), [params]);

    return useQuery({
        queryKey: ["stationTimeSeries", stationId, cleaned],
        queryFn: async () =>
            unwrapApiResponse(
                await getStationTimeSeriesService<
                    StationTimeSeriesServiceData | ErrorResponse
                >(api, stationId, cleaned, false),
            ),
        enabled: (options.enabled ?? true) && !!stationId,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
};

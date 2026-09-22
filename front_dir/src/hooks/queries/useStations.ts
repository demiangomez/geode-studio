import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import {
    getStationsService,
    getStationsWithRinexOnDate,
    getStationReportService,
} from "@services";
import { ErrorResponse, GetParams, StationServiceData } from "@types";
import { unwrapApiResponse } from "@utils";

export const useStations = (
    api: AxiosInstance,
    params: GetParams,
    options: { enabled?: boolean; staleTime?: number; gcTime?: number } = {},
) => {
    return useQuery({
        queryKey: ["stations", params],
        queryFn: async ({ signal }) =>
            unwrapApiResponse(
                await getStationsService<StationServiceData | ErrorResponse>(
                    api,
                    params,
                    { signal },
                ),
            ),
        staleTime: 1 * 60 * 1000, // 1 minute
        ...options,
    });
};

// Catalogo completo para los selectores de estacion. Params fijos y cache larga:
// una sola entrada compartida por todos los pickers, en vez de una por modal.
// Cuando exista el endpoint liviano, este es el unico lugar a cambiar.
const STATION_CATALOG_PARAMS: GetParams = {
    limit: 0,
    offset: 0,
    only_metadata: true,
};

export const useStationCatalog = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) =>
    useStations(api, STATION_CATALOG_PARAMS, {
        staleTime: 10 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        ...options,
    });

export const useStationRinexOnDate = (
    api: AxiosInstance,
    from_date: string | null,
    to_date: string | null,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["stationsRinexOnDate", from_date, to_date],
        queryFn: async ({ signal }) => {
            const res = unwrapApiResponse(
                await getStationsWithRinexOnDate<
                    | { station_api_ids: number[]; statusCode: number }
                    | ErrorResponse
                >(api, from_date!, to_date!, signal),
            );
            return res.station_api_ids;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
        // despues del spread: options.enabled no puede pisar el guard de fechas
        enabled: !!from_date && !!to_date && (options.enabled ?? true),
    });
};

export const useStationPdf = (api: AxiosInstance) => {
    return useMutation({
        mutationFn: async (stationApiId: string) => {
            const res = await getStationReportService<
                { html: string; statusCode: number } | ErrorResponse
            >(api, stationApiId);
            if (res.statusCode !== 200) {
                const err = res as ErrorResponse;
                throw new Error(
                    err.response?.errors?.[0]?.detail ??
                        err.msg ??
                        "Error fetching station report",
                );
            }
            return res as { html: string; statusCode: number };
        },
    });
};

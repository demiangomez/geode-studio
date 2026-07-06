import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { getStationsService, getStationsWithRinexOnDate, getStationReportService } from "@services";
import { ErrorResponse, GetParams, StationServiceData } from "@types";

export const useStations = (
    api: AxiosInstance,
    params: GetParams,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["stations", params],
        queryFn: ({ signal }) =>
            getStationsService<StationServiceData>(api, params, { signal }),
        staleTime: 1 * 60 * 1000, // 1 minute
        ...options,
    });
};

export const useStationRinexOnDate = (
    api: AxiosInstance,
    from_date: string | null,
    to_date: string | null,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["stationsRinexOnDate", from_date, to_date],
        queryFn: async ({ signal }) => {
            const res = await getStationsWithRinexOnDate<{
                station_api_ids: number[];
            }>(api, from_date!, to_date!, signal);
            return res.station_api_ids;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: !!from_date && !!to_date && (options.enabled ?? true),
        ...options,
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

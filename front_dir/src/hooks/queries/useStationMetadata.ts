import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    getMonumentsTypesByIdService,
    getRinexService,
    getStationInfoService,
    getStationMetaService,
    getStationsFilesAttachedService,
    getStationsService,
    patchStationMetaService,
    patchStationService,
} from "@services";
import { ApiError, unwrapApiResponse } from "@utils";
import {
    ErrorResponse,
    ExtendedStationData,
    MonumentTypes,
    RinexData,
    RinexServiceData,
    StationData,
    StationFilesData,
    StationFilesServiceData,
    StationInfoServiceData,
    StationMetadataServiceData,
    StationServiceData,
} from "@types";

// Reads que alimentan StationMetadataModal, con manejo de error explicito
// (useApi resuelve en vez de rechazar; ver services/CLAUDE.md).

interface StationIdentityParams {
    network_code?: string;
    station_code?: string;
}

interface QueryOptions {
    enabled?: boolean;
}

export const useStation = (
    api: AxiosInstance,
    params: StationIdentityParams,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: ["station", params.network_code, params.station_code],
        queryFn: async ({ signal }) => {
            const res = unwrapApiResponse(
                await getStationsService<StationServiceData | ErrorResponse>(
                    api,
                    {
                        network_code: params.network_code,
                        station_code: params.station_code,
                        limit: 1,
                        offset: 0,
                    },
                    { signal },
                ),
            );
            return res.data[0] as StationData | undefined;
        },
        staleTime: 60 * 1000,
        ...options,
        enabled:
            !!params.network_code &&
            !!params.station_code &&
            (options.enabled ?? true),
    });
};

export const useStationMeta = (
    api: AxiosInstance,
    stationApiId: number | undefined,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: ["stationMeta", stationApiId],
        queryFn: async ({ signal }) =>
            unwrapApiResponse(
                await getStationMetaService<
                    StationMetadataServiceData | ErrorResponse
                >(api, stationApiId as number, signal),
            ),
        staleTime: 60 * 1000,
        ...options,
        enabled: !!stationApiId && (options.enabled ?? true),
    });
};

export const useStationRinexBounds = (
    api: AxiosInstance,
    params: StationIdentityParams,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: [
            "stationRinexBounds",
            params.network_code,
            params.station_code,
        ],
        queryFn: async () => {
            const firstRes = unwrapApiResponse(
                await getRinexService<RinexServiceData | ErrorResponse>(api, {
                    network_code: params.network_code,
                    station_code: params.station_code,
                    limit: 1,
                    offset: 0,
                }),
            );
            if (firstRes.total_count === 0) {
                return {
                    firstRinex: undefined as RinexData | undefined,
                    lastRinex: undefined as RinexData | undefined,
                };
            }

            const lastRes = unwrapApiResponse(
                await getRinexService<RinexServiceData | ErrorResponse>(api, {
                    network_code: params.network_code,
                    station_code: params.station_code,
                    limit: 1,
                    offset: firstRes.total_count - 1,
                }),
            );

            return {
                firstRinex: firstRes.data[0] as RinexData | undefined,
                lastRinex: lastRes.data[0] as RinexData | undefined,
            };
        },
        ...options,
        enabled:
            !!params.network_code &&
            !!params.station_code &&
            (options.enabled ?? true),
    });
};

export const useStationInfoLast = (
    api: AxiosInstance,
    params: StationIdentityParams,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: ["stationInfoLast", params.network_code, params.station_code],
        queryFn: async () => {
            const res = unwrapApiResponse(
                await getStationInfoService<
                    StationInfoServiceData | ErrorResponse
                >(api, {
                    network_code: params.network_code ?? "",
                    station_code: params.station_code ?? "",
                    offset: 0,
                    limit: 0,
                }),
            );
            // TanStack no permite `undefined`; sin registros, null
            return res.data[res.data.length - 1] ?? null;
        },
        ...options,
        enabled:
            !!params.network_code &&
            !!params.station_code &&
            (options.enabled ?? true),
    });
};

export const useStationFiles = (
    api: AxiosInstance,
    stationApiId: string | undefined,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: ["stationFiles", stationApiId],
        queryFn: async () => {
            const res = unwrapApiResponse(
                await getStationsFilesAttachedService<
                    StationFilesServiceData | ErrorResponse
                >(api, {
                    station_api_id: stationApiId,
                    offset: 0,
                    limit: 0,
                    only_metadata: true,
                }),
            );
            return res.data as StationFilesData[];
        },
        ...options,
        enabled: !!stationApiId && (options.enabled ?? true),
    });
};

export const useMonumentPhoto = (
    api: AxiosInstance,
    monumentTypeId: number | undefined,
    options: QueryOptions = {},
) => {
    return useQuery({
        queryKey: ["monumentPhoto", monumentTypeId],
        queryFn: async () => {
            const res = unwrapApiResponse(
                await getMonumentsTypesByIdService<
                    MonumentTypes | ErrorResponse
                >(api, monumentTypeId as number),
            );
            return res.photo_file;
        },
        ...options,
        enabled: !!monumentTypeId && (options.enabled ?? true),
    });
};

interface PatchVars {
    id: number;
    data: Record<string, unknown>;
}

// "status" existe en ambos lados de la union (StationMetadataServiceData
// tiene el suyo propio); "msg" solo esta en ErrorResponse.
export const useUpdateStationMeta = (api: AxiosInstance) => {
    return useMutation({
        mutationFn: async ({ id, data }: PatchVars) => {
            const res = await patchStationMetaService<
                StationMetadataServiceData | ErrorResponse
            >(api, id, data);
            if ("msg" in res) {
                throw new ApiError(res);
            }
            return res;
        },
    });
};

export const useUpdateStation = (api: AxiosInstance) => {
    return useMutation({
        mutationFn: async ({ id, data }: PatchVars) => {
            const res = await patchStationService<
                ExtendedStationData | ErrorResponse
            >(api, id, data);
            if ("msg" in res) {
                throw new ApiError(res);
            }
            return res;
        },
    });
};

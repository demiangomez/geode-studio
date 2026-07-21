import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    getAntennasService,
    getHeightCodesService,
    getRadomesService,
    getReceiversService,
} from "@services";
import {
    AntennaServiceData,
    ErrorResponse,
    GamitHTCServiceData,
    RadomesServiceData,
    ReceiversServiceData,
} from "@types";

const staticOptions = {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
};

// el interceptor de useApi nunca rechaza: hay que chequear statusCode y tirar acá
function check<T extends { statusCode: number }>(res: T | ErrorResponse): T {
    if (res.statusCode !== 200) {
        const err = res as ErrorResponse;
        throw new Error(
            err.response?.errors?.[0]?.detail ?? err.msg ?? "Request failed",
        );
    }
    return res as T;
}

export const useReceivers = (api: AxiosInstance) => {
    return useQuery({
        queryKey: ["receivers"],
        queryFn: async () => {
            const res = check(
                await getReceiversService<ReceiversServiceData>(api),
            );
            return res.data;
        },
        ...staticOptions,
    });
};

export const useAntennas = (api: AxiosInstance) => {
    return useQuery({
        queryKey: ["antennaCodes"],
        queryFn: async () => {
            const res = check(
                await getAntennasService<AntennaServiceData>(api),
            );
            return res.data;
        },
        ...staticOptions,
    });
};

export const useRadomes = (api: AxiosInstance, antennaCode: string) => {
    return useQuery({
        queryKey: ["radomeCodes", antennaCode],
        queryFn: async () => {
            const res = check(
                await getRadomesService<RadomesServiceData>(api, {
                    limit: 0,
                    offset: 0,
                    antenna_code: antennaCode,
                }),
            );
            return res.data.filter((r) => r.radome_code.trim() !== "");
        },
        ...staticOptions,
    });
};

export const useHeightCodes = (api: AxiosInstance, antennaCode: string) => {
    return useQuery({
        queryKey: ["heightCodes", antennaCode],
        queryFn: async () => {
            const res = check(
                await getHeightCodesService<GamitHTCServiceData>(api, {
                    limit: 0,
                    offset: 0,
                    antenna_code: antennaCode,
                }),
            );
            return res.data;
        },
        ...staticOptions,
    });
};

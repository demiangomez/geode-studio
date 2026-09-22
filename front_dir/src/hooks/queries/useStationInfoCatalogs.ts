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
    GamitHTCServiceData,
    RadomesServiceData,
    ReceiversServiceData,
} from "@types";
import { unwrapApiResponse } from "@utils";

const staticOptions = {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
};

export const useReceivers = (api: AxiosInstance) => {
    return useQuery({
        queryKey: ["receivers"],
        queryFn: async () => {
            const res = unwrapApiResponse(
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
            const res = unwrapApiResponse(
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
            const res = unwrapApiResponse(
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
            const res = unwrapApiResponse(
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

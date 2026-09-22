import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import { getTectonicPlatesService } from "@services";
import {
    ErrorResponse,
    TectonicPlateName,
    TectonicPlateNamesServiceData,
    TectonicPlatesServiceData,
} from "@types";

export const useTectonicPlates = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["tectonicPlates"],
        queryFn: async () => {
            const res = await getTectonicPlatesService<
                TectonicPlatesServiceData | ErrorResponse
            >(api);
            if ("status" in res) {
                throw new Error(res.msg ?? "Error fetching tectonic plates");
            }
            return res;
        },
        staleTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        ...options,
    });
};

export const useTectonicPlateNames = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) => {
    return useQuery<TectonicPlateName[]>({
        queryKey: ["tectonicPlates", "names"],
        queryFn: async () => {
            const res = await getTectonicPlatesService<
                TectonicPlateNamesServiceData | ErrorResponse
            >(api, true);
            if ("status" in res) {
                throw new Error(
                    res.msg ?? "Error fetching tectonic plate names",
                );
            }
            return res.plates ?? [];
        },
        staleTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        ...options,
    });
};

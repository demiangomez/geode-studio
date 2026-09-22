import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { getEarthquakesService } from "@services";
import { EarthQuakeParams } from "@types";
import { unwrapApiResponse } from "@utils";

export const useEarthquakes = (
    api: AxiosInstance,
    params?: EarthQuakeParams,
    enabled: boolean = true,
) => {
    return useQuery({
        queryKey: ["earthquakes", params],
        queryFn: async () =>
            unwrapApiResponse(await getEarthquakesService<any>(api, params)),
        enabled,
        staleTime: 5 * 60 * 1000,
    });
};

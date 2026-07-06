import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { getAffectedStationsService } from "@services";
import { StationsAffectedServiceData } from "@types";

export const useAffectedStations = (
    api: AxiosInstance,
    earthquakeId?: number
) => {
    return useQuery({
        queryKey: ["affectedStations", earthquakeId],
        queryFn: ({ signal }) =>
            getAffectedStationsService<StationsAffectedServiceData>(
                api,
                earthquakeId,
                { signal }
            ),
        enabled: !!earthquakeId,
        staleTime: 5 * 60 * 1000,
    });
};

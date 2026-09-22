import { QueryFunctionContext } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { getAffectedStationsService } from "@services";
import { ErrorResponse, StationsAffectedServiceData } from "@types";
import { unwrapApiResponse } from "@utils";

export const affectedStationsQueryOptions = (
    api: AxiosInstance,
    earthquakeId?: number,
) => ({
    queryKey: ["affectedStations", earthquakeId],
    queryFn: async ({ signal }: QueryFunctionContext) =>
        unwrapApiResponse(
            await getAffectedStationsService<
                StationsAffectedServiceData | ErrorResponse
            >(api, earthquakeId, { signal }),
        ),
    enabled: !!earthquakeId,
    staleTime: 5 * 60 * 1000,
});

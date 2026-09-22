import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import { getStationEventsService } from "@services";
import { ErrorResponse, GetParams, StationEventsData } from "@types";
import { unwrapApiResponse } from "@utils";

// keepPreviousData: sin placeholder la paginacion desaparece al cambiar de pagina
export const useGeneralEvents = (api: AxiosInstance, params: GetParams) =>
    useQuery({
        queryKey: ["generalEvents", params],
        queryFn: async () =>
            unwrapApiResponse(
                await getStationEventsService<
                    StationEventsData | ErrorResponse
                >(api, params),
            ),
        staleTime: 60 * 1000,
        placeholderData: keepPreviousData,
    });

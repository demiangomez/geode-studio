import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { useMemo } from "react";

import {
    getAdjustmentOptionsService,
    getModeObsTypesService,
    getSolutionTypesService,
} from "@services";
import {
    AdjustmentOptionsServiceData,
    ErrorResponse,
    ModeObsTypesServiceData,
    SolutionTypesServiceData,
} from "@types";
import { unwrapApiResponse } from "@utils";

const staticOptions = {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
};

export const useSolutionTypes = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["timeSeriesConfig", "solutionTypes"],
        queryFn: async () =>
            unwrapApiResponse(
                await getSolutionTypesService<
                    SolutionTypesServiceData | ErrorResponse
                >(api),
            ),
        ...staticOptions,
    });

    const solutionTypes = useMemo(
        () => (query.data?.solution_types ?? []).map((s) => s.type),
        [query.data],
    );

    return { ...query, solutionTypes };
};

export const useAdjustmentOptions = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["timeSeriesConfig", "adjustmentOptions"],
        queryFn: async () =>
            unwrapApiResponse(
                await getAdjustmentOptionsService<
                    AdjustmentOptionsServiceData | ErrorResponse
                >(api),
            ),
        ...staticOptions,
    });

    const adjustmentModels = query.data?.adjustment_models ?? [];
    const covarianceFunctions = query.data?.covariance_functions ?? [];

    return { ...query, adjustmentModels, covarianceFunctions };
};

export const useModeObsTypes = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["timeSeriesConfig", "modeObsTypes"],
        queryFn: async () =>
            unwrapApiResponse(
                await getModeObsTypesService<
                    ModeObsTypesServiceData | ErrorResponse
                >(api),
            ),
        ...staticOptions,
    });

    // El backend acepta id o type para el param mode_obs → usamos el type.
    const modeObsTypes = useMemo(
        () => (query.data?.mode_obs_types ?? []).map((m) => m.type),
        [query.data],
    );

    return { ...query, modeObsTypes };
};

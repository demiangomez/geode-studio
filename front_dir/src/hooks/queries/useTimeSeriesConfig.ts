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
    ModeObsTypesServiceData,
    SolutionTypesServiceData,
} from "@types";

const staticOptions = {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
};

export const useSolutionTypes = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["timeSeriesConfig", "solutionTypes"],
        queryFn: () => getSolutionTypesService<SolutionTypesServiceData>(api),
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
        queryFn: () =>
            getAdjustmentOptionsService<AdjustmentOptionsServiceData>(api),
        ...staticOptions,
    });

    const adjustmentModels = query.data?.adjustment_models ?? [];
    const covarianceFunctions = query.data?.covariance_functions ?? [];

    return { ...query, adjustmentModels, covarianceFunctions };
};

export const useModeObsTypes = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["timeSeriesConfig", "modeObsTypes"],
        queryFn: () => getModeObsTypesService<ModeObsTypesServiceData>(api),
        ...staticOptions,
    });

    // El backend acepta id o type para el param mode_obs → usamos el type.
    const modeObsTypes = useMemo(
        () => (query.data?.mode_obs_types ?? []).map((m) => m.type),
        [query.data],
    );

    return { ...query, modeObsTypes };
};

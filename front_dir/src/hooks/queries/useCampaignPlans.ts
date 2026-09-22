import {
    UseMutationOptions,
    keepPreviousData,
    useMutation,
    useQuery,
} from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    delCampaignPlanService,
    getCampaignPlanService,
    getCampaignPlansService,
    getGeocodeCityService,
    postCampaignPlanService,
    postCampaignPlannerService,
    putCampaignPlanService,
} from "@services";

import {
    CampaignPlanData,
    CampaignPlanParams,
    CampaignPlannerData,
    CampaignPlansServiceData,
    ErrorResponse,
    GeocodeCityData,
    GetParams,
} from "@types";

import { unwrapApiResponse } from "@utils";

import { useInvalidate } from "./useInvalidate";

const PLANS_STALE_TIME = 5 * 60 * 1000;

export const campaignPlansKeys = {
    all: ["campaignPlans"] as const,
    list: (params?: GetParams) =>
        [...campaignPlansKeys.all, "list", params] as const,
    detail: (id: number) => [...campaignPlansKeys.all, "detail", id] as const,
};

// Lectura on-demand que no se cachea: cada corrida rutea en vivo (OSRM + Nominatim).
// Los callbacks van al hook (no a mutate): corren aunque el componente se desmonte,
// que es lo que necesita la pestaña del plan.
export const useCampaignPlanner = (
    api: AxiosInstance,
    options: Pick<
        UseMutationOptions<CampaignPlannerData, Error, CampaignPlanParams>,
        "onSuccess" | "onError"
    > = {},
) =>
    useMutation({
        ...options,
        mutationFn: async (params: CampaignPlanParams) =>
            unwrapApiResponse(
                await postCampaignPlannerService<
                    CampaignPlannerData | ErrorResponse
                >(api, params),
            ),
    });

export const useGeocodeCity = (api: AxiosInstance) =>
    useMutation({
        mutationFn: async (q: string) =>
            unwrapApiResponse(
                await getGeocodeCityService<GeocodeCityData | ErrorResponse>(
                    api,
                    q,
                ),
            ),
    });

// keepPreviousData: la pagina anterior sigue visible (isPlaceholderData) hasta que llega la nueva
export const useCampaignPlans = (api: AxiosInstance, params?: GetParams) =>
    useQuery({
        queryKey: campaignPlansKeys.list(params),
        queryFn: async ({ signal }) =>
            unwrapApiResponse(
                await getCampaignPlansService<
                    CampaignPlansServiceData | ErrorResponse
                >(api, params, { signal }),
            ),
        staleTime: PLANS_STALE_TIME,
        placeholderData: keepPreviousData,
    });

// Deep link /campaign-planner/:id: precarga el formulario con un plan guardado
export const useCampaignPlan = (api: AxiosInstance, id: number | undefined) =>
    useQuery({
        queryKey: campaignPlansKeys.detail(id ?? 0),
        queryFn: async ({ signal }) =>
            unwrapApiResponse(
                await getCampaignPlanService<CampaignPlanData | ErrorResponse>(
                    api,
                    id!,
                    { signal },
                ),
            ),
        staleTime: PLANS_STALE_TIME,
        enabled: id !== undefined,
    });

export interface SaveCampaignPlanVars {
    id?: number;
    data: CampaignPlanParams & { name: string };
}

export const useSaveCampaignPlan = (api: AxiosInstance) =>
    useMutation({
        mutationFn: async ({ id, data }: SaveCampaignPlanVars) =>
            unwrapApiResponse(
                id === undefined
                    ? await postCampaignPlanService<
                          CampaignPlanData | ErrorResponse
                      >(api, data)
                    : await putCampaignPlanService<
                          CampaignPlanData | ErrorResponse
                      >(api, id, data),
            ),
    });

export const useDeleteCampaignPlan = (api: AxiosInstance) =>
    useMutation({
        mutationFn: async (id: number) =>
            unwrapApiResponse(
                await delCampaignPlanService<
                    { statusCode: number } | ErrorResponse
                >(api, id),
            ),
    });

export const useInvalidateCampaignPlans = () =>
    useInvalidate(campaignPlansKeys.all);

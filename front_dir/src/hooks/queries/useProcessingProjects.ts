import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    delProcessingProjectService,
    getProcessingProjectsService,
    patchProcessingProjectService,
    postProcessingProjectService,
    postProcessingStationListService,
} from "@services";

import {
    ErrorResponse,
    GetParams,
    ProcessingEngine,
    ProcessingProjectBase,
    ProcessingProjectsServiceData,
    ProcessingStationListData,
    ProcessingStationListParams,
} from "@types";

import { ApiError, unwrapApiResponse } from "@utils";

import { useInvalidate } from "./useInvalidate";

const PROJECTS_STALE_TIME = 5 * 60 * 1000;

export const processingProjectsKeys = {
    all: ["processingProjects"] as const,
    list: (engine: ProcessingEngine, params?: GetParams) =>
        [...processingProjectsKeys.all, engine, "list", params] as const,
};

export interface ProcessingEngineEndpoint {
    key: ProcessingEngine;
    endpoint: string;
}

// keepPreviousData: la pagina anterior sigue visible (isPlaceholderData) hasta que llega la nueva
export const useProcessingProjects = <T extends ProcessingProjectBase>(
    api: AxiosInstance,
    engine: ProcessingEngineEndpoint,
    params?: GetParams,
) =>
    useQuery({
        queryKey: processingProjectsKeys.list(engine.key, params),
        queryFn: async ({ signal }) =>
            unwrapApiResponse(
                await getProcessingProjectsService<
                    ProcessingProjectsServiceData<T> | ErrorResponse
                >(api, engine.endpoint, params, { signal }),
            ),
        staleTime: PROJECTS_STALE_TIME,
        placeholderData: keepPreviousData,
    });

export interface SaveProjectVars {
    id?: number;
    fields: Record<string, unknown>;
    files?: FormData;
}

export interface SaveProjectResult<T> {
    project: T;
    fileError?: ApiError;
}

// JSON para las columnas y, si hay archivo, un segundo PATCH multipart solo con los `_by_file`
export const useSaveProcessingProject = <T extends ProcessingProjectBase>(
    api: AxiosInstance,
    engine: ProcessingEngineEndpoint,
) =>
    useMutation({
        mutationFn: async ({
            id,
            fields,
            files,
        }: SaveProjectVars): Promise<SaveProjectResult<T>> => {
            let project = unwrapApiResponse(
                id === undefined
                    ? await postProcessingProjectService<T | ErrorResponse>(
                          api,
                          engine.endpoint,
                          fields,
                      )
                    : await patchProcessingProjectService<T | ErrorResponse>(
                          api,
                          engine.endpoint,
                          id,
                          fields,
                      ),
            );
            if (!files) return { project };
            try {
                project = unwrapApiResponse(
                    await patchProcessingProjectService<T | ErrorResponse>(
                        api,
                        engine.endpoint,
                        project.api_id,
                        files,
                    ),
                );
                return { project };
            } catch (error) {
                if (error instanceof ApiError)
                    return { project, fileError: error };
                throw error;
            }
        },
    });

export const useDeleteProcessingProject = (
    api: AxiosInstance,
    engine: ProcessingEngineEndpoint,
) =>
    useMutation({
        mutationFn: async (id: number) =>
            unwrapApiResponse(
                await delProcessingProjectService<
                    { statusCode: number } | ErrorResponse
                >(api, engine.endpoint, id),
            ),
    });

export const useResolveProcessingStations = (api: AxiosInstance) =>
    useMutation({
        mutationFn: async (params: ProcessingStationListParams) =>
            unwrapApiResponse(
                await postProcessingStationListService<
                    ProcessingStationListData | ErrorResponse
                >(api, params),
            ),
    });

export const useInvalidateProcessingProjects = () =>
    useInvalidate(processingProjectsKeys.all);

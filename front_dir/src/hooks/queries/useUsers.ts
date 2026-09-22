import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import { getRolesService, getUsersService } from "@services";

import {
    ErrorResponse,
    GetParams,
    RolesServiceData,
    UsersServiceData,
} from "@types";

import { unwrapApiResponse } from "@utils";

import { useInvalidate } from "./useInvalidate";

const USERS_STALE_TIME = 5 * 60 * 1000;

export const usersKeys = {
    all: ["users"] as const,
    list: (params?: GetParams) => [...usersKeys.all, "list", params] as const,
    roles: (params?: GetParams) => [...usersKeys.all, "roles", params] as const,
};

// keepPreviousData: al cambiar de pagina siguen visibles las filas anteriores
// (isPlaceholderData) hasta que llega la nueva; una pagina ya visitada sale del cache
export const useUsers = (api: AxiosInstance, params?: GetParams) =>
    useQuery({
        queryKey: usersKeys.list(params),
        queryFn: async () =>
            unwrapApiResponse(
                await getUsersService<UsersServiceData | ErrorResponse>(
                    api,
                    params,
                ),
            ),
        staleTime: USERS_STALE_TIME,
        placeholderData: keepPreviousData,
    });

export const useRoles = (api: AxiosInstance, params?: GetParams) =>
    useQuery({
        queryKey: usersKeys.roles(params),
        queryFn: async () =>
            unwrapApiResponse(
                await getRolesService<RolesServiceData | ErrorResponse>(
                    api,
                    params,
                ),
            ),
        staleTime: USERS_STALE_TIME,
        placeholderData: keepPreviousData,
    });

// Cada fila de users muestra role.name: un cambio de rol invalida el arbol entero
export const useInvalidateUsers = () => useInvalidate(usersKeys.all);

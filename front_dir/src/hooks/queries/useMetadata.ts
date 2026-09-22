import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import {
    getStationTypesService,
    getStationStatusService,
    getNetworksService,
    getCountriesService,
    getMonumentsTypesService,
    getStationRolesService,
} from "@services";
import {
    StationTypeServiceData,
    StationStatusServiceData,
    NetworkServiceData,
    CountriesServiceData,
    StationTypeData,
    StationStatusData,
    MonumentTypesServiceData,
    GetParams,
    ErrorResponse,
} from "@types";
import { unwrapApiResponse } from "@utils";
import { useMemo } from "react";

export type MetadataCatalog =
    | "types"
    | "statuses"
    | "roles"
    | "monuments"
    | "networks"
    | "countries";

/**
 * Las 6 queries se montan siempre (no se puede llamar a useQuery dentro de un
 * `if`), asi que lo que decide si hay request es `enabled`. Sin `only` se
 * comporta como antes —pide los 6 catalogos—; con `only` las demas quedan en
 * `enabled: false` y no salen a la red.
 *
 * Importa porque los catalogos pesan muy distinto: `monument-types` trae las
 * fotos en base64 (~480 KB) y `station-types` los iconos (~49 KB), y casi
 * ningun consumidor los mira. Pedir `only` es lo que evita el request entero,
 * no solo achicarlo.
 */
export const useMetadata = (
    api: AxiosInstance,
    options: { enabled?: boolean; only?: MetadataCatalog[] } = {},
    params?: GetParams,
) => {
    const { only, ...queryOptions } = options;

    const wants = (catalog: MetadataCatalog) =>
        (queryOptions.enabled ?? true) && (!only || only.includes(catalog));

    const dynamicOptions = {
        staleTime: 5 * 60 * 1000, // 5 minutos
        refetchOnWindowFocus: true, // Refrescar si el usuario vuelve a la pestaña
        ...queryOptions,
    };

    const staticOptions = {
        staleTime: 24 * 60 * 60 * 1000, // 24 horas
        refetchOnWindowFocus: false,
        ...queryOptions,
    };

    // Tipos de Estaciones
    const types = useQuery({
        queryKey: ["metadata", "stationTypes", params],
        queryFn: async () =>
            unwrapApiResponse(
                await getStationTypesService<
                    StationTypeServiceData | ErrorResponse
                >(api, params),
            ),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
        enabled: wants("types"),
    });

    // Estados de Estaciones
    const statuses = useQuery({
        queryKey: ["metadata", "stationStatuses", params],
        queryFn: async () =>
            unwrapApiResponse(
                await getStationStatusService<
                    StationStatusServiceData | ErrorResponse
                >(api, params),
            ),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
        enabled: wants("statuses"),
    });

    // Tipos de Monumentos
    const monumentsTypes = useQuery({
        queryKey: ["metadata", "monumentsTypes", params],
        queryFn: async () =>
            unwrapApiResponse(
                await getMonumentsTypesService<
                    MonumentTypesServiceData | ErrorResponse
                >(api, params),
            ),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
        enabled: wants("monuments"),
    });

    // Roles de Estaciones
    const roles = useQuery({
        queryKey: ["metadata", "stationRoles", params],
        queryFn: async () =>
            unwrapApiResponse(
                await getStationRolesService<
                    StationStatusServiceData | ErrorResponse
                >(api, params),
            ),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
        enabled: wants("roles"),
    });

    // Redes
    const networks = useQuery({
        queryKey: ["metadata", "networks"],
        queryFn: async () =>
            unwrapApiResponse(
                await getNetworksService<NetworkServiceData | ErrorResponse>(
                    api,
                ),
            ),
        ...staticOptions,
        enabled: wants("networks"),
    });

    // Países
    const countries = useQuery({
        queryKey: ["metadata", "countries"],
        queryFn: async () =>
            unwrapApiResponse(
                await getCountriesService<CountriesServiceData | ErrorResponse>(
                    api,
                ),
            ),
        ...staticOptions,
        enabled: wants("countries"),
    });

    // Copia antes de ordenar: el array es el que vive en la cache de TanStack
    const formattedTypes = useMemo(() => {
        return [...(types.data?.data ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ actual_image, ...t }: StationTypeData) => ({
                ...t,
                image: (actual_image ?? t.image) as string,
            }));
    }, [types.data]);

    const formattedStatuses = useMemo(() => {
        return [...(statuses.data?.data ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s: StationStatusData) => ({
                id: s.id,
                color: s.color_name,
                name: s.name,
            }));
    }, [statuses.data]);

    const sortedMonuments = useMemo(() => {
        return [...(monumentsTypes?.data?.data ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name),
        );
    }, [monumentsTypes?.data]);

    const formattedRoles = useMemo(() => {
        return [...(roles.data?.data ?? [])]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r: StationStatusData) => ({
                id: r.id,
                name: r.name,
            }));
    }, [roles.data]);

    return {
        types: formattedTypes,
        typesTotal: types.data?.total_count,
        typesIsFetching: types.isFetching,
        statuses: formattedStatuses,
        statusesTotal: statuses.data?.total_count,
        statusesIsFetching: statuses.isFetching,
        roles: formattedRoles,
        rolesTotal: roles.data?.total_count,
        rolesIsFetching: roles.isFetching,
        monuments: sortedMonuments,
        monumentsTotal: monumentsTypes.data?.total_count,
        monumentsIsFetching: monumentsTypes.isFetching,
        networks: networks.data?.data ?? [],
        networksTotal: networks.data?.total_count ?? 0,
        networksIsFetching: networks.isFetching,
        countries: countries.data?.data ?? [],
        isLoading:
            types.isLoading ||
            statuses.isLoading ||
            roles.isLoading ||
            networks.isLoading ||
            countries.isLoading ||
            monumentsTypes.isLoading,
        isError:
            types.isError ||
            statuses.isError ||
            roles.isError ||
            networks.isError ||
            countries.isError ||
            monumentsTypes.isError,
    };
};

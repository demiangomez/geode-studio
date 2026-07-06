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
import { useServerHealth } from "./useServerHealth";
import {
    StationTypeServiceData,
    StationStatusServiceData,
    NetworkServiceData,
    CountriesServiceData,
    StationTypeData,
    StationStatusData,
    MonumentTypesServiceData,
    GetParams,
} from "@types";
import { useMemo } from "react";

export const useMetadata = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
    params?: GetParams,
) => {
    const dynamicOptions = {
        staleTime: 5 * 60 * 1000, // 5 minutos
        refetchOnWindowFocus: true, // Refrescar si el usuario vuelve a la pestaña
        ...options,
    };

    const staticOptions = {
        staleTime: 24 * 60 * 60 * 1000, // 24 horas
        refetchOnWindowFocus: false,
        ...options,
    };

    // Tipos de Estaciones
    const types = useQuery({
        queryKey: ["metadata", "stationTypes", params],
        queryFn: () =>
            getStationTypesService<StationTypeServiceData>(api, params),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
    });

    // Estados de Estaciones
    const statuses = useQuery({
        queryKey: ["metadata", "stationStatuses", params],
        queryFn: () =>
            getStationStatusService<StationStatusServiceData>(api, params),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
    });

    // Tipos de Monumentos
    const monumentsTypes = useQuery({
        queryKey: ["metadata", "monumentsTypes", params],
        queryFn: () =>
            getMonumentsTypesService<MonumentTypesServiceData>(api, params),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
    });

    // Roles de Estaciones
    const roles = useQuery({
        queryKey: ["metadata", "stationRoles", params],
        queryFn: () =>
            getStationRolesService<StationStatusServiceData>(api, params),
        placeholderData: keepPreviousData,
        ...dynamicOptions,
    });

    // Redes
    const networks = useQuery({
        queryKey: ["metadata", "networks"],
        queryFn: () => getNetworksService<NetworkServiceData>(api),
        ...staticOptions,
    });

    // Países
    const countries = useQuery({
        queryKey: ["metadata", "countries"],
        queryFn: () => getCountriesService<CountriesServiceData>(api),
        ...staticOptions,
    });

    // Health Check del Servidor (query compartida vía useServerHealth)
    const health = useServerHealth(api).query;

    const formattedTypes = useMemo(() => {
        return (types.data?.data ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ actual_image, ...t }: StationTypeData) => ({
                ...t,
                image: (actual_image ?? t.image) as string,
            }));
    }, [types.data]);

    const formattedStatuses = useMemo(() => {
        return (statuses.data?.data ?? [])
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s: StationStatusData) => ({
                id: s.id,
                color: s.color_name,
                name: s.name,
            }));
    }, [statuses.data]);

    const sortedMonuments = useMemo(() => {
        return (monumentsTypes?.data?.data ?? []).sort((a, b) =>
            a.name.localeCompare(b.name),
        );
    }, [monumentsTypes?.data]);

    const formattedRoles = useMemo(() => {
        return (roles.data?.data ?? [])
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
        health: health,
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

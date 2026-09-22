import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    getSourcesFormatsService,
    getSourcesMetadataByIdService,
    getSourcesMetadataService,
    getSourcesServersService,
    getSourcesStationsByServerIdService,
    getSourcesStationsByStationIdService,
} from "@services";

import {
    SourcesFormatServiceData,
    SourcesMetadataData,
    SourcesMetadataServiceData,
    SourcesServerServiceData,
    SourcesStationsServiceData,
} from "@types";

import { unwrapApiResponse } from "@utils";

import { useInvalidate } from "./useInvalidate";

/**
 * Los tres catalogos (servers, formats, metadata) los consumen tanto la pagina
 * Sources como la solapa Sources de la estacion, asi que van cacheados y
 * compartidos; las mutaciones de los modales invalidan `["sources"]` entero.
 */
const SOURCES_STALE_TIME = 5 * 60 * 1000;

export const sourcesKeys = {
    all: ["sources"] as const,
    servers: () => [...sourcesKeys.all, "servers"] as const,
    formats: () => [...sourcesKeys.all, "formats"] as const,
    metadata: () => [...sourcesKeys.all, "metadata"] as const,
    stationsByStation: (nc?: string, sc?: string) =>
        [...sourcesKeys.all, "stations", "byStation", nc, sc] as const,
    stationsByServer: (serverId?: number) =>
        [...sourcesKeys.all, "stations", "byServer", serverId] as const,
};

export const useSourcesServers = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: sourcesKeys.servers(),
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesServersService<SourcesServerServiceData>(api),
            ).data,
        staleTime: SOURCES_STALE_TIME,
        enabled: options.enabled ?? true,
    });

export const useSourcesFormats = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: sourcesKeys.formats(),
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesFormatsService<SourcesFormatServiceData>(api),
            ).data,
        staleTime: SOURCES_STALE_TIME,
        enabled: options.enabled ?? true,
    });

export const useSourcesMetadata = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: sourcesKeys.metadata(),
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesMetadataService<SourcesMetadataServiceData>(
                    api,
                ),
            ).data,
        staleTime: SOURCES_STALE_TIME,
        enabled: options.enabled ?? true,
    });

/** Sources de una estacion, ya ordenadas por try_order (el orden es la semantica). */
export const useStationSources = (
    api: AxiosInstance,
    networkCode: string | undefined,
    stationCode: string | undefined,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: sourcesKeys.stationsByStation(networkCode, stationCode),
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesStationsByStationIdService<SourcesStationsServiceData>(
                    api,
                    networkCode as string,
                    stationCode as string,
                ),
            ).data.sort((a, b) => a.try_order - b.try_order),
        staleTime: SOURCES_STALE_TIME,
        enabled: !!networkCode && !!stationCode && (options.enabled ?? true),
    });

export const useSourcesStationsByServer = (
    api: AxiosInstance,
    serverId: number | undefined,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: sourcesKeys.stationsByServer(serverId),
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesStationsByServerIdService<SourcesStationsServiceData>(
                    api,
                    serverId as number,
                ),
            ).data,
        staleTime: SOURCES_STALE_TIME,
        enabled: serverId !== undefined && (options.enabled ?? true),
    });

/**
 * Un alta/edicion en cualquiera de los catalogos puede cambiar lo que muestran
 * los otros (un server referencia una metadata, una source station un server),
 * asi que se invalida el arbol completo.
 */
export const useInvalidateSources = () => useInvalidate(sourcesKeys.all);

/** Metadata de una entrada puntual, pedida on-demand al hacer click en "ver" (no se lista completa en la estación). */
export const useSourcesMetadataById = (
    api: AxiosInstance,
    id: number | null | undefined,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: [...sourcesKeys.metadata(), "byId", id],
        queryFn: async () =>
            unwrapApiResponse(
                await getSourcesMetadataByIdService<SourcesMetadataData>(
                    api,
                    id as number,
                ),
            ),
        staleTime: SOURCES_STALE_TIME,
        enabled: id != null && (options.enabled ?? true),
    });

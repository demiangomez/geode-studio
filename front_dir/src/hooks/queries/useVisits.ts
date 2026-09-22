import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import {
    delStationVisitService,
    getStationCampaignsService,
    getStationVisitsImagesService,
    getStationVisitsService,
    postTransferVisitsService,
} from "@services";
import {
    ErrorResponse,
    StationCampaignsServiceData,
    StationVisitsFilesServiceData,
    StationVisitsServiceData,
    VisitTransferBody,
    VisitTransferServiceData,
} from "@types";
import { ApiError } from "@utils";

export const useStationVisits = (
    api: AxiosInstance,
    stationApiId: number | undefined,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["visits", stationApiId],
        queryFn: async () => {
            const res = await getStationVisitsService<StationVisitsServiceData>(
                api,
                {
                    limit: 0,
                    offset: 0,
                    station_api_id: String(stationApiId),
                },
            );
            if (res.statusCode !== 200)
                throw new Error("Error fetching visits");
            return res.data;
        },
        enabled: !!stationApiId && (options.enabled ?? true),
    });
};

export const useStationVisitImages = (
    api: AxiosInstance,
    stationApiId: number | undefined,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["visitImages", stationApiId],
        queryFn: async () => {
            const res =
                await getStationVisitsImagesService<StationVisitsFilesServiceData>(
                    api,
                    {
                        limit: 0,
                        offset: 0,
                        station_api_id: String(stationApiId),
                        thumbnail: true,
                    },
                );
            if (res.statusCode !== 200)
                throw new Error("Error fetching visit images");
            return res.data;
        },
        enabled: !!stationApiId && (options.enabled ?? true),
    });
};

export const useCampaigns = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) => {
    return useQuery({
        queryKey: ["campaigns"],
        queryFn: async () => {
            const res =
                await getStationCampaignsService<StationCampaignsServiceData>(
                    api,
                    {
                        limit: 0,
                        offset: 0,
                    },
                );
            if (res.statusCode !== 200)
                throw new Error("Error fetching campaigns");
            return res.data;
        },
        ...options,
    });
};

export const useDeleteStationVisit = (api: AxiosInstance) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (visitId: number) => {
            const res = await delStationVisitService<ErrorResponse>(
                api,
                visitId,
            );
            if (!("status" in res) || res.status !== "success") {
                throw new ApiError(res);
            }
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["visits"] });
            queryClient.invalidateQueries({ queryKey: ["visitImages"] });
        },
    });
};

/**
 * El endpoint devuelve un reporte por visita ({transferred, rejected}) tanto
 * con 200 (al menos una transferida) como con 400 (ninguna, tipicamente por
 * colision de fecha), asi que ambos casos son `data`: el rechazo por visita es
 * parte del resultado, no una falla del request. Solo se throwea cuando la
 * respuesta no trae ese reporte (403 sin permiso, body invalido, 500), que
 * llega con el shape de error estandar de la API.
 */
export const TRANSFER_VISITS_MUTATION_KEY = ["transferVisits"];

export const useTransferVisits = (api: AxiosInstance) => {
    const queryClient = useQueryClient();
    return useMutation({
        // Con key el POST queda en el cache global de mutaciones, asi el modal
        // puede ver que hay uno en vuelo aunque se lo haya cerrado y reabierto
        // (cada apertura monta una instancia nueva del hook).
        mutationKey: TRANSFER_VISITS_MUTATION_KEY,
        mutationFn: async (body: VisitTransferBody) => {
            const res = await postTransferVisitsService<
                VisitTransferServiceData | ErrorResponse
            >(api, body);

            const report = ("status" in res ? res.response : res) as
                | Partial<VisitTransferServiceData>
                | undefined;

            if (
                !Array.isArray(report?.transferred) ||
                !Array.isArray(report?.rejected)
            ) {
                throw new ApiError(res as ErrorResponse);
            }

            return {
                transferred: report.transferred,
                rejected: report.rejected,
                statusCode: res.statusCode,
            };
        },
        onSuccess: (data) => {
            if (data.transferred.length === 0) return;
            // Sin stationApiId en la key: refresca origen y destino de una.
            // campaigns no se toca: es un catalogo global y la transferencia
            // preserva el campaign de cada visita.
            queryClient.invalidateQueries({ queryKey: ["visits"] });
            queryClient.invalidateQueries({ queryKey: ["visitImages"] });
        },
    });
};

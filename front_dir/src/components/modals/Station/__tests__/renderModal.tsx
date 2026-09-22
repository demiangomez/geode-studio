import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";

import * as services from "@services";

import StationMetadataModal from "../StationMetadataModal";
import {
    listResponse,
    MONUMENTS,
    PLATES,
    STATION,
    STATION_INFO,
    STATION_META,
    STATION_STATUSES,
    STATION_TYPES,
} from "./fixtures";

type Mocked = ReturnType<typeof vi.fn>;
const asMock = (fn: unknown) => fn as Mocked;

/**
 * Deja todos los servicios que el modal toca al montar devolviendo las fixtures.
 * Los PATCH quedan en 200 por defecto; cada test los pisa segun necesite.
 */
export const stubServices = () => {
    asMock(services.getStationsService).mockResolvedValue(
        listResponse([STATION]),
    );
    asMock(services.getStationMetaService).mockResolvedValue(STATION_META);
    asMock(services.getRinexService).mockResolvedValue({
        ...listResponse([]),
        total_count: 0,
    });
    asMock(services.getStationInfoService).mockResolvedValue(
        listResponse(STATION_INFO),
    );
    asMock(services.getStationsFilesAttachedService).mockResolvedValue(
        listResponse([]),
    );
    asMock(services.getMonumentsTypesByIdService).mockResolvedValue({
        ...MONUMENTS[0],
        photo_file: null,
    });

    asMock(services.getStationTypesService).mockResolvedValue(
        listResponse(STATION_TYPES),
    );
    asMock(services.getStationStatusService).mockResolvedValue(
        listResponse(STATION_STATUSES),
    );
    asMock(services.getMonumentsTypesService).mockResolvedValue(
        listResponse(MONUMENTS),
    );
    asMock(services.getStationRolesService).mockResolvedValue(listResponse([]));
    asMock(services.getNetworksService).mockResolvedValue(listResponse([]));
    asMock(services.getCountriesService).mockResolvedValue(listResponse([]));
    asMock(services.getServerHealthService).mockResolvedValue({
        statusCode: 200,
        result: "ok",
    });

    asMock(services.getTectonicPlatesService).mockResolvedValue({
        plates: PLATES,
        statusCode: 200,
    });

    asMock(services.patchStationMetaService).mockResolvedValue({
        ...STATION_META,
        statusCode: 200,
    });
    asMock(services.patchStationService).mockResolvedValue({
        ...STATION,
        statusCode: 200,
    });
};

export const renderMetadataModal = (
    props: Partial<React.ComponentProps<typeof StationMetadataModal>> = {},
) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, refetchInterval: false },
            mutations: { retry: false },
        },
    });

    const refetch = vi.fn();
    const setModalState = vi.fn();

    const utils = render(
        <QueryClientProvider client={queryClient}>
            <StationMetadataModal
                close={false}
                station={STATION}
                size="xl"
                refetch={refetch}
                setModalState={setModalState}
                {...props}
            />
        </QueryClientProvider>,
    );

    // En la app el <dialog> lo abre showModal() desde el padre. Sin el atributo
    // open, jsdom lo deja en display:none y getByRole no ve nada adentro.
    utils.container.querySelector("dialog")?.setAttribute("open", "");

    return { ...utils, refetch, setModalState, queryClient };
};

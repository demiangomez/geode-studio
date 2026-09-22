import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
    CardContainer,
    StationChangeTryOrderModal,
    StationSourceMetadataModal,
    StationSourcesModal,
    Table,
    TableCard,
} from "@componentsReact";

import { useAuth, useApi } from "@hooks";
import {
    useInvalidateSources,
    useSourcesFormats,
    useSourcesMetadataById,
    useSourcesServers,
    useStationSources,
} from "@hooks/queries";

import { showModal } from "@utils";

import {
    inheritedFromServer,
    rinexServerLabel,
} from "../SourcesServers/sourcesCatalog";

import { SourcesServerData, SourcesStationsData, StationData } from "@types";

interface OutletContext {
    station: StationData;
}

const RINEX_TITLES = ["try_order", "server", "path", "format"];

const Sources = () => {
    const { station } = useOutletContext<OutletContext>();

    const { token, logout } = useAuth();

    const api = useApi(token, logout);

    const [modals, setModals] = useState<
        | {
              show: boolean;
              title: string;
              type: "add" | "edit" | "none";
          }
        | undefined
    >(undefined);

    const [sourceStation, setSourceStation] = useState<
        SourcesStationsData | undefined
    >(undefined);

    const { data: sourcesServers, isFetching: serversFetching } =
        useSourcesServers(api);
    const { data: sourcesFormats } = useSourcesFormats(api);
    const { data: sourcesStations, isFetching: stationsFetching } =
        useStationSources(api, station.network_code, station.station_code);

    const loading = serversFetching || stationsFetching;

    const refetch = useInvalidateSources();

    const serversById = useMemo(
        () =>
            new Map<number, SourcesServerData>(
                (sourcesServers ?? []).map((server) => [
                    server.server_id,
                    server,
                ]),
            ),
        [sourcesServers],
    );

    const rinexRows = useMemo(
        () =>
            (sourcesStations ?? []).map((sourceStation) => {
                const server = serversById.get(sourceStation.server_id);
                return [
                    sourceStation.try_order.toString(),
                    server ? rinexServerLabel(server) : "N/A",
                    inheritedFromServer(sourceStation.path, server?.path ?? ""),
                    inheritedFromServer(
                        sourceStation.format,
                        server?.format ?? "",
                    ),
                ];
            }),
        [sourcesStations, serversById],
    );

    const viewingMetadata =
        !!modals?.show && modals.title === "Station Source Metadata";

    const selectedServer = sourceStation
        ? serversById.get(sourceStation.server_id)
        : undefined;

    const { data: viewedMetadata, isFetching: metadataFetching } =
        useSourcesMetadataById(api, selectedServer?.metadata_source_id, {
            enabled: viewingMetadata && !!selectedServer?.metadata_source_id,
        });

    const handleCloseModal = () => {
        setModals(undefined);
        setSourceStation(undefined);
    };

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <div className="">
            <h1 className="text-2xl font-base text-center">RINEX SOURCES</h1>
            <div className="flex w-full justify-center pr-2 space-x-2 px-2">
                <CardContainer title={""} height={false} addButton={false}>
                    <TableCard
                        title={"Sources"}
                        size={"100%"}
                        addButtonTitle="+ Source Station"
                        setModals={setModals}
                        addButton={true}
                        modalTitle="Station Sources"
                        secondAddButton={true}
                        secondAddButtonTitle="Swap Try Order"
                        secondModalTitle="Change Try Order"
                    >
                        <p className="text-sm italic text-gray-600 mb-2">
                            Server default values are marked with "*". Click the
                            book icon to view the linked metadata source.
                        </p>
                        {rinexRows.length > 0 ? (
                            <Table
                                table="sources"
                                titles={RINEX_TITLES}
                                body={rinexRows}
                                loading={loading}
                                onClickFunction={() =>
                                    setModals({
                                        show: true,
                                        title: "Station Sources",
                                        type: "edit",
                                    })
                                }
                                deleteRegister={false}
                                state={sourcesStations}
                                setState={setSourceStation}
                                viewRegister={true}
                                onViewClickFunction={() =>
                                    setModals({
                                        show: true,
                                        title: "Station Source Metadata",
                                        type: "edit",
                                    })
                                }
                                dataFetchUrl="api/sources-stations"
                            />
                        ) : (
                            <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                There are no Sources registered
                            </div>
                        )}
                    </TableCard>
                </CardContainer>
            </div>
            {modals?.show && modals.title === "Station Sources" && (
                <StationSourcesModal
                    api={api}
                    sourcesServers={sourcesServers}
                    sourcesFormats={sourcesFormats}
                    sourceStation={sourceStation}
                    type={modals.type}
                    handleClose={handleCloseModal}
                    station={station}
                    refetch={refetch}
                />
            )}
            {modals?.show && modals.title === "Change Try Order" && (
                <StationChangeTryOrderModal
                    api={api}
                    sourcesServers={sourcesServers}
                    sourcesStations={sourcesStations ?? []}
                    handleCloseModal={handleCloseModal}
                    refetch={refetch}
                />
            )}
            {viewingMetadata && (
                <StationSourceMetadataModal
                    metadata={viewedMetadata}
                    loading={metadataFetching}
                    linked={!!selectedServer?.metadata_source_id}
                    handleCloseModal={handleCloseModal}
                />
            )}
        </div>
    );
};

export default Sources;

import { useMemo, useState } from "react";

import { AxiosInstance } from "axios";

import {
    SourcesServersMergeModal,
    SourcesServersTableModal,
    SourcesStationsTableModal,
    Table,
    TableCard,
} from "@componentsReact";

import { useSourcesStationsByServer } from "@hooks/queries";

import {
    SourcesFormatData,
    SourcesMetadataData,
    SourcesServerData,
} from "@types";

import { metadataSourceLabel } from "./sourcesCatalog";

interface SourcesServersPageProps {
    setModals: React.Dispatch<
        React.SetStateAction<
            | {
                  show: boolean;
                  title: string;
                  type: "add" | "edit" | "none";
              }
            | undefined
        >
    >;
    sourcesServers: SourcesServerData[] | undefined;
    sourcesFormats: SourcesFormatData[] | undefined;
    sourcesMetadata: SourcesMetadataData[] | undefined;
    modals:
        | {
              show: boolean;
              title: string;
              type: "add" | "edit" | "none";
          }
        | undefined;
    api: AxiosInstance;
    refetch: () => void;
    loading: boolean;
}

const TITLES = [
    "protocol",
    "fqdn",
    "username",
    "password",
    "path",
    "format",
    "metadata",
];

const SourcesServersPage = ({
    setModals,
    sourcesServers,
    modals,
    sourcesFormats,
    sourcesMetadata,
    api,
    refetch,
    loading,
}: SourcesServersPageProps) => {
    const [sourceServer, setSourceServer] = useState<
        SourcesServerData | undefined
    >(undefined);

    const viewingStations =
        !!modals?.show && modals.title === "Sources Stations";

    const { data: sourcesStations, isFetching: viewLoading } =
        useSourcesStationsByServer(api, sourceServer?.server_id, {
            enabled: viewingStations && !!sourceServer,
        });

    const data = useMemo(() => {
        const metadataById = new Map(
            (sourcesMetadata ?? []).map((m) => [m.id, m]),
        );
        return (sourcesServers ?? []).map((sourceServer) => {
            const metadata =
                sourceServer.metadata_source_id != null
                    ? metadataById.get(sourceServer.metadata_source_id)
                    : undefined;
            return [
                sourceServer.protocol,
                sourceServer.fqdn,
                sourceServer.username ?? "",
                sourceServer.password,
                sourceServer.path ?? "",
                sourceServer.format,
                metadata ? metadataSourceLabel(metadata) : "",
            ];
        });
    }, [sourcesServers, sourcesMetadata]);

    const handleCloseModal = () => {
        setModals(undefined);
        setSourceServer(undefined);
    };

    return (
        <TableCard
            title={"Sources Servers"}
            size={"100%"}
            addButtonTitle="+ Source Server"
            setModals={setModals}
            addButton={true}
            modalTitle="Sources Servers"
            secondAddButton={(sourcesServers?.length ?? 0) > 1}
            secondAddButtonTitle="Transfer Stations"
            secondModalTitle="Merge Source Server"
        >
            <Table
                table="servers"
                titles={data.length > 0 ? TITLES : []}
                body={data.length > 0 ? data : undefined}
                loading={loading}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "Sources Servers",
                        type: "edit",
                    })
                }
                deleteRegister={false}
                state={sourcesServers}
                setState={setSourceServer}
                viewRegister={true}
                onViewClickFunction={() =>
                    setModals({
                        show: true,
                        title: "Sources Stations",
                        type: "edit",
                    })
                }
                dataFetchUrl="api/sources-servers"
            />
            {modals && modals.show && modals.title === "Sources Servers" && (
                <SourcesServersTableModal
                    handleClose={handleCloseModal}
                    type={modals?.type}
                    refetch={refetch}
                    sourcesFormats={sourcesFormats}
                    sourcesMetadata={sourcesMetadata}
                    sourceServer={sourceServer}
                    api={api}
                />
            )}
            {modals?.show && modals.title === "Merge Source Server" && (
                <SourcesServersMergeModal
                    sourcesServers={sourcesServers}
                    handleCloseModal={handleCloseModal}
                    refetch={refetch}
                    api={api}
                />
            )}
            {viewingStations && (
                <SourcesStationsTableModal
                    handleCloseModal={handleCloseModal}
                    loading={viewLoading}
                    sourcesStations={sourcesStations}
                    serverName={sourceServer?.fqdn}
                />
            )}
        </TableCard>
    );
};

export default SourcesServersPage;

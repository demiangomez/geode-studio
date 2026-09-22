import { useMemo } from "react";

import { AxiosInstance } from "axios";

import SourcesCatalogModal, {
    SourcesCatalogField,
} from "./SourcesCatalogModal";

import {
    deleteSourcesServersService,
    postSourcesServersService,
    putSourcesServersService,
} from "@services";

import {
    SourcesFormatData,
    SourcesMetadataData,
    SourcesServerData,
} from "@types";

import { SOURCES_SERVERS_STATE } from "@utils/reducerFormStates";

import { SOURCES_PROTOCOLS, metadataSourceLabel } from "./sourcesCatalog";

interface SourcesServersTableModalProps {
    handleClose: () => void;
    type: "add" | "edit" | "none" | undefined;
    refetch: () => void;
    sourcesFormats: SourcesFormatData[] | undefined;
    sourcesMetadata: SourcesMetadataData[] | undefined;
    sourceServer: SourcesServerData | undefined;
    api: AxiosInstance;
}

const SourcesServersTableModal = ({
    handleClose,
    type,
    refetch,
    sourcesFormats,
    sourcesMetadata,
    sourceServer,
    api,
}: SourcesServersTableModalProps) => {
    const fields = useMemo<SourcesCatalogField[]>(
        () => [
            { name: "protocol", options: SOURCES_PROTOCOLS },
            { name: "fqdn" },
            { name: "username" },
            { name: "password" },
            { name: "path" },
            {
                name: "format",
                options: sourcesFormats?.map((f) => f.format) ?? [],
            },
            {
                name: "metadata_source_id",
                label: "METADATA SOURCE",
                lookup:
                    sourcesMetadata?.map((m) => ({
                        id: m.id,
                        label: metadataSourceLabel(m),
                    })) ?? [],
            },
        ],
        [sourcesFormats, sourcesMetadata],
    );

    return (
        <SourcesCatalogModal
            modalId="Sources Servers"
            entityName="Source Server"
            fields={fields}
            initialState={SOURCES_SERVERS_STATE}
            idName="server_id"
            record={sourceServer}
            type={type}
            api={api}
            create={postSourcesServersService}
            update={putSourcesServersService}
            remove={deleteSourcesServersService}
            handleClose={handleClose}
            refetch={refetch}
        />
    );
};

export default SourcesServersTableModal;

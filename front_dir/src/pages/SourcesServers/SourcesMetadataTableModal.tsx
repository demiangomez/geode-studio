import { useMemo } from "react";

import { AxiosInstance } from "axios";

import SourcesCatalogModal, {
    SourcesCatalogField,
} from "./SourcesCatalogModal";

import {
    deleteSourcesMetadataService,
    postSourcesMetadataService,
    putSourcesMetadataService,
} from "@services";

import { SourcesFormatData, SourcesMetadataData } from "@types";

import { SOURCES_METADATA_STATE } from "@utils/reducerFormStates";

import { SOURCES_PROTOCOLS } from "./sourcesCatalog";

interface SourcesMetadataTableModalProps {
    handleClose: () => void;
    type: "add" | "edit" | "none" | undefined;
    refetch: () => void;
    sourcesFormats: SourcesFormatData[] | undefined;
    sourceMetadata: SourcesMetadataData | undefined;
    api: AxiosInstance;
}

const SourcesMetadataTableModal = ({
    handleClose,
    type,
    refetch,
    sourcesFormats,
    sourceMetadata,
    api,
}: SourcesMetadataTableModalProps) => {
    const fields = useMemo<SourcesCatalogField[]>(
        () => [
            { name: "protocol", options: SOURCES_PROTOCOLS },
            { name: "fqdn" },
            { name: "username" },
            { name: "password" },
            {
                name: "path",
                placeholder: "/pub/station/log/{station}_*.log",
            },
            {
                name: "format",
                options: sourcesFormats?.map((f) => f.format) ?? [],
            },
        ],
        [sourcesFormats],
    );

    return (
        <SourcesCatalogModal
            modalId="Sources Metadata"
            entityName="Metadata Source"
            fields={fields}
            initialState={SOURCES_METADATA_STATE}
            idName="id"
            record={sourceMetadata}
            type={type}
            api={api}
            create={postSourcesMetadataService}
            update={putSourcesMetadataService}
            remove={deleteSourcesMetadataService}
            handleClose={handleClose}
            refetch={refetch}
        />
    );
};

export default SourcesMetadataTableModal;

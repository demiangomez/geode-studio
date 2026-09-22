import { AxiosInstance } from "axios";

import SourcesCatalogModal, {
    SourcesCatalogField,
} from "./SourcesCatalogModal";

import {
    deleteSourcesFormatsService,
    postSourcesFormatsService,
    putSourcesFormatsService,
} from "@services";

import { SourcesFormatData } from "@types";

import { SOURCES_FORMATS_STATE } from "@utils/reducerFormStates";

interface SourcesFormatsTableModalProps {
    sourceFormat: SourcesFormatData | undefined;
    handleClose: () => void;
    refetch: () => void;
    api: AxiosInstance;
    type: "add" | "edit" | "none";
}

const FIELDS: SourcesCatalogField[] = [{ name: "format" }];

const SourcesFormatsTableModal = ({
    sourceFormat,
    handleClose,
    refetch,
    api,
    type,
}: SourcesFormatsTableModalProps) => (
    <SourcesCatalogModal
        modalId="Source Format"
        entityName="Source Format"
        fields={FIELDS}
        initialState={SOURCES_FORMATS_STATE}
        idName="api_id"
        record={sourceFormat}
        type={type}
        size="sm"
        api={api}
        create={postSourcesFormatsService}
        update={putSourcesFormatsService}
        remove={deleteSourcesFormatsService}
        handleClose={handleClose}
        refetch={refetch}
    />
);

export default SourcesFormatsTableModal;

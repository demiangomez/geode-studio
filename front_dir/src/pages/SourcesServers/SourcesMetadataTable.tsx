import { useMemo, useState } from "react";

import { AxiosInstance } from "axios";

import { SourcesMetadataTableModal, Table, TableCard } from "@componentsReact";

import { SourcesFormatData, SourcesMetadataData } from "@types";

interface SourcesMetadataPageProps {
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
    modals:
        | {
              show: boolean;
              title: string;
              type: "add" | "edit" | "none";
          }
        | undefined;
    sourcesMetadata: SourcesMetadataData[] | undefined;
    sourcesFormats: SourcesFormatData[] | undefined;
    api: AxiosInstance;
    loading: boolean;
    refetch: () => void;
}

const TITLES = [
    "protocol",
    "fqdn",
    "username",
    "password",
    "path",
    "format",
] as const;

const SourcesMetadataPage = ({
    setModals,
    sourcesMetadata,
    sourcesFormats,
    api,
    modals,
    refetch,
    loading,
}: SourcesMetadataPageProps) => {
    const [sourceMetadata, setSourceMetadata] = useState<
        SourcesMetadataData | undefined
    >(undefined);

    // El orden de `rows` y el de `sorted` tienen que coincidir: Table devuelve
    // el registro clickeado por indice.
    const { rows, sorted } = useMemo(() => {
        const sorted = [...(sourcesMetadata ?? [])].sort((a, b) =>
            a.fqdn.localeCompare(b.fqdn),
        );
        return {
            sorted,
            rows: sorted.map((metadata) => [
                metadata.protocol,
                metadata.fqdn,
                metadata.username ?? "",
                metadata.password ?? "",
                metadata.path ?? "",
                metadata.format ?? "",
            ]),
        };
    }, [sourcesMetadata]);

    return (
        <TableCard
            title={"Sources Metadata"}
            size={"100%"}
            addButtonTitle="+ Metadata Source"
            setModals={setModals}
            addButton={true}
            modalTitle="Sources Metadata"
        >
            <Table
                table="metadata"
                titles={rows.length > 0 ? [...TITLES] : []}
                body={rows.length > 0 ? rows : undefined}
                loading={loading}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "Sources Metadata",
                        type: "edit",
                    })
                }
                deleteRegister={false}
                state={sorted}
                setState={setSourceMetadata}
                dataFetchUrl="api/sources-metadata"
            />
            {modals?.show && modals.title === "Sources Metadata" && (
                <SourcesMetadataTableModal
                    sourceMetadata={sourceMetadata}
                    sourcesFormats={sourcesFormats}
                    handleClose={() => {
                        setModals(undefined);
                        setSourceMetadata(undefined);
                    }}
                    refetch={refetch}
                    api={api}
                    type={modals.type}
                />
            )}
        </TableCard>
    );
};

export default SourcesMetadataPage;

import { useMemo, useState } from "react";

import { SourcesFormatsTableModal, Table, TableCard } from "@components/index";
import { SourcesFormatData } from "@types";
import { AxiosInstance } from "axios";

interface SourcesFormatsPageProps {
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
    sourcesFormats: SourcesFormatData[] | undefined;
    api: AxiosInstance;
    loading: boolean;
    refetch: () => void;
}

const SourcesFormatsPage = ({
    setModals,
    sourcesFormats,
    api,
    modals,
    refetch,
    loading,
}: SourcesFormatsPageProps) => {
    const [sourceFormat, setSourceFormat] = useState<
        SourcesFormatData | undefined
    >(undefined);

    // Copia antes de ordenar: `sourcesFormats` es data cacheada de TanStack, un
    // sort in place mutaria la cache compartida.
    const sorted = useMemo(
        () =>
            [...(sourcesFormats ?? [])].sort((a, b) =>
                a.format.localeCompare(b.format),
            ),
        [sourcesFormats],
    );

    const data = useMemo(
        () => sorted.map((sourceFormat) => [sourceFormat.format]),
        [sorted],
    );

    const handleEdit = () => {
        setModals({
            show: true,
            title: "Source Format",
            type: "edit",
        });
    };

    return (
        <TableCard
            title={"Sources Formats"}
            size={"100%"}
            addButtonTitle="+ Source Format"
            setModals={setModals}
            addButton={true}
            modalTitle="Source Format"
        >
            <Table
                table="formats"
                titles={data.length > 0 ? ["format"] : []}
                body={data.length > 0 ? data : undefined}
                loading={loading}
                onClickFunction={handleEdit}
                deleteRegister={false}
                state={sorted}
                setState={setSourceFormat}
                dataFetchUrl="api/sources-formats"
            />
            {modals?.show && modals.title === "Source Format" && (
                <SourcesFormatsTableModal
                    sourceFormat={sourceFormat}
                    handleClose={() => {
                        setModals(undefined);
                        setSourceFormat(undefined);
                    }}
                    refetch={refetch}
                    api={api}
                    type={modals?.type}
                />
            )}
        </TableCard>
    );
};

export default SourcesFormatsPage;

import { useEffect, useState } from "react";

import { CardContainer } from "@componentsReact";
import SourcesServersPage from "./SourcesServersTable";
import SourcesFormatsPage from "./SourcesFormatsTable";
import SourcesMetadataPage from "./SourcesMetadataTable";

import { useAuth, useApi } from "@hooks";
import {
    useInvalidateSources,
    useSourcesFormats,
    useSourcesMetadata,
    useSourcesServers,
} from "@hooks/queries";

import { showModal } from "@utils";

const SourcesPage = () => {
    const { token, logout } = useAuth();

    const [modals, setModals] = useState<
        | {
              show: boolean;
              title: string;
              type: "add" | "edit" | "none";
          }
        | undefined
    >(undefined);

    const api = useApi(token, logout);

    const { data: sourcesServers, isLoading: serversLoading } =
        useSourcesServers(api);
    const { data: sourcesFormats, isLoading: formatsLoading } =
        useSourcesFormats(api);
    const { data: sourcesMetadata, isLoading: metadataLoading } =
        useSourcesMetadata(api);

    // isLoading: con isFetching las tablas se vaciaban en cada refetch
    const loading = serversLoading || formatsLoading || metadataLoading;

    const refetch = useInvalidateSources();

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <div className="p-4 flex flex-col justify-center items-center w-full h-full">
            <>
                <div className="w-full text-center mt-6">
                    <span className="text-4xl font-bold">Sources</span>
                </div>
                <div className="flex flex-grow w-full justify-center">
                    <div
                        className={`flex lg flex-col min-w-[80%]
                            justify-center items-center gap-2 overflow-y-auto`}
                    >
                        <>
                            <CardContainer
                                title={""}
                                height={false}
                                addButton={false}
                            >
                                <SourcesServersPage
                                    loading={loading}
                                    sourcesFormats={sourcesFormats}
                                    sourcesMetadata={sourcesMetadata}
                                    modals={modals}
                                    setModals={setModals}
                                    sourcesServers={sourcesServers}
                                    api={api}
                                    refetch={refetch}
                                />
                            </CardContainer>
                            <CardContainer
                                title={""}
                                height={false}
                                addButton={false}
                            >
                                <SourcesFormatsPage
                                    setModals={setModals}
                                    sourcesFormats={sourcesFormats}
                                    api={api}
                                    loading={loading}
                                    modals={modals}
                                    refetch={refetch}
                                />
                            </CardContainer>
                            <CardContainer
                                title={""}
                                height={false}
                                addButton={false}
                            >
                                <SourcesMetadataPage
                                    setModals={setModals}
                                    sourcesMetadata={sourcesMetadata}
                                    sourcesFormats={sourcesFormats}
                                    api={api}
                                    loading={loading}
                                    modals={modals}
                                    refetch={refetch}
                                />
                            </CardContainer>
                        </>
                    </div>
                </div>
            </>
        </div>
    );
};

export default SourcesPage;

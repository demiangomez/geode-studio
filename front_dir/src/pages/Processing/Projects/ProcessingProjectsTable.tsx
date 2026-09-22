import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Pagination, Table, TableCard } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import {
    useInvalidateProcessingProjects,
    useProcessingProjects,
} from "@hooks/queries";

import { GetParams, ProcessingProjectBase } from "@types";

import { showModal } from "@utils";

import ProcessingProjectModal from "./ProcessingProjectModal";
import { ProcessingEngineConfig } from "./engines";

const REGISTERS_PER_PAGE = 10;
const PAGES_TO_SHOW = 2;
const MODAL_ID = "EditProcessingProject";

interface Props<T extends ProcessingProjectBase> {
    engine: ProcessingEngineConfig<T>;
}

const ProcessingProjectsTable = <T extends ProcessingProjectBase>({
    engine,
}: Props<T>) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);
    const [project, setProject] = useState<T | undefined>(undefined);

    const [filters, setFilters] = useState<Record<string, string>>({
        search: "",
    });
    const deferredSearch = useDeferredValue(filters.search.trim());

    const [activePage, setActivePage] = useState(1);
    const [searchOfPage, setSearchOfPage] = useState(deferredSearch);
    if (searchOfPage !== deferredSearch) {
        setSearchOfPage(deferredSearch);
        setActivePage(1);
    }

    const params = useMemo<GetParams>(
        () => ({
            limit: REGISTERS_PER_PAGE,
            offset: (activePage - 1) * REGISTERS_PER_PAGE,
            project: deferredSearch || undefined,
        }),
        [activePage, deferredSearch],
    );

    const { data, isLoading, isPlaceholderData } = useProcessingProjects<T>(
        api,
        engine,
        params,
    );
    const invalidateProjects = useInvalidateProcessingProjects();

    const projects = data?.data;
    const pages = data ? Math.ceil(data.total_count / REGISTERS_PER_PAGE) : 0;

    // si se borro el ultimo registro de la ultima pagina, la query queda vacia
    const [pagesSeen, setPagesSeen] = useState(pages);
    if (pagesSeen !== pages) {
        setPagesSeen(pages);
        if (pages > 0 && activePage > pages) setActivePage(pages);
    }

    const titles = useMemo(() => engine.columns.map((c) => c.title), [engine]);
    const body = useMemo(
        () =>
            (projects ?? []).map((p) => engine.columns.map((c) => c.render(p))),
        [projects, engine],
    );

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={`${engine.label} Projects`}
            addButtonTitle="+ Project"
            modalTitle={MODAL_ID}
            addButton={true}
            setModals={setModals}
            size="1400px"
            filters={filters}
            setFilters={setFilters}
            showSearch={true}
            searchPlaceholder="Search by project..."
        >
            <div className={isPlaceholderData ? "opacity-60" : ""}>
                <Table
                    titles={body.length > 0 ? titles : []}
                    body={body}
                    table="Processing Project"
                    loading={isLoading}
                    dataOnly={false}
                    onClickFunction={() =>
                        setModals({ show: true, title: MODAL_ID, type: "edit" })
                    }
                    setState={setProject}
                    state={projects}
                    dataFetchUrl={engine.endpoint}
                />
            </div>
            {body.length > 0 && (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={(page) =>
                        page >= 1 && page <= pages && setActivePage(page)
                    }
                />
            )}
            {modals?.show && modals.title === MODAL_ID && (
                <ProcessingProjectModal
                    modalId={MODAL_ID}
                    engine={engine}
                    project={modals.type === "edit" ? project : undefined}
                    setStateModal={setModals}
                    reFetch={invalidateProjects}
                />
            )}
        </TableCard>
    );
};

export default ProcessingProjectsTable;

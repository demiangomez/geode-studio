import { useEffect, useMemo, useState } from "react";
import { NetworksModal, Pagination, Table, TableCard } from "@componentsReact";

import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useApi } from "@hooks";
import { useMetadata } from "@hooks/queries";
import { showModal } from "@utils";

import { NetworkData } from "@types";

const LIMIT = 5;

const NetworksTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const queryClient = useQueryClient();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [network, setNetwork] = useState<NetworkData | undefined>(undefined);

    const [activePage, setActivePage] = useState<number>(1);
    const PAGES_TO_SHOW = 2;

    const [filters, setFilters] = useState<Record<string, string>>({
        search: "",
    });

    const { networks, networksIsFetching, isLoading } = useMetadata(api, {
        only: ["networks"],
    });

    const filteredNetworks = useMemo(() => {
        const term = filters.search.toLowerCase().trim();
        const list = networks ?? [];
        return term
            ? list.filter((n) => n.network_code.toLowerCase().includes(term))
            : list;
    }, [networks, filters.search]);

    const pages = useMemo(
        () => Math.ceil(filteredNetworks.length / LIMIT),
        [filteredNetworks],
    );

    // Si se elimina un item y la página queda vacía, retroceder
    useEffect(() => {
        if (!isLoading && !networksIsFetching) {
            const maxPage = Math.ceil(filteredNetworks.length / LIMIT) || 1;
            if (activePage > maxPage) setActivePage(maxPage);
        }
    }, [filteredNetworks, activePage, isLoading, networksIsFetching]);

    const handlePage = (page: number) => setActivePage(page);

    const handleFiltersChange = (newFilters: Record<string, string>) => {
        setFilters(newFilters);
        setActivePage(1);
    };

    const reFetch = () => {
        queryClient.invalidateQueries({ queryKey: ["metadata", "networks"] });
    };

    const titles = ["Code", "Name"];

    const pagedNetworks = useMemo(() => {
        const sorted = [...filteredNetworks].sort((a, b) =>
            a.network_code.localeCompare(b.network_code),
        );
        return sorted.slice((activePage - 1) * LIMIT, activePage * LIMIT);
    }, [filteredNetworks, activePage]);

    const body = useMemo(
        () =>
            pagedNetworks.map((n) =>
                Object.values({
                    network_code: n.network_code,
                    network_name: n.network_name,
                }),
            ),
        [pagedNetworks],
    );

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Networks"}
            size={"75%"}
            addButton={true}
            addButtonTitle={"+ Network"}
            modalTitle="EditNetwork"
            setModals={setModals}
            filters={filters}
            setFilters={handleFiltersChange}
            showSearch={true}
            searchPlaceholder="Search by code..."
        >
            <Table
                titles={body && body.length > 0 ? titles : []}
                body={body}
                table={"Network"}
                loading={isLoading}
                dataOnly={false}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "EditNetwork",
                        type: "edit",
                    })
                }
                setState={setNetwork}
                state={pagedNetworks}
                dataFetchUrl={"api/networks"}
            />
            {body && body.length > 0 ? (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={handlePage}
                />
            ) : null}
            {modals?.show && modals.title === "EditNetwork" && (
                <NetworksModal
                    network={network}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setNetwork={setNetwork}
                    reFetch={reFetch}
                />
            )}
        </TableCard>
    );
};

export default NetworksTable;

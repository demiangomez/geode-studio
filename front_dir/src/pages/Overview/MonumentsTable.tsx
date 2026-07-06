import { useEffect, useMemo, useState } from "react";
import { MonumentModal, Pagination, Table, TableCard } from "@componentsReact";

import { useAuth, useApi } from "@hooks";

import { showModal } from "@utils";

import { GetParams, MonumentTypes } from "@types";
import { useQueryClient } from "@tanstack/react-query";
import { useMetadata } from "@hooks/queries";

const MonumentsTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const queryClient = useQueryClient();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [params, setParams] = useState<GetParams>({
        limit: 5,
        offset: 0,
    });

    const [monument, setMonument] = useState<MonumentTypes | undefined>(
        undefined,
    );

    const [activePage, setActivePage] = useState<number>(1);
    const PAGES_TO_SHOW = 2;

    const {
        monuments,
        monumentsTotal,
        monumentsIsFetching,
        isLoading: loading,
    } = useMetadata(api, {}, params);

    const pages = useMemo(() => {
        if (monumentsTotal && params.limit) {
            return Math.ceil(monumentsTotal / params.limit);
        }
        return 0;
    }, [monumentsTotal, params.limit]);

    useEffect(() => {
        if (!loading && !monumentsIsFetching && monuments && monuments.length === 0 && activePage > 1) {
            handlePage(activePage - 1);
        }
    }, [monuments, activePage, loading, monumentsIsFetching]); // eslint-disable-line

    const handlePage = (page: number) => {
        setActivePage(page);
        setParams((prev) => ({
            ...prev,
            offset: (page - 1) * (params.limit || 5),
        }));
    };

    const reFetch = () => {
        queryClient.invalidateQueries({
            queryKey: ["metadata", "monumentsTypes"],
        });
    };

    const titles = ["Name", "Photo"];

    const body = useMemo(() => {
        return monuments
            ?.sort((a, b) => a.name.localeCompare(b.name))
            .map((monument) =>
                Object.values({
                    // id: monument.id,
                    name: monument.name,
                    photo: monument.photo_file,
                }),
            );
    }, [monuments]);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Monuments"}
            size={"750px"}
            addButtonTitle="+ Monument"
            modalTitle="EditMonuments"
            setModals={setModals}
            addButton={true}
        >
            <Table
                titles={body && body.length > 0 ? titles : []}
                body={body}
                table={"Monuments"}
                loading={loading}
                dataOnly={false}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "EditMonuments",
                        type: "edit",
                    })
                }
                setState={setMonument}
                state={monuments}
                dataFetchUrl={"api/monument-types"}
            />
            {body && body.length > 0 ? (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={handlePage}
                />
            ) : null}
            {modals?.show && modals.title === "EditMonuments" && (
                <MonumentModal
                    Monument={monument}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setMonument={setMonument}
                    reFetch={reFetch}
                />
            )}
        </TableCard>
    );
};

export default MonumentsTable;

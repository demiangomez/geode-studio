import { useEffect, useMemo, useState } from "react";
import {
    StationRoleModal,
    Pagination,
    Table,
    TableCard,
} from "@componentsReact";

import { useQueryClient } from "@tanstack/react-query";

import { useAuth, useApi } from "@hooks";
import { useMetadata } from "@hooks/queries";

import { showModal } from "@utils";

import { GetParams, StationStatus } from "@types";

const StationRolesTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const queryClient = useQueryClient();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [stationRole, setStationRole] = useState<StationStatus | undefined>(
        undefined,
    );

    const [params, setParams] = useState<GetParams>({
        limit: 5,
        offset: 0,
    });

    const [activePage, setActivePage] = useState<number>(1);
    const PAGES_TO_SHOW = 2;

    const {
        roles: stationRoles,
        rolesTotal,
        rolesIsFetching,
        isLoading: loading,
    } = useMetadata(api, {}, params);

    const pages = useMemo(() => {
        if (rolesTotal && params.limit) {
            return Math.ceil(rolesTotal / params.limit);
        }
        return 0;
    }, [rolesTotal, params.limit]);

    useEffect(() => {
        if (!loading && !rolesIsFetching && stationRoles && stationRoles.length === 0 && activePage > 1) {
            handlePage(activePage - 1);
        }
    }, [stationRoles, activePage, loading, rolesIsFetching]); // eslint-disable-line

    const handlePage = (page: number) => {
        setActivePage(page);
        setParams((prev) => ({
            ...prev,
            offset: (page - 1) * (params.limit || 5),
        }));
    };

    const reFetch = () => {
        queryClient.invalidateQueries({
            queryKey: ["metadata", "stationRoles"],
        });
    };

    const titles = ["Name"];

    const body = useMemo(() => {
        return stationRoles
            ?.sort((a, b) => a.name.localeCompare(b.name))
            .map((sr) =>
                Object.values({
                    // id: monument.id,
                    name: sr.name,
                }),
            );
    }, [stationRoles]);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);
    return (
        <TableCard
            title={"Station Roles"}
            size={"650px"}
            addButtonTitle="+ Role"
            modalTitle="EditStationRole"
            setModals={setModals}
            addButton={true}
        >
            <Table
                titles={body && body.length > 0 ? titles : []}
                body={body}
                table={"StationRole"}
                loading={loading}
                dataOnly={false}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "EditStationRole",
                        type: "edit",
                    })
                }
                setState={setStationRole}
                state={stationRoles}
                dataFetchUrl={"api/station-roles"}
            />
            {body && body.length > 0 ? (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={handlePage}
                />
            ) : null}
            {modals?.show && modals.title === "EditStationRole" && (
                <StationRoleModal
                    Role={stationRole}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setRole={setStationRole}
                    reFetch={reFetch}
                />
            )}
        </TableCard>
    );
};

export default StationRolesTable;

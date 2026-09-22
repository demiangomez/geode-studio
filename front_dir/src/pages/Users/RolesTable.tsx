import { useEffect, useMemo, useState } from "react";

import { Pagination, RoleModal, Table, TableCard } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import { useInvalidateUsers, useRoles } from "@hooks/queries";

import { GetParams, Role } from "@types";

import { showModal } from "@utils";

const REGISTERS_PER_PAGE = 5;
const PAGES_TO_SHOW = 2;

const TITLES = ["Name", "Api Role", "All Endpoints Allowed", "Active"];

const RolesTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [role, setRole] = useState<Role | undefined>(undefined);

    const [activePage, setActivePage] = useState<number>(1);

    const params = useMemo<GetParams>(
        () => ({
            limit: REGISTERS_PER_PAGE,
            offset: (activePage - 1) * REGISTERS_PER_PAGE,
        }),
        [activePage],
    );

    const { data, isLoading, isPlaceholderData } = useRoles(api, params);
    const invalidateUsers = useInvalidateUsers();

    const roles = data?.data;
    const pages = data ? Math.ceil(data.total_count / REGISTERS_PER_PAGE) : 0;

    useEffect(() => {
        if (pages > 0 && activePage > pages) setActivePage(pages);
    }, [pages, activePage]);

    const body = useMemo(
        () =>
            (roles ?? []).map((r) => [
                r.name,
                r.role_api,
                r.allow_all,
                r.is_active,
            ]),
        [roles],
    );

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Roles"}
            addButton={true}
            addButtonTitle="+ Role"
            modalTitle={"AddRole"}
            setModals={setModals}
            size="606px"
        >
            <div className={isPlaceholderData ? "opacity-60" : ""}>
                <Table
                    titles={body.length > 0 ? TITLES : []}
                    body={body}
                    loading={isLoading}
                    table={"Roles"}
                    dataOnly={false}
                    onClickFunction={() =>
                        setModals({
                            show: true,
                            title: "AddRole",
                            type: "edit",
                        })
                    }
                    setState={setRole}
                    state={roles}
                    dataFetchUrl="api/roles"
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
            {modals?.show && modals.title === "AddRole" && (
                <RoleModal
                    Role={role}
                    modalType={modals.type}
                    reFetch={invalidateUsers}
                    setRole={setRole}
                    setStateModal={setModals}
                />
            )}
        </TableCard>
    );
};

export default RolesTable;

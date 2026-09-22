import { useEffect, useMemo, useState } from "react";

import { Pagination, Table, TableCard, UsersModal } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import { useInvalidateUsers, useUsers } from "@hooks/queries";

import { GetParams, UsersData } from "@types";

import { showModal } from "@utils";

const REGISTERS_PER_PAGE = 5;
const PAGES_TO_SHOW = 2;

const TITLES = [
    "First Name",
    "Last Name",
    "Username",
    "Role",
    "Email",
    "Phone",
    "Address",
    "Active",
];

const UsersTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [user, setUser] = useState<UsersData | undefined>(undefined);

    const [activePage, setActivePage] = useState<number>(1);

    const params = useMemo<GetParams>(
        () => ({
            limit: REGISTERS_PER_PAGE,
            offset: (activePage - 1) * REGISTERS_PER_PAGE,
        }),
        [activePage],
    );

    const { data, isLoading, isPlaceholderData } = useUsers(api, params);
    const invalidateUsers = useInvalidateUsers();

    const users = data?.data;
    const pages = data ? Math.ceil(data.total_count / REGISTERS_PER_PAGE) : 0;

    // si se borro el ultimo registro de la ultima pagina, la query queda vacia
    useEffect(() => {
        if (pages > 0 && activePage > pages) setActivePage(pages);
    }, [pages, activePage]);

    const body = useMemo(
        () =>
            (users ?? []).map((u) => [
                u.first_name,
                u.last_name,
                u.username,
                u.role.name,
                u.email,
                u.phone,
                u.address,
                u.is_active,
            ]),
        [users],
    );

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Users"}
            addButtonTitle="+ User"
            modalTitle="EditUsers"
            addButton={true}
            setModals={setModals}
            size="1034px"
        >
            <div className={isPlaceholderData ? "opacity-60" : ""}>
                <Table
                    titles={body.length > 0 ? TITLES : []}
                    body={body}
                    table={"Users"}
                    loading={isLoading}
                    dataOnly={false}
                    onClickFunction={() =>
                        setModals({
                            show: true,
                            title: "EditUsers",
                            type: "edit",
                        })
                    }
                    setState={setUser}
                    state={users}
                    dataFetchUrl="api/users"
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
            {modals?.show && modals.title === "EditUsers" && (
                <UsersModal
                    User={user}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setUser={setUser}
                    reFetch={invalidateUsers}
                />
            )}
        </TableCard>
    );
};

export default UsersTable;

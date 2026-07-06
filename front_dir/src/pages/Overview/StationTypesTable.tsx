import { useEffect, useMemo, useState } from "react";
import {
    StationTypesModal,
    Pagination,
    Table,
    TableCard,
} from "@componentsReact";

import { useQueryClient } from "@tanstack/react-query";

import { useAuth, useApi } from "@hooks";
import { useMetadata } from "@hooks/queries";

import { showModal } from "@utils";

import { GetParams, StationTypeData } from "@types";

const StationTypesTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const queryClient = useQueryClient();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [stationType, setStationType] = useState<StationTypeData | undefined>(
        undefined,
    );

    const [params, setParams] = useState<GetParams>({
        limit: 5,
        offset: 0,
    });

    const [activePage, setActivePage] = useState<number>(1);
    const PAGES_TO_SHOW = 2;

    const {
        types: stationTypes,
        typesTotal,
        typesIsFetching,
        isLoading: loading,
    } = useMetadata(api, {}, params);

    const pages = useMemo(() => {
        if (typesTotal && params.limit) {
            return Math.ceil(typesTotal / params.limit);
        }
        return 0;
    }, [typesTotal, params.limit]);

    useEffect(() => {
        if (
            !loading &&
            !typesIsFetching &&
            stationTypes &&
            stationTypes.length === 0 &&
            activePage > 1
        ) {
            handlePage(activePage - 1);
        }
    }, [stationTypes, activePage, loading, typesIsFetching]); // eslint-disable-line

    const handlePage = (page: number) => {
        setActivePage(page);
        setParams((prev) => ({
            ...prev,
            offset: (page - 1) * (params.limit || 5),
        }));
    };

    const reFetch = () => {
        queryClient.invalidateQueries({
            queryKey: ["metadata", "stationTypes"],
        });
    };

    const titles = ["Name", "Image"];

    const body = useMemo(() => {
        return stationTypes
            ?.sort((a, b) => a.name.localeCompare(b.name))
            .map((st) =>
                Object.values({
                    name: st.name,
                    actual_image: st.image,
                }),
            );
    }, [stationTypes]);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Station Types"}
            size={"650px"}
            addButtonTitle="+ Type"
            modalTitle="EditStationType"
            setModals={setModals}
            addButton={true}
        >
            <Table
                titles={body && body.length > 0 ? titles : []}
                body={body}
                table={"types"}
                loading={loading}
                dataOnly={false}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "EditStationType",
                        type: "edit",
                    })
                }
                setState={setStationType}
                state={stationTypes}
                dataFetchUrl={"api/station-types"}
            />
            {body && body.length > 0 ? (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={handlePage}
                />
            ) : null}
            {modals?.show && modals.title === "EditStationType" && (
                <StationTypesModal
                    StationType={stationType}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setStationType={setStationType}
                    reFetch={reFetch}
                />
            )}
        </TableCard>
    );
};

export default StationTypesTable;

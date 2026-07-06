import { useEffect, useMemo, useState } from "react";
import {
    Pagination,
    Table,
    TableCard,
    StationStatusModal,
} from "@componentsReact";

import { useQueryClient } from "@tanstack/react-query";

import { useAuth, useApi } from "@hooks";
import { showModal } from "@utils";

import { useMetadata } from "@hooks/queries";

import { getStationStatusColorsService } from "@services";

import {
    StationStatusData,
    ColorServiceData,
    ColorData,
    GetParams,
} from "@types";

const StationStatusTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const queryClient = useQueryClient();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [status, setStatus] = useState<StationStatusData | undefined>(
        undefined,
    );

    const [params, setParams] = useState<GetParams>({
        limit: 5,
        offset: 0,
    });
    const [colores, setColores] = useState<ColorData[]>([
        { id: 1, color: "green-icon" },
    ]);

    const [activePage, setActivePage] = useState<number>(1);
    const PAGES_TO_SHOW = 2;

    const {
        statuses: stationStatus,
        statusesTotal,
        statusesIsFetching,
        isLoading: loading,
    } = useMetadata(api, {}, params);

    const pages = useMemo(() => {
        if (statusesTotal && params.limit) {
            return Math.ceil(statusesTotal / params.limit);
        }
        return 0;
    }, [statusesTotal, params.limit]);

    useEffect(() => {
        if (!loading && !statusesIsFetching && stationStatus && stationStatus.length === 0 && activePage > 1) {
            handlePage(activePage - 1);
        }
    }, [stationStatus, activePage, loading, statusesIsFetching]); // eslint-disable-line

    const getStationsStatusColors = async () => {
        try {
            const res =
                await getStationStatusColorsService<ColorServiceData>(api);
            if (res.data) {
                setColores(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePage = (page: number) => {
        setActivePage(page);
        setParams((prev) => ({
            ...prev,
            offset: (page - 1) * (params.limit || 5),
        }));
    };

    const titles = ["Name", "Color"];

    const body = useMemo(() => {
        return stationStatus
            ?.sort((a, b) => a.name.localeCompare(b.name))
            .map((st) =>
                Object.values({
                    name: st.name,
                    color_name: st.color,
                }),
            );
    }, [stationStatus]);

    const reFetch = () => {
        queryClient.invalidateQueries({
            queryKey: ["metadata", "stationStatuses"],
        });
    };

    useEffect(() => {
        getStationsStatusColors();
    }, []); // eslint-disable-line

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <TableCard
            title={"Station Status"}
            size={"650px"}
            addButton={true}
            modalTitle={"EditStationStatus"}
            setModals={setModals}
            addButtonTitle={"+ Status"}
        >
            <Table
                titles={body && body.length > 0 ? titles : []}
                body={body}
                table={"Station Status"}
                loading={loading}
                dataOnly={false}
                onClickFunction={() =>
                    setModals({
                        show: true,
                        title: "EditStationStatus",
                        type: "edit",
                    })
                }
                setState={setStatus}
                state={stationStatus}
                dataFetchUrl="api/station-status"
            />
            {body && body.length > 0 ? (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={handlePage}
                />
            ) : null}
            {modals?.show && modals.title === "EditStationStatus" && (
                <StationStatusModal
                    StationStatus={status}
                    modalType={modals.type}
                    setStateModal={setModals}
                    setStationStatus={setStatus}
                    reFetch={reFetch}
                    colores={colores}
                />
            )}
        </TableCard>
    );
};

export default StationStatusTable;

import { useEffect, useMemo, useState } from "react";
import {
    CardContainer,
    EventsDetail,
    EventsFilter,
    EventsTable,
    Pagination,
    TableCard,
} from "@componentsReact";

import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { useAuth, useApi } from "@hooks";
import { useGeneralEvents } from "@hooks/queries";

import {
    buildEventsBody,
    buildEventsTitles,
    normalizeEventDateFilters,
    showModal,
} from "@utils";
import { EVENTS_FILTERS_STATE } from "@utils/reducerFormStates";

import { GetParams, StationEvents } from "@types";

const PAGES_TO_SHOW = 2;
const REGISTERS_PER_PAGE = 8;

const toDatetimeLocalInput = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// arranca mostrando solo el ultimo mes para que la primera carga sea rapida;
// "Clean filters" si limpia del todo, esto es solo el default inicial
const buildDefaultFilters = (): Record<
    keyof typeof EVENTS_FILTERS_STATE,
    any
> => {
    const until = new Date();
    const since = new Date(until);
    since.setMonth(since.getMonth() - 1);
    return {
        ...EVENTS_FILTERS_STATE,
        event_date_since: toDatetimeLocalInput(since),
        event_date_until: toDatetimeLocalInput(until),
    };
};

const Events = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [activePage, setActivePage] = useState<number>(1);
    const [event, setEvent] = useState<StationEvents | undefined>(undefined);

    const [eventsFilter, setEventsFilter] = useState<boolean>(true);
    const [filters, setFilters] =
        useState<Record<keyof typeof EVENTS_FILTERS_STATE, any>>(
            buildDefaultFilters,
        );
    const [appliedFilters, setAppliedFilters] =
        useState<Record<keyof typeof EVENTS_FILTERS_STATE, any>>(
            buildDefaultFilters,
        );

    // por default se muestran los eventos de estaciones con red "vacia"
    // (network_code tipo "?..."), a pedido del cliente
    const [onlyEmptyNetwork, setOnlyEmptyNetwork] = useState<boolean>(true);
    const [appliedOnlyEmptyNetwork, setAppliedOnlyEmptyNetwork] =
        useState<boolean>(true);

    useEffect(() => {
        if (modals?.show) {
            showModal(modals.title);
        }
    }, [modals]);

    const queryParams = useMemo(() => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(appliedFilters)) {
            if (value !== "") cleaned[key] = value;
        }
        const params: GetParams = {
            ...normalizeEventDateFilters(cleaned),
            ...(appliedOnlyEmptyNetwork ? { only_empty_network: true } : {}),
            offset: (activePage - 1) * REGISTERS_PER_PAGE,
            limit: REGISTERS_PER_PAGE,
        };
        return params;
    }, [appliedFilters, appliedOnlyEmptyNetwork, activePage]);

    const { data, isFetching } = useGeneralEvents(api, queryParams);

    const events = data?.data;
    const pages = data ? Math.ceil(data.total_count / REGISTERS_PER_PAGE) : 0;

    const titles = useMemo(() => buildEventsTitles(events, true), [events]);
    const body = useMemo(() => buildEventsBody(events, true), [events]);

    const handlePage = (page: number) => {
        if (page < 1 || page > pages) return;
        setActivePage(page);
    };

    const onSubmit = () => {
        setAppliedFilters(filters);
        setAppliedOnlyEmptyNetwork(onlyEmptyNetwork);
        setActivePage(1);
        setEventsFilter(true);
    };

    const handleCleanFilters = () => {
        setFilters(EVENTS_FILTERS_STATE);
        setAppliedFilters(EVENTS_FILTERS_STATE);
        setOnlyEmptyNetwork(false);
        setAppliedOnlyEmptyNetwork(false);
        setActivePage(1);
        setEventsFilter(false);
    };

    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold"> General Events </span>
            </div>

            <div className="flex flex-grow w-full justify-center pr-2 space-x-2 px-2 pb-4">
                <CardContainer title={""} height={false} addButton={false}>
                    <TableCard title="" size="100%">
                        <div className="w-full flex justify-end">
                            <button
                                className="btn self-end"
                                onClick={() =>
                                    setModals({
                                        show: true,
                                        title: "EventsFilter",
                                        type: "none",
                                    })
                                }
                            >
                                Filter
                                <FunnelIcon className="size-6" />
                            </button>
                            {eventsFilter && (
                                <button
                                    className="btn btn-error btn-circle absolute left-auto right-2"
                                    style={{
                                        width: "25px",
                                        height: "25px",
                                        minHeight: "10px",
                                    }}
                                    onClick={handleCleanFilters}
                                >
                                    <XMarkIcon className="size-5" />
                                </button>
                            )}
                        </div>

                        <EventsTable
                            events={events}
                            titles={titles}
                            body={body}
                            loading={isFetching}
                            onClickFunction={(row: StationEvents) => {
                                setEvent(row);
                                setModals({
                                    show: true,
                                    title: "EventsDetail",
                                    type: "none",
                                });
                            }}
                        />
                        {events && events.length > 0 ? (
                            <Pagination
                                pages={pages}
                                pagesToShow={PAGES_TO_SHOW}
                                activePage={activePage}
                                handlePage={handlePage}
                            />
                        ) : null}
                    </TableCard>
                </CardContainer>
            </div>
            {modals?.show && modals.title === "EventsFilter" && (
                <EventsFilter
                    filters={filters}
                    setStateModal={setModals}
                    setFilters={setFilters}
                    onSubmit={() => {
                        onSubmit();
                    }}
                    handleCleanFilters={() => {
                        handleCleanFilters();
                    }}
                    showNetworkStationFilters={true}
                    onlyEmptyNetwork={onlyEmptyNetwork}
                    setOnlyEmptyNetwork={setOnlyEmptyNetwork}
                />
            )}
            {modals?.show && modals.title === "EventsDetail" && (
                <EventsDetail
                    event={event}
                    setStateModal={setModals}
                    showNetworkStation={true}
                />
            )}
        </div>
    );
};

export default Events;

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosInstance } from "axios";

import {
    Alert,
    ConfirmDeleteModal,
    Pagination,
    Spinner,
    TableCard,
} from "@componentsReact";

import {
    useCampaignPlans,
    useDeleteCampaignPlan,
    useInvalidateCampaignPlans,
} from "@hooks/queries";

import { AlertMsg, CampaignPlanData, GetParams } from "@types";

import { showModal, toAlertMsg } from "@utils";

import {
    PLANNER_WIDTH,
    buildPlannerPayload,
    planToFormValues,
} from "./plannerForm";
import { useRunCampaignPlanner } from "./useRunCampaignPlanner";

const REGISTERS_PER_PAGE = 10;
const PAGES_TO_SHOW = 2;

interface Props {
    api: AxiosInstance;
}

const SavedPlansTable = ({ api }: Props) => {
    const navigate = useNavigate();

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
            name: deferredSearch || undefined,
        }),
        [activePage, deferredSearch],
    );

    const { data, isLoading, isPlaceholderData } = useCampaignPlans(
        api,
        params,
    );
    const invalidatePlans = useInvalidateCampaignPlans();
    const deleteMutation = useDeleteCampaignPlan(api);
    const runner = useRunCampaignPlanner(api);

    const [msg, setMsg] = useState<AlertMsg | undefined>();
    const [runningId, setRunningId] = useState<number | undefined>();
    const [toDelete, setToDelete] = useState<CampaignPlanData | undefined>();

    useEffect(() => {
        toDelete && showModal("ConfirmDelete");
    }, [toDelete]);

    const plans = data?.data ?? [];
    const pages = data ? Math.ceil(data.total_count / REGISTERS_PER_PAGE) : 0;

    // si se borro el ultimo registro de la ultima pagina, la query queda vacia
    const [pagesSeen, setPagesSeen] = useState(pages);
    if (pagesSeen !== pages) {
        setPagesSeen(pages);
        if (pages > 0 && activePage > pages) setActivePage(pages);
    }

    // Abre la pestaña en el click y planifica con los parametros guardados
    const runPlan = (plan: CampaignPlanData) => {
        setMsg(undefined);
        setRunningId(plan.id);
        // Solo se guardan parametros: el plan se recalcula con los mismos del formulario
        runner.run(buildPlannerPayload(planToFormValues(plan)), {
            onSuccess: () => {
                setRunningId(undefined);
                setMsg({
                    status: 200,
                    msg: `Plan "${plan.name}" opened in a new tab`,
                });
            },
            onError: (error) => {
                setRunningId(undefined);
                setMsg(toAlertMsg(error));
            },
        });
    };

    const handleDelete = () => {
        if (!toDelete) return;
        deleteMutation.mutate(toDelete.id, {
            onSuccess: () => {
                invalidatePlans();
                setToDelete(undefined);
                setMsg({ status: 200, msg: "Plan removed" });
            },
            onError: (error) => {
                setToDelete(undefined);
                setMsg(toAlertMsg(error));
            },
        });
    };

    return (
        <TableCard
            title="Saved plans"
            size={PLANNER_WIDTH}
            filters={filters}
            setFilters={setFilters}
            showSearch={true}
            searchPlaceholder="Search by name..."
            headerActions={
                <button
                    type="button"
                    className="btn btn-neutral no-animation"
                    onClick={() => navigate("/campaign-plans/new")}
                >
                    + New plan
                </button>
            }
        >
            <div
                className={`overflow-x-auto pb-2 ${isPlaceholderData ? "opacity-60" : ""}`}
            >
                <table className="table table-zebra bg-neutral-content">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Route</th>
                            <th>Start date</th>
                            <th className="text-right">Stops</th>
                            <th className="text-right">People</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="relative h-[200px]">
                                    <div className="absolute inset-0 flex justify-center items-center">
                                        <Spinner size="lg" />
                                    </div>
                                </td>
                            </tr>
                        ) : plans.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-center opacity-70"
                                >
                                    {deferredSearch
                                        ? "No plans match the search"
                                        : "No saved plans yet"}
                                </td>
                            </tr>
                        ) : (
                            plans.map((plan) => {
                                const stops =
                                    (plan.stations?.length ?? 0) +
                                    (plan.new_sites?.length ?? 0);
                                return (
                                    <tr key={plan.id}>
                                        <td className="font-bold">
                                            {plan.name}
                                        </td>
                                        <td>
                                            {plan.start_city}
                                            {plan.end_city !==
                                                plan.start_city &&
                                                ` → ${plan.end_city}`}
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {plan.start_date}
                                        </td>
                                        <td className="text-right">{stops}</td>
                                        <td className="text-right">
                                            {plan.num_participants}
                                        </td>
                                        <td>
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-ghost"
                                                    title="Load the plan in the planner"
                                                    onClick={() =>
                                                        navigate(
                                                            `/campaign-plans/${plan.id}`,
                                                        )
                                                    }
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-neutral"
                                                    title="Generate the plan in a new tab"
                                                    disabled={runner.isPending}
                                                    onClick={() =>
                                                        runPlan(plan)
                                                    }
                                                >
                                                    Run
                                                    {runningId === plan.id && (
                                                        <span className="loading loading-spinner loading-xs"></span>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-ghost text-error"
                                                    disabled={
                                                        deleteMutation.isPending
                                                    }
                                                    onClick={() =>
                                                        setToDelete(plan)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {plans.length > 0 && (
                <Pagination
                    pages={pages}
                    pagesToShow={PAGES_TO_SHOW}
                    activePage={activePage}
                    handlePage={(page) =>
                        page >= 1 && page <= pages && setActivePage(page)
                    }
                />
            )}

            <Alert msg={msg} />

            {toDelete && (
                <ConfirmDeleteModal
                    mainMsg={`Are you sure you want to delete the plan "${toDelete.name}"?`}
                    loading={deleteMutation.isPending}
                    confirmRemove={handleDelete}
                    closeModal={() => setToDelete(undefined)}
                />
            )}
        </TableCard>
    );
};

export default SavedPlansTable;

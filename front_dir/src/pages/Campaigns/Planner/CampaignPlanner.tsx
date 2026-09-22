import { useParams } from "react-router-dom";

import { TableCard, TableSkeleton } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import { useCampaignPlan } from "@hooks/queries";

import { ApiError } from "@utils";

import BackToPlansLink from "./BackToPlansLink";
import CampaignPlannerForm from "./CampaignPlannerForm";
import { PLANNER_WIDTH } from "./plannerForm";

// Detalle de /campaign-plans: /new (planner vacio) y /:id (precargado con un plan guardado)
const CampaignPlanner = () => {
    const { id } = useParams<{ id: string }>();
    // Un id que no es numero es un link roto, no un plan nuevo
    const invalidId = id !== undefined && !/^\d+$/.test(id);
    const planId = id !== undefined && !invalidId ? Number(id) : undefined;

    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const planQuery = useCampaignPlan(api, planId);

    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold">Campaign Plans</span>
            </div>
            <div className="flex w-full justify-center">
                {invalidId ? (
                    <TableCard
                        title="Planner"
                        size={PLANNER_WIDTH}
                        headerActions={<BackToPlansLink />}
                    >
                        <div className="text-center text-neutral text-xl font-bold rounded-md bg-neutral-content p-6">
                            Saved plan "{id}" does not exist
                        </div>
                    </TableCard>
                ) : planId !== undefined && planQuery.isLoading ? (
                    <TableCard
                        title="Planner"
                        size={PLANNER_WIDTH}
                        headerActions={<BackToPlansLink />}
                    >
                        <TableSkeleton mainSize="400px" />
                    </TableCard>
                ) : planId !== undefined && planQuery.isError ? (
                    <TableCard
                        title="Planner"
                        size={PLANNER_WIDTH}
                        headerActions={<BackToPlansLink />}
                    >
                        <div className="text-center text-neutral text-xl font-bold rounded-md bg-neutral-content p-6">
                            {planQuery.error instanceof ApiError &&
                            planQuery.error.statusCode === 404
                                ? `Saved plan #${planId} does not exist`
                                : planQuery.error.message}
                        </div>
                    </TableCard>
                ) : (
                    // key: cambiar de plan guardado reinicia el formulario
                    <CampaignPlannerForm
                        key={planId ?? "new"}
                        api={api}
                        plan={planId !== undefined ? planQuery.data : undefined}
                    />
                )}
            </div>
        </div>
    );
};

export default CampaignPlanner;

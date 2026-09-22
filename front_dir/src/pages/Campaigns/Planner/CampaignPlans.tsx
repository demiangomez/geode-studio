import { useApi, useAuth } from "@hooks";

import SavedPlansTable from "./SavedPlansTable";

// /campaign-plans: la lista es la pantalla principal; el planner es el detalle
// (/campaign-plans/new y /campaign-plans/:id), como tabla + alta en el resto de la app
const CampaignPlans = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold">Campaign Plans</span>
            </div>
            <div className="flex w-full justify-center">
                <SavedPlansTable api={api} />
            </div>
        </div>
    );
};

export default CampaignPlans;

import { useState } from "react";
import { AxiosInstance } from "axios";

import { useCampaignPlanner } from "@hooks/queries";

import { CampaignPlanParams, CampaignPlannerData } from "@types";

const POPUP_BLOCKED_MSG =
    "The browser blocked the plan tab, allow popups for this site";

const LOADING_HTML = `<!DOCTYPE html><html><head><title>Campaign plan</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;color:#333}</style></head>
<body><h2>Planning campaign…</h2>
<p>Geocoding the cities and routing every leg. This can take up to a minute, keep this tab open.</p>
</body></html>`;

interface RunHandlers {
    onSuccess?: (data: CampaignPlannerData) => void;
    onError?: (error: Error) => void;
}

// Misma mecanica que PdfContainer: la pestaña se abre sincronicamente en el click
// (a prueba del bloqueador de popups) y se le escribe el HTML cuando llega.
// La escritura va en los callbacks del hook y no en los de mutate(): TanStack solo
// corre estos ultimos si el componente sigue montado, y navegar mientras el backend
// rutea (hasta un minuto) dejaba la pestaña colgada en "Planning campaign…".
export const useRunCampaignPlanner = (api: AxiosInstance) => {
    // Pestaña de cada corrida, atada a la identidad del objeto de variables
    const [tabs] = useState(() => new WeakMap<CampaignPlanParams, Window>());

    const mutation = useCampaignPlanner(api, {
        onSuccess: (data, params) => {
            const tab = tabs.get(params);
            if (!tab || tab.closed) return;
            tab.document.open();
            tab.document.write(data.html);
            tab.document.close();
        },
        onError: (_error, params) => {
            const tab = tabs.get(params);
            if (tab && !tab.closed) tab.close();
        },
    });

    const run = (params: CampaignPlanParams, handlers: RunHandlers = {}) => {
        const tab = window.open("", "_blank");
        if (!tab) {
            handlers.onError?.(new Error(POPUP_BLOCKED_MSG));
            return;
        }
        tab.document.write(LOADING_HTML);

        // Copia con identidad propia: dos corridas con los mismos parametros no
        // deben compartir pestaña
        const variables = { ...params };
        tabs.set(variables, tab);
        // Los handlers de la pagina (resumen, Alert) si pueden perderse al desmontar
        mutation.mutate(variables, handlers);
    };

    return { run, isPending: mutation.isPending };
};

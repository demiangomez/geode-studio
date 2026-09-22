import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { AxiosInstance } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StationData } from "@types";

import CampaignPlannerForm from "../CampaignPlannerForm";

// El mapa real trae OpenLayers: acá sólo interesa con qué props lo llama el padre.
// Se guarda cada render para comparar la identidad de las props entre uno y otro:
// si alguna cambia, el `memo` del componente real no lo salvaría de re-renderizar.
const mapRenders: Record<string, unknown>[] = [];
vi.mock("../CampaignPlanMapOL", () => ({
    default: (props: Record<string, unknown>) => {
        mapRenders.push(props);
        return <div data-testid="plan-map" />;
    },
}));
vi.mock("@components/map/MapModalOL", () => ({ default: () => null }));

const STATION: StationData = {
    api_id: 1,
    network_code: "arg",
    station_code: "lhcl",
    station_name: "Las Heras",
    date_start: 0,
    date_end: 0,
    has_gaps: false,
    has_stationinfo: true,
    lat: -32.1,
    lon: -70.0,
    country_code: "ARG",
    gaps: [],
    status: "active",
    type: null,
};

// Identidades estables, como las devuelve TanStack: un objeto nuevo por llamada
// haria cambiar `stations` en cada render y el test acusaria al formulario
const stubs = vi.hoisted(() => ({
    catalog: { data: { data: [] as StationData[] }, isLoading: false },
    geocode: { mutate: () => {}, isPending: false },
    planner: { mutate: () => {}, isPending: false },
}));
stubs.catalog.data.data.push(STATION);

vi.mock("@hooks/queries", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@hooks/queries")>()),
    useStationCatalog: () => stubs.catalog,
    useGeocodeCity: () => stubs.geocode,
    useCampaignPlanner: () => stubs.planner,
}));

const changedProps = (
    before: Record<string, unknown>,
    after: Record<string, unknown>,
) => Object.keys(after).filter((key) => !Object.is(before[key], after[key]));

const renderForm = () => {
    const client = new QueryClient();
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <CampaignPlannerForm
                    api={{} as AxiosInstance}
                    plan={undefined}
                />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("CampaignPlannerForm — el mapa no se re-renderiza al tipear", () => {
    beforeEach(() => {
        mapRenders.length = 0;
    });

    it("tipear en un parámetro numérico deja las props del mapa idénticas", () => {
        renderForm();
        const before = mapRenders[mapRenders.length - 1];
        fireEvent.change(screen.getByLabelText(/Fuel cost/), {
            target: { value: "0.5" },
        });
        const after = mapRenders[mapRenders.length - 1];
        expect(changedProps(before, after)).toEqual([]);
    });

    it("tipear el nombre de una sede nueva deja las props del mapa idénticas", () => {
        renderForm();
        const before = mapRenders[mapRenders.length - 1];
        fireEvent.change(screen.getByLabelText(/Name \(optional\)/), {
            target: { value: "Site X" },
        });
        const after = mapRenders[mapRenders.length - 1];
        expect(changedProps(before, after)).toEqual([]);
    });

    it("buscar una estación deja las props del mapa idénticas", () => {
        renderForm();
        const before = mapRenders[mapRenders.length - 1];
        fireEvent.change(screen.getByPlaceholderText(/Search/i), {
            target: { value: "lh" },
        });
        const after = mapRenders[mapRenders.length - 1];
        expect(changedProps(before, after)).toEqual([]);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@services");

vi.mock("@hooks", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hooks")>();
    return {
        ...actual,
        useApi: () => ({}) as never,
        useAuth: () => ({ token: "test-token", logout: vi.fn() }),
    };
});

const services = await import("@services");
const { renderMetadataModal, stubServices } = await import("./renderModal");

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const metaPayload = () =>
    asMock(services.patchStationMetaService).mock.calls[0];
const stationPayload = () => asMock(services.patchStationService).mock.calls[0];

const openEditor = async () => {
    renderMetadataModal();
    await screen.findByText("General");
    // el form recien queda completo cuando llegan los catalogos
    await waitFor(() => expect(screen.getByText("Continuous")).toBeTruthy());
    await userEvent.click(
        screen.getByTitle("edit").closest("button") as HTMLElement,
    );
};

const save = async () => {
    await userEvent.click(screen.getByRole("button", { name: /update/i }));
    await waitFor(() =>
        expect(asMock(services.patchStationService)).toHaveBeenCalled(),
    );
};

const setField = async (name: string, value: string) => {
    const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement;
    await userEvent.clear(el);
    await userEvent.type(el, value);
};

describe("StationMetadataModal — payloads de los dos PATCH", () => {
    beforeEach(() => {
        stubServices();
    });

    it("manda el meta al endpoint de station-meta con el api_id de la estacion", async () => {
        await openEditor();
        await save();

        const [, id, body] = metaPayload();
        expect(id).toBe(42);
        expect(Object.keys(body as object).sort()).toEqual([
            "battery_description",
            "comments",
            "communications_description",
            "has_battery",
            "has_communications",
            "monument_type",
            "navigation_file_delete",
            "remote_access_link",
            "station",
            "station_type",
            "status",
        ]);
    });

    it("traduce los catalogos de nombre a id en el meta", async () => {
        await openEditor();
        await save();

        expect(metaPayload()[2]).toMatchObject({
            station_type: 1,
            monument_type: 3,
            status: 2,
            station: "42",
            has_battery: true,
            has_communications: false,
            remote_access_link: "https://example.org/cost",
            battery_description: "Two 12V batteries",
            communications_description: "4G modem",
            navigation_file_delete: false,
        });
    });

    it("manda el station al endpoint de stations con el api_id", async () => {
        await openEditor();
        await save();

        const [, id, body] = stationPayload();
        expect(id).toBe(42);
        expect(Object.keys(body as object).sort()).toEqual([
            "auto_x",
            "auto_y",
            "auto_z",
            "dome",
            "harpos_coeff_otl",
            "harpos_coeff_otl_by_file",
            "height",
            "lat",
            "lon",
            "max_dist",
            "plate",
            "station_name",
        ]);
    });

    it("manda las coordenadas y los campos de station sin tocar", async () => {
        await openEditor();
        await save();

        expect(stationPayload()[2]).toMatchObject({
            lat: "-34.60371000",
            lon: "-58.38156000",
            height: "25.123",
            auto_x: "2750000.123",
            auto_y: "-4478000.456",
            auto_z: "-3598000.789",
            dome: "41001M001",
            max_dist: "150",
            station_name: "Costa Station",
            harpos_coeff_otl: "OTL COEFFS",
        });
    });

    it("manda el codigo de 2 letras de la placa, no el nombre", async () => {
        await openEditor();
        await save();

        expect(stationPayload()[2]).toMatchObject({ plate: "SA" });
    });

    it("manda la placa elegida por el usuario", async () => {
        await openEditor();

        const plate = document.querySelector(
            'select[name="station.plate"]',
        ) as HTMLSelectElement;
        await userEvent.selectOptions(plate, "NA");
        await save();

        expect(stationPayload()[2]).toMatchObject({ plate: "NA" });
    });

    it("manda la placa vacia cuando el usuario la deja en auto", async () => {
        await openEditor();

        const plate = document.querySelector(
            'select[name="station.plate"]',
        ) as HTMLSelectElement;
        await userEvent.selectOptions(plate, "");
        await save();

        expect(stationPayload()[2]).toMatchObject({ plate: "" });
    });

    it("recalcula ECEF cuando cambia la latitud", async () => {
        await openEditor();
        await setField("station.lat", "-30");
        await save();

        // valores verificados contra una implementacion WGS84 independiente
        const body = stationPayload()[2] as Record<string, string>;
        expect(body.lat).toBe("-30");
        expect(body.auto_x).toBe("2898255.218");
        expect(body.auto_y).toBe("-4707651.083");
        expect(body.auto_z).toBe("-3170386.297");
    });

    it("recalcula geodesicas cuando cambian las cartesianas", async () => {
        await openEditor();
        await setField("station.auto_x", "2750001");

        const lat = document.querySelector(
            '[name="station.lat"]',
        ) as HTMLInputElement;
        expect(lat.value).not.toBe("-34.60371000");
    });

    it("con OTL por archivo no manda harpos_coeff_otl", async () => {
        await openEditor();
        await userEvent.click(screen.getByRole("button", { name: "By File" }));
        await save();

        const body = stationPayload()[2] as Record<string, unknown>;
        expect(body).not.toHaveProperty("harpos_coeff_otl");
        expect(body).toHaveProperty("harpos_coeff_otl_by_file");
    });

    it("con OTL manual no manda harpos_coeff_otl_by_file", async () => {
        await openEditor();
        await userEvent.click(screen.getByRole("button", { name: "Manual" }));
        await save();

        const body = stationPayload()[2] as Record<string, unknown>;
        expect(body).toHaveProperty("harpos_coeff_otl");
        expect(body).not.toHaveProperty("harpos_coeff_otl_by_file");
    });

    it("dispara los dos PATCH exactamente una vez por click", async () => {
        await openEditor();
        await save();

        expect(asMock(services.patchStationMetaService)).toHaveBeenCalledTimes(
            1,
        );
        expect(asMock(services.patchStationService)).toHaveBeenCalledTimes(1);
    });
});

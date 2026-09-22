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

const { renderMetadataModal, stubServices } = await import("./renderModal");

/**
 * Inventario de los campos que el modal muestra hoy. Existe para que el
 * refactor del render no pueda perder un campo en silencio.
 */
const GENERAL_FIELDS = [
    "Station Type",
    "Monument",
    "Status",
    "Remote Access Link",
    "Station Name",
    "Domes Number",
    "Max distance",
    "Tectonic Plate",
];

const OTHER_FIELDS = [
    "Battery",
    "Communications",
    "First rinex",
    "Last rinex",
    "Navigation File",
    "Latitude",
    "Longitude",
    "Height",
    "X",
    "Y",
    "Z",
    "Antenna Code",
    "Antenna Serial",
    "Height Code",
    "Receiver Code",
    "Receiver Serial",
    "Receiver Version",
    "Radome Code",
];

const CARDS = [
    "General",
    "Comments",
    "Attached Files",
    "Ocean Tide Loading Model",
    "Geodetic Coordinates",
    "Cartesian Coordinates",
    "Equipment",
];

// El label y su valor comparten el div contenedor
const readField = (label: string) => {
    const labelEl = screen.getByText(label);
    const text = labelEl.parentElement?.textContent ?? "";
    return text.slice(text.indexOf(label) + label.length).trim();
};

const enterEditMode = async () => {
    const pencil = screen.getByTitle("edit").closest("button");
    await userEvent.click(pencil as HTMLElement);
};

describe("StationMetadataModal — inventario de campos", () => {
    beforeEach(() => {
        stubServices();
    });

    it("renderiza todas las cards", async () => {
        renderMetadataModal();

        for (const card of CARDS) {
            expect(await screen.findByText(card)).toBeInTheDocument();
        }
    });

    it("muestra los campos de General en modo lectura", async () => {
        renderMetadataModal();
        await screen.findByText("General");

        for (const label of [...GENERAL_FIELDS, ...OTHER_FIELDS]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it("resuelve los catalogos a su nombre legible", async () => {
        renderMetadataModal();
        await screen.findByText("General");

        await waitFor(() => {
            expect(readField("Station Type")).toBe("Continuous");
        });
        expect(readField("Monument")).toBe("Concrete pillar");
        expect(readField("Status")).toBe("Active");
    });

    it("muestra la placa tectonica como 'Nombre (CODIGO)'", async () => {
        renderMetadataModal();
        await screen.findByText("General");

        await waitFor(() => {
            expect(readField("Tectonic Plate")).toBe("South America (SA)");
        });
    });

    it("muestra los valores de station en modo lectura", async () => {
        renderMetadataModal();
        await screen.findByText("General");

        await waitFor(() => {
            expect(readField("Station Name")).toBe("Costa Station");
        });
        expect(readField("Domes Number")).toBe("41001M001");
        expect(readField("Max distance")).toBe("150");
        expect(readField("X")).toBe("2750000.123 m");
        expect(readField("Y")).toBe("-4478000.456 m");
        expect(readField("Z")).toBe("-3598000.789 m");
    });

    it("muestra 'No info' cuando el campo esta vacio", async () => {
        const { getStationsService } = await import("@services");
        (getStationsService as ReturnType<typeof vi.fn>).mockResolvedValue({
            count: 1,
            total_count: 1,
            statusCode: 200,
            data: [{ ...(await import("./fixtures")).STATION, dome: "" }],
        });

        renderMetadataModal();
        await screen.findByText("General");

        await waitFor(() => {
            expect(readField("Domes Number")).toBe("No info");
        });
    });

    it("en edicion expone los campos editables con su valor actual", async () => {
        renderMetadataModal();
        await screen.findByText("General");
        await waitFor(() =>
            expect(readField("Station Type")).toBe("Continuous"),
        );

        await enterEditMode();

        const stationName = document.querySelector(
            'input[name="station.station_name"]',
        ) as HTMLInputElement;
        expect(stationName.value).toBe("Costa Station");

        const maxDist = document.querySelector(
            'input[name="station.max_dist"]',
        ) as HTMLInputElement;
        expect(maxDist.value).toBe("150");

        const lat = document.querySelector(
            'input[name="station.lat"]',
        ) as HTMLInputElement;
        expect(lat.value).toBe("-34.60371000");
    });

    it("en edicion la placa es un select precargado con el codigo, mostrando 'Nombre (CODIGO)'", async () => {
        renderMetadataModal();
        await screen.findByText("General");
        await waitFor(() =>
            expect(readField("Tectonic Plate")).toBe("South America (SA)"),
        );

        await enterEditMode();

        const plate = document.querySelector(
            'select[name="station.plate"]',
        ) as HTMLSelectElement;
        expect(plate).not.toBeNull();
        expect(plate.value).toBe("SA");
        expect(
            (plate.querySelector('option[value="SA"]') as HTMLOptionElement)
                .textContent,
        ).toBe("South America (SA)");
    });
});

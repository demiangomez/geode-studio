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
const { STATION, STATION_META, listResponse } = await import("./fixtures");

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// Forma del error que useApi devuelve resuelto en vez de rechazar
const apiError = (attr: string, code = "invalid") => ({
    msg: "Request failed",
    status: "error",
    statusCode: 400,
    response: {
        type: "validation_error",
        errors: [{ code, attr, detail: `${attr} is invalid` }],
    },
});

const openEditor = async () => {
    const utils = renderMetadataModal();
    await screen.findByText("General");
    await waitFor(() => expect(screen.getByText("Continuous")).toBeTruthy());
    await userEvent.click(
        screen.getByTitle("edit").closest("button") as HTMLElement,
    );
    return utils;
};

const save = async () => {
    await userEvent.click(screen.getByRole("button", { name: /update/i }));
    await waitFor(() =>
        expect(asMock(services.patchStationService)).toHaveBeenCalled(),
    );
};

describe("StationMetadataModal — estados y mensajes", () => {
    beforeEach(() => {
        stubServices();
    });

    it("muestra el skeleton hasta que resuelven los fetch iniciales", async () => {
        let resolveStation: (v: unknown) => void = () => {};
        asMock(services.getStationsService).mockReturnValue(
            new Promise((res) => {
                resolveStation = res;
            }),
        );

        renderMetadataModal();

        expect(screen.queryByText("General")).not.toBeInTheDocument();

        resolveStation({
            count: 1,
            total_count: 1,
            statusCode: 200,
            data: [STATION],
        });
        expect(await screen.findByText("General")).toBeInTheDocument();
    });

    it("con los dos PATCH en 200 muestra un mensaje de exito combinado", async () => {
        await openEditor();
        await save();

        expect(
            await screen.findByText(
                "Metadata and station updated successfully",
            ),
        ).toBeInTheDocument();
    });

    it("no explota si una mutation resuelve antes que la otra (son dos requests independientes)", async () => {
        let resolveMeta: (v: unknown) => void = () => {};
        asMock(services.patchStationMetaService).mockReturnValue(
            new Promise((res) => {
                resolveMeta = res;
            }),
        );

        await openEditor();
        await userEvent.click(screen.getByRole("button", { name: /update/i }));

        // station ya resolvio (mock sincrono), meta todavia no: este es el
        // render intermedio que antes tiraba "failed is undefined"
        await waitFor(() =>
            expect(asMock(services.patchStationService)).toHaveBeenCalled(),
        );
        expect(
            screen.getByRole("button", { name: /update/i }),
        ).toBeInTheDocument();

        resolveMeta({ ...STATION_META, statusCode: 200 });

        expect(
            await screen.findByText(
                "Metadata and station updated successfully",
            ),
        ).toBeInTheDocument();
    });

    it("con los dos PATCH en 200 relee station y station-meta", async () => {
        await openEditor();
        asMock(services.getStationsService).mockClear();
        asMock(services.getStationMetaService).mockClear();

        await save();

        await waitFor(() => {
            expect(asMock(services.getStationsService)).toHaveBeenCalledTimes(
                1,
            );
            expect(
                asMock(services.getStationMetaService),
            ).toHaveBeenCalledTimes(1);
        });
    });

    it("se queda en modo edicion despues de guardar bien, mostrando el mensaje", async () => {
        await openEditor();
        await save();

        // no debe sacar al usuario de edicion solo porque guardo bien: el
        // mensaje de exito tiene que seguir visible, no desaparecer con el
        await new Promise((r) => setTimeout(r, 1200));
        expect(
            screen.getByRole("button", { name: /update/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Metadata and station updated successfully"),
        ).toBeInTheDocument();
    });

    it("al salir y volver a entrar en modo edicion no reaparece el mensaje viejo", async () => {
        await openEditor();
        await save();
        expect(
            await screen.findByText(
                "Metadata and station updated successfully",
            ),
        ).toBeInTheDocument();

        const pencil = screen.getByTitle("edit").closest("button");
        await userEvent.click(pencil as HTMLElement); // sale de edicion
        await userEvent.click(pencil as HTMLElement); // vuelve a entrar

        expect(
            screen.queryByText("Metadata and station updated successfully"),
        ).not.toBeInTheDocument();
    });

    it("marca el campo cuyo error devuelve el PATCH de station-meta", async () => {
        asMock(services.patchStationMetaService).mockResolvedValue(
            apiError("remote_access_link"),
        );

        await openEditor();
        await save();

        const input = document.querySelector(
            '[name="meta.remote_access_link"]',
        ) as HTMLElement;
        await waitFor(() => {
            expect(input.closest("label")?.className).toContain("input-error");
        });
    });

    it("marca el campo cuyo error devuelve el PATCH de station", async () => {
        asMock(services.patchStationService).mockResolvedValue(
            apiError("max_dist"),
        );

        await openEditor();
        await save();

        const input = document.querySelector(
            '[name="station.max_dist"]',
        ) as HTMLElement;
        await waitFor(() => {
            expect(input.closest("label")?.className).toContain("input-error");
        });
    });

    it("marca el error de OTL con el PATCH de station, no el de meta", async () => {
        // el badge muestra el "code" del error, no el "detail"
        asMock(services.patchStationService).mockResolvedValue(
            apiError("harpos_coeff_otl", "otl_invalid"),
        );

        await openEditor();
        await save();

        expect(await screen.findByText("otl_invalid")).toBeInTheDocument();
    });

    it("marca el error de placa que devuelve el backend", async () => {
        asMock(services.patchStationService).mockResolvedValue(
            apiError("plate"),
        );

        await openEditor();
        await save();

        const plate = document.querySelector(
            '[name="station.plate"]',
        ) as HTMLElement;
        await waitFor(() => {
            expect(plate.closest("label")?.className).toContain("input-error");
        });
    });

    // Etapa 4: el refetch al padre se dispara cuando algun PATCH escribio,
    // no al cerrar el modal (antes era al reves). El padre lo necesita
    // porque StationMain lee lat/lon de su copia de `station` para ubicar
    // el marcador en el mapa de la pagina de la estacion.
    describe("refetch (arreglado en la Etapa 4)", () => {
        it("avisa al padre despues de guardar bien", async () => {
            const { refetch } = await openEditor();
            await save();

            await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        });

        it("le pasa al padre station y stationMeta ya frescos (evita GETs duplicados)", async () => {
            const { refetch } = await openEditor();
            asMock(services.getStationsService).mockResolvedValue(
                listResponse([{ ...STATION, height: 999 }]),
            );
            asMock(services.getStationMetaService).mockResolvedValue({
                ...STATION_META,
                remote_access_link: "https://example.org/nuevo",
            });

            await save();

            await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
            expect(refetch.mock.calls[0][0]).toMatchObject({ height: 999 });
            expect(refetch.mock.calls[0][1]).toMatchObject({
                remote_access_link: "https://example.org/nuevo",
            });
        });

        it("NO avisa al padre al cerrar sin haber guardado nada", async () => {
            const { refetch, container } = renderMetadataModal();
            await screen.findByText("General");

            container
                .querySelector("dialog")
                ?.dispatchEvent(new Event("close"));

            expect(refetch).not.toHaveBeenCalled();
        });
    });

    describe("partial failure — mensaje (arreglado en la migracion a useMutation)", () => {
        it("con meta 200 y station 400 dice explicitamente que fue parcial", async () => {
            asMock(services.patchStationService).mockResolvedValue(
                apiError("max_dist"),
            );

            await openEditor();
            await save();

            expect(
                await screen.findByText(
                    /Station update failed \(the other half was saved\)/,
                ),
            ).toBeInTheDocument();
            // el texto viejo, que sonaba a exito total, ya no aparece solo
            expect(
                screen.queryByText("Metadata updated successfully"),
            ).not.toBeInTheDocument();
        });

        it("con station 200 y meta 400 tambien lo marca como parcial", async () => {
            asMock(services.patchStationMetaService).mockResolvedValue(
                apiError("remote_access_link"),
            );

            await openEditor();
            await save();

            expect(
                await screen.findByText(
                    /Metadata update failed \(the other half was saved\)/,
                ),
            ).toBeInTheDocument();
        });

        it("si los dos PATCH fallan combina los dos mensajes", async () => {
            asMock(services.patchStationMetaService).mockResolvedValue(
                apiError("remote_access_link"),
            );
            asMock(services.patchStationService).mockResolvedValue(
                apiError("max_dist"),
            );

            await openEditor();
            await save();

            const alert = await screen.findByRole("alert");
            expect(alert.textContent).toMatch(/remote_access_link is invalid/);
            expect(alert.textContent).toMatch(/max_dist is invalid/);
        });
    });

    describe("partial failure — refetch (arreglado en la Etapa 4)", () => {
        it("con meta 200 y station 400 relee el recurso que si escribio", async () => {
            asMock(services.patchStationService).mockResolvedValue(
                apiError("max_dist"),
            );

            await openEditor();
            asMock(services.getStationMetaService).mockClear();
            asMock(services.getStationsService).mockClear();
            await save();

            // meta si se guardo -> se relee. station fallo -> no tiene
            // sentido releerlo, el form sigue con el borrador del usuario
            await waitFor(() =>
                expect(
                    asMock(services.getStationMetaService),
                ).toHaveBeenCalledTimes(1),
            );
            expect(asMock(services.getStationsService)).not.toHaveBeenCalled();
        });

        it("con meta 200 y station 400 igual avisa al padre", async () => {
            const { refetch } = await openEditor();
            asMock(services.patchStationService).mockResolvedValue(
                apiError("max_dist"),
            );

            await save();

            await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
        });

        it("trae el valor nuevo del campo que si se guardo", async () => {
            asMock(services.patchStationService).mockResolvedValue(
                apiError("max_dist"),
            );

            await openEditor();

            // recien ahora el server "tiene" el valor nuevo: el refetch
            // posterior al guardado (Etapa 4) lo trae
            asMock(services.getStationMetaService).mockResolvedValue({
                ...STATION_META,
                remote_access_link: "https://example.org/nuevo",
            });

            await save();

            const input = document.querySelector(
                '[name="meta.remote_access_link"]',
            ) as HTMLInputElement;
            await waitFor(() =>
                expect(input.value).toBe("https://example.org/nuevo"),
            );
        });
    });
});

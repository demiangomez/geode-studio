import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const layers: { id: number }[] = [];
const parseDeferreds: { resolve: (v: unknown[]) => void }[] = [];

vi.mock("@olUtils", () => ({
    parseKmlFromBase64: vi.fn(
        () =>
            new Promise<unknown[]>((resolve) => {
                parseDeferreds.push({ resolve });
            }),
    ),
    createKmlLayer: vi.fn(() => {
        const layer = { id: layers.length + 1 };
        layers.push(layer);
        return layer;
    }),
    getLastZoom: vi.fn(() => 12),
}));

import { useKmlLayer } from "../useKmlLayer";

const flush = () => new Promise((r) => setTimeout(r, 0));

const setup = () => {
    const map = { addLayer: vi.fn(), removeLayer: vi.fn() };
    const mapInstance = { current: map as any };
    const { result } = renderHook(() => useKmlLayer({ mapInstance }));
    return { map, result };
};

describe("useKmlLayer", () => {
    beforeEach(() => {
        layers.length = 0;
        parseDeferreds.length = 0;
    });

    it("dos loadKml solapados dejan una sola capa, que clearKml remueve", async () => {
        const { map, result } = setup();

        act(() => {
            result.current.loadKml("AAAA", { fitView: false });
            result.current.loadKml("AAAA", { fitView: false });
        });
        expect(parseDeferreds).toHaveLength(2);

        await act(async () => {
            parseDeferreds[0].resolve([{}]);
            await flush();
            parseDeferreds[1].resolve([{}]);
            await flush();
        });

        expect(map.addLayer).toHaveBeenCalledTimes(1);
        const added = map.addLayer.mock.calls[0][0];

        act(() => {
            result.current.clearKml();
        });

        expect(map.removeLayer).toHaveBeenCalledTimes(1);
        expect(map.removeLayer).toHaveBeenCalledWith(added);
    });

    it("clearKml durante una carga en vuelo descarta esa carga", async () => {
        const { map, result } = setup();

        act(() => {
            result.current.loadKml("AAAA", { fitView: false });
            result.current.clearKml();
        });

        await act(async () => {
            parseDeferreds[0].resolve([{}]);
            await flush();
        });

        expect(map.addLayer).not.toHaveBeenCalled();
    });
});

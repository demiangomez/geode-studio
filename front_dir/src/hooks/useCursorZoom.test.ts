import { describe, it, expect } from "vitest";
import { getContentBox, getAxisPanRange } from "./useCursorZoom";

// helper: aplica el transform (origin + pan + scale) a un punto de la caja,
// para verificar donde termina el borde del contenido despues del pan
const mapPoint = (p: number, originPx: number, panPx: number, zoom: number) =>
    originPx + panPx + (p - originPx) * zoom;

describe("getContentBox", () => {
    it("sin aspectRatio, el contenido ocupa la caja entera", () => {
        expect(getContentBox({ width: 1000, height: 600 }, undefined)).toEqual({
            left: 0,
            top: 0,
            width: 1000,
            height: 600,
        });
    });

    it("imagen retrato en una caja panoramica: letterbox en el ancho", () => {
        const content = getContentBox({ width: 1000, height: 600 }, 3 / 4);
        expect(content.height).toBe(600);
        expect(content.width).toBeCloseTo(450);
        expect(content.left).toBeCloseTo(275);
        expect(content.top).toBe(0);
    });

    it("imagen panoramica en una caja mas cuadrada: letterbox en el alto", () => {
        const content = getContentBox({ width: 800, height: 800 }, 16 / 9);
        expect(content.width).toBe(800);
        expect(content.height).toBeCloseTo(450);
        expect(content.top).toBeCloseTo(175);
        expect(content.left).toBe(0);
    });
});

describe("getAxisPanRange", () => {
    it("con contenido = caja entera, matchea la formula original (sin letterbox)", () => {
        const boxSize = 1000;
        for (const zoom of [1.5, 2, 3, 4]) {
            for (const originFrac of [0, 0.25, 0.5, 0.75, 1]) {
                const originPx = originFrac * boxSize;
                const originalMin = (1 - originFrac) * boxSize * (1 - zoom);
                const originalMax = originFrac * boxSize * (zoom - 1);
                const [min, max] = getAxisPanRange(
                    boxSize,
                    0,
                    boxSize,
                    originPx,
                    zoom,
                );
                expect(min).toBeCloseTo(originalMin);
                expect(max).toBeCloseTo(originalMax);
            }
        }
    });

    it("con contenido angosto (retrato), el rango nunca queda invertido", () => {
        const rect = { width: 1000, height: 600 };
        const content = getContentBox(rect, 3 / 4);
        for (const zoom of [1.1, 1.5, 2, 2.5, 3, 4]) {
            for (const originFrac of [0, 0.25, 0.5, 0.75, 1]) {
                const originPx = originFrac * rect.width;
                const [min, max] = getAxisPanRange(
                    rect.width,
                    content.left,
                    content.width,
                    originPx,
                    zoom,
                );
                expect(min).toBeLessThanOrEqual(max + 1e-9);
            }
        }
    });

    it("cuando el contenido escalado ya cubre la caja, cualquier pan del rango deja los bordes reales dentro del viewport", () => {
        const rect = { width: 1000, height: 600 };
        const content = getContentBox(rect, 3 / 4);
        const zoom = 3; // 450*3=1350 > 1000, ya cubre el ancho
        const originFrac = 0.3;
        const originPx = originFrac * rect.width;
        const [min, max] = getAxisPanRange(
            rect.width,
            content.left,
            content.width,
            originPx,
            zoom,
        );
        for (const pan of [min, (min + max) / 2, max]) {
            const left = mapPoint(content.left, originPx, pan, zoom);
            const right = mapPoint(
                content.left + content.width,
                originPx,
                pan,
                zoom,
            );
            expect(left).toBeLessThanOrEqual(1e-6);
            expect(right).toBeGreaterThanOrEqual(rect.width - 1e-6);
        }
    });

    it("cuando el contenido escalado sigue siendo mas chico que la caja, no hay rango (min=max) y queda centrado", () => {
        const rect = { width: 1000, height: 600 };
        const content = getContentBox(rect, 3 / 4); // width=450
        const zoom = 2; // 450*2=900 < 1000, todavia no cubre
        const originPx = 0.5 * rect.width;
        const [min, max] = getAxisPanRange(
            rect.width,
            content.left,
            content.width,
            originPx,
            zoom,
        );
        expect(min).toBeCloseTo(max);
        const left = mapPoint(content.left, originPx, min, zoom);
        const right = mapPoint(
            content.left + content.width,
            originPx,
            min,
            zoom,
        );
        // centrado: el hueco sobrante se reparte igual a los dos lados
        expect(left).toBeCloseTo(rect.width - right);
    });
});

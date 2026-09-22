import { describe, it, expect } from "vitest";
import { ApiError, isApiErrorResponse, unwrapApiResponse } from "./apiError";

describe("unwrapApiResponse", () => {
    it("deja pasar una respuesta 200 normal", () => {
        const ok = { count: 2, total_count: 2, data: [], statusCode: 200 };
        expect(unwrapApiResponse(ok as never)).toBe(ok);
    });

    it("deja pasar 201 y el 204 sintetizado por el interceptor", () => {
        expect(isApiErrorResponse({ statusCode: 201 })).toBe(false);
        expect(
            isApiErrorResponse({
                msg: "Deleted Succesfully",
                response: "",
                status: "success",
                statusCode: 204,
            }),
        ).toBe(false);
    });

    it("no confunde un payload con campo status propio", () => {
        expect(isApiErrorResponse({ status: "ok", statusCode: 200 })).toBe(
            false,
        );
        // StationData trae `status` (estado de la estacion) pero anidado
        expect(
            isApiErrorResponse({
                statusCode: 200,
                data: [{ station_code: "abcd", status: "error" }],
            }),
        ).toBe(false);
    });

    it("tira ApiError con el detalle del backend en un 403", () => {
        const res = {
            msg: "Request failed with status code 403",
            response: {
                type: "client_error",
                errors: [
                    {
                        code: "permission_denied",
                        detail: "No tenes permiso",
                        attr: null,
                    },
                ],
            },
            status: "error",
            statusCode: 403,
        };
        try {
            unwrapApiResponse(res as never);
            expect.unreachable();
        } catch (e) {
            expect(e).toBeInstanceOf(ApiError);
            expect((e as ApiError).statusCode).toBe(403);
            expect((e as ApiError).message).toBe("No tenes permiso");
        }
    });

    it("tira ApiError en un error de red (statusCode 0, sin response)", () => {
        const res = {
            msg: "Network Error",
            response: undefined,
            status: "error",
            statusCode: 0,
        };
        expect(() => unwrapApiResponse(res as never)).toThrow(ApiError);
        try {
            unwrapApiResponse(res as never);
        } catch (e) {
            expect((e as ApiError).message).toBe("Network Error");
        }
    });

    it("tira si el statusCode no es ok aunque falte status", () => {
        expect(() => unwrapApiResponse({ statusCode: 500 } as never)).toThrow(
            ApiError,
        );
    });
});

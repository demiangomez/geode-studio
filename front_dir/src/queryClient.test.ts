import { describe, expect, it } from "vitest";

import { ApiError } from "@utils/apiError";

import { queryClient } from "./queryClient";

const retry = queryClient.getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: Error,
) => boolean;

const apiError = (statusCode: number) =>
    new ApiError({
        msg: "Request failed",
        status: "error",
        statusCode,
        response: {
            type: "client_error",
            errors: [{ code: "error", detail: "detail", attr: "" }],
        },
    });

describe("queryClient retry", () => {
    it("no reintenta un 4xx: la respuesta va a ser la misma", () => {
        expect(retry(0, apiError(400))).toBe(false);
        expect(retry(0, apiError(403))).toBe(false);
        expect(retry(0, apiError(404))).toBe(false);
    });

    it("reintenta una sola vez red caida y 5xx", () => {
        expect(retry(0, apiError(500))).toBe(true);
        expect(retry(0, apiError(0))).toBe(true);
        expect(retry(0, new Error("Network Error"))).toBe(true);
        expect(retry(1, apiError(500))).toBe(false);
    });
});

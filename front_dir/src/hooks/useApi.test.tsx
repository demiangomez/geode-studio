import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AxiosError, AxiosInstance } from "axios";

import useApi from "./useApi";
import { UserContext } from "./user/userInfo.context";
import { initialState } from "./user/useUserInfo.reducer";

// axios no expone `handlers` en su tipado publico, pero es la unica forma de
// invocar el interceptor de error directamente sin pegarle a la red de verdad
const getRejectedInterceptor = (api: AxiosInstance) => {
    const handlers = (api.interceptors.response as any).handlers;
    return handlers[0].rejected as (error: AxiosError) => unknown;
};

describe("useApi — interceptor de 403", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("no explota si el 403 viene sin body (proxy/gateway sin JSON, ej. red inestable)", () => {
        const dispatch = vi.fn();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <UserContext.Provider value={{ state: initialState, dispatch }}>
                {children}
            </UserContext.Provider>
        );

        const { result } = renderHook(() => useApi("token", vi.fn()), {
            wrapper,
        });
        const rejected = getRejectedInterceptor(result.current);

        expect(() => {
            rejected({
                response: { status: 403, data: undefined },
                config: { method: "get", url: "/api/algo" },
                message: "Request failed with status code 403",
            } as AxiosError);
            vi.advanceTimersByTime(50);
        }).not.toThrow();

        const unauthorize = dispatch.mock.calls.find(
            ([action]) => action.type === "UNAUTHORIZE",
        )?.[0];
        expect(unauthorize?.msg).toBe("Request failed with status code 403");
    });

    it("sigue extrayendo el detail del backend en un 403 con body normal", () => {
        const dispatch = vi.fn();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <UserContext.Provider value={{ state: initialState, dispatch }}>
                {children}
            </UserContext.Provider>
        );

        const { result } = renderHook(() => useApi("token", vi.fn()), {
            wrapper,
        });
        const rejected = getRejectedInterceptor(result.current);

        rejected({
            response: {
                status: 403,
                data: {
                    type: "client_error",
                    errors: [
                        {
                            code: "permission_denied",
                            detail: "No tenes permiso",
                            attr: null,
                        },
                    ],
                },
            },
            config: { method: "get", url: "/api/algo" },
            message: "Request failed with status code 403",
        } as AxiosError);
        vi.advanceTimersByTime(50);

        const unauthorize = dispatch.mock.calls.find(
            ([action]) => action.type === "UNAUTHORIZE",
        )?.[0];
        expect(unauthorize?.msg).toBe("No tenes permiso");
    });
});

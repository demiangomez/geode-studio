import { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@services");

const services = await import("@services");
const { useUsers } = await import("../useUsers");

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const page = (offset: number) => ({
    count: 5,
    total_count: 12,
    statusCode: 200,
    data: Array.from({ length: 5 }, (_, i) => ({
        id: offset + i,
        username: `user${offset + i}`,
    })),
});

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

const renderUsers = () =>
    renderHook(
        ({ offset }: { offset: number }) =>
            useUsers({} as never, { limit: 5, offset }),
        { wrapper: createWrapper(), initialProps: { offset: 0 } },
    );

describe("useUsers", () => {
    it("conserva la pagina anterior mientras carga la nueva y sirve del cache una ya visitada", async () => {
        asMock(services.getUsersService).mockImplementation(
            async (_api: unknown, params: { offset: number }) =>
                page(params.offset),
        );

        const { result, rerender } = renderUsers();
        await waitFor(() =>
            expect(result.current.data?.data[0].username).toBe("user0"),
        );

        rerender({ offset: 5 });
        expect(result.current.isPlaceholderData).toBe(true);
        expect(result.current.data?.data[0].username).toBe("user0");
        await waitFor(() =>
            expect(result.current.data?.data[0].username).toBe("user5"),
        );

        rerender({ offset: 0 });
        expect(result.current.isPlaceholderData).toBe(false);
        expect(result.current.data?.data[0].username).toBe("user0");
        expect(services.getUsersService).toHaveBeenCalledTimes(2);
    });

    it("marca error cuando useApi resuelve un 403 en vez de cachearlo como data", async () => {
        asMock(services.getUsersService).mockResolvedValue({
            msg: "Request failed",
            status: "error",
            statusCode: 403,
            response: {
                type: "client_error",
                errors: [
                    {
                        code: "permission_denied",
                        detail: "no",
                        attr: null,
                    },
                ],
            },
        });

        const { result } = renderUsers();
        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.data).toBeUndefined();
    });
});

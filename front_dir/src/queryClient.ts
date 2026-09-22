import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@utils/apiError";

// Un 4xx (403 sin permiso, 404) devuelve lo mismo al reintentar: el retry
// queda solo para red caida y 5xx
const isClientError = (error: unknown) =>
    error instanceof ApiError &&
    error.statusCode >= 400 &&
    error.statusCode < 500;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: (failureCount, error) =>
                !isClientError(error) && failureCount < 1,
        },
    },
});

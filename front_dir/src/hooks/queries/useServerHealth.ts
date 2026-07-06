import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { getServerHealthService } from "@services";

export type ServerHealthStatus = "success" | "error" | "neutral";

export const useServerHealth = (api: AxiosInstance) => {
    const query = useQuery({
        queryKey: ["metadata", "serverHealth"],
        queryFn: () => getServerHealthService<any>(api),
        staleTime: 60 * 1000,
        refetchInterval: 30000,
    });

    let status: ServerHealthStatus = "neutral";
    let title = "";

    if (query.data) {
        if (query.data.statusCode === 200 || query.data.status === "ok") {
            status = "success";
            title = query.data.result || "Server is healthy";
        } else {
            status = "error";
            title =
                query.data.result ||
                query.data?.response?.errors?.[0]?.detail ||
                "Server issue";
        }
    } else if (query.isError) {
        status = "error";
        title = "Server is down";
    }

    return { query, status, title, isDown: status === "error" };
};

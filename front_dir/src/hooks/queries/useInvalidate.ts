import { useCallback } from "react";

import { QueryKey, useQueryClient } from "@tanstack/react-query";

// queryKey debe ser estable (la constante `all` de un *Keys), no un array inline
export const useInvalidate = (queryKey: QueryKey) => {
    const queryClient = useQueryClient();
    return useCallback(
        () => queryClient.invalidateQueries({ queryKey }),
        [queryClient, queryKey],
    );
};

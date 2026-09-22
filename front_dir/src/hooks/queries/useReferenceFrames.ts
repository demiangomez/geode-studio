import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import { getReferenceFramesService } from "@services";

import { ReferenceFramesServiceData } from "@types";

import { unwrapApiResponse } from "@utils";

export const useReferenceFrames = (
    api: AxiosInstance,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: ["referenceFrames"],
        queryFn: async () =>
            unwrapApiResponse(
                await getReferenceFramesService<ReferenceFramesServiceData>(
                    api,
                ),
            ).data,
        staleTime: 5 * 60 * 1000,
        enabled: options.enabled ?? true,
    });

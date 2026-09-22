import { useMutation } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import { getRinexDownloadService } from "@services";
import { RinexData } from "@types";
import { downloadBlob } from "@utils";

export const useDownloadRinex = (api: AxiosInstance) =>
    useMutation({
        mutationFn: async (rinex: Pick<RinexData, "api_id" | "filename">) => {
            const res = await getRinexDownloadService(api, rinex.api_id);
            if (res.statusCode !== 200 || !res.blob) {
                throw new Error(
                    res.errorDetail ?? "Could not download the RINEX file",
                );
            }
            return { blob: res.blob, filename: res.filename ?? rinex.filename };
        },
        onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
    });

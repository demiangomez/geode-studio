import { useEffect, useRef, useState } from "react";

import { useMutation } from "@tanstack/react-query";

import { Alert, Modal } from "@componentsReact";
import { useApi, useAuth } from "@hooks";
import { postBulkTimeSeriesDownloadService } from "@services";
import { downloadBlob, showModal } from "@utils";

import { ArchiveBoxArrowDownIcon } from "@heroicons/react/24/outline";

import { Errors, StationData } from "@types";

interface DownloadAffectedStationsModalProps {
    stations: StationData[];
    earthquakeCount: number;
    onClose: () => void;
}

const MODAL_ID = "DownloadAffectedStations";

const DownloadAffectedStationsModal = ({
    stations,
    earthquakeCount,
    onClose,
}: DownloadAffectedStationsModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const stationCount = stations.length;

    const [done, setDone] = useState(false);
    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const abortRef = useRef<AbortController | null>(null);
    const canceledRef = useRef(false);

    useEffect(() => {
        showModal(MODAL_ID);
    }, []);

    const closeDialog = () => {
        const dialog = document.getElementById(
            MODAL_ID + "-modal",
        ) as HTMLDialogElement | null;
        dialog?.close();
    };

    const handleCancel = () => {
        if (downloadMutation.isPending) {
            canceledRef.current = true;
            abortRef.current?.abort();
        }
        closeDialog();
    };

    const downloadMutation = useMutation({
        mutationFn: () => {
            const controller = new AbortController();
            abortRef.current = controller;
            canceledRef.current = false;
            return postBulkTimeSeriesDownloadService(
                api,
                stations.map((s) => ({
                    network_code: s.network_code,
                    station_code: s.station_code,
                })),
                controller.signal,
            );
        },
        onSuccess: (res) => {
            if (canceledRef.current) return;
            if (res.statusCode === 200 && res.blob) {
                downloadBlob(
                    res.blob,
                    res.filename ??
                    `etm_bulk_download_${new Date().toISOString().slice(0, 10)}.zip`,
                );
                setMsg(undefined);
                setDone(true);
            } else {
                setDone(false);
                setMsg({
                    status: res.statusCode,
                    msg: res.statusCode === 400 ? "Invalid request" : "Download failed",
                    errors: {
                        errors: [
                            {
                                code: "",
                                detail:
                                    res.errorDetail ??
                                    "The archive could not be generated.",
                                attr: "",
                            },
                        ],
                        type: "error",
                    },
                });
            }
        },
        onError: () => {
            if (canceledRef.current) return;
            setDone(false);
            setMsg({
                status: 500,
                msg: "Download failed",
                errors: {
                    errors: [
                        {
                            code: "",
                            detail: "Unexpected error generating the archive.",
                            attr: "",
                        },
                    ],
                    type: "error",
                },
            });
        },
    });

    return (
        <Modal
            close={true}
            modalId={MODAL_ID}
            size="smPlus"
            handleCloseModal={onClose}
        >
            <div className="flex flex-col items-center gap-4 p-2 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
                    <ArchiveBoxArrowDownIcon className="size-9" />
                </div>

                <div className="space-y-1">
                    <h3 className="text-xl font-bold">
                        Download affected stations
                    </h3>
                    <p className="text-sm text-base-content/70">
                        A <span className="font-semibold">.zip</span> archive
                        with one time-series JSON per station affected by the
                        selected{" "}
                        {earthquakeCount === 1 ? "earthquake" : "earthquakes"} is
                        generated, plus a{" "}
                        <span className="font-semibold">manifest.json</span>{" "}
                        listing the stations that succeeded or failed. Only
                        stations within the selected time window are included —
                        those outside it (grayed out) and the ones excluded by
                        the active filters are left out.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-base-200 px-4 py-2 text-sm font-semibold">
                    <span className="badge badge-neutral">{stationCount}</span>
                    {stationCount === 1
                        ? "station to download"
                        : "stations to download"}
                </div>

                <div className="mt-2 flex w-full items-center justify-center">
                    <button
                        type="button"
                        className="btn btn-secondary w-[200px]"
                        onClick={() => downloadMutation.mutate()}
                        disabled={
                            stationCount === 0 || downloadMutation.isPending
                        }
                    >
                        {downloadMutation.isPending ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            <ArchiveBoxArrowDownIcon className="size-5" />
                        )}
                        Download .zip
                    </button>
                    <a
                        className="link link-hover h-full self-end ml-4"
                        type="button"
                        onClick={handleCancel}
                    >
                        Cancel
                    </a>
                </div>

                {(msg || done) && (
                    <div className="w-full">
                        <Alert
                            msg={
                                msg ?? {
                                    status: 200,
                                    msg: "Your download has started. Check manifest.json for any stations that could not be processed.",
                                }
                            }
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default DownloadAffectedStationsModal;

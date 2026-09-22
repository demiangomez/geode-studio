import { useMemo, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";

import { Alert, Modal, StationSelectList } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import {
    TRANSFER_VISITS_MUTATION_KEY,
    useStationCatalog,
    useTransferVisits,
} from "@hooks/queries";

import { StationData, StationVisitsData } from "@types";
import { ApiError, modalActions } from "@utils";

import {
    ArrowsRightLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
} from "@heroicons/react/24/outline";

interface TransferVisitsModalProps {
    station: StationData;
    visits: StationVisitsData[];
    closeModal: () => void;
}

const TransferVisitsModal = ({
    station,
    visits,
    closeModal,
}: TransferVisitsModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [destination, setDestination] = useState<StationData | undefined>(
        undefined,
    );

    // Lo ya movido se acumula acá y no en `transferMutation.data`: TanStack
    // limpia `data` al fallar la mutación siguiente, y derivar de ahí haría
    // reaparecer como pendiente una visita ya transferida.
    const [movedIds, setMovedIds] = useState<number[]>([]);

    const { data: stationsResult, isLoading: loadingStations } =
        useStationCatalog(api);

    const transferMutation = useTransferVisits(api);

    // Cerrar el modal (backdrop o Esc) no cancela el POST en vuelo, asi que el
    // guard tiene que mirar el cache global de mutaciones y no el isPending de
    // esta instancia: al reabrir seria una instancia nueva sin memoria.
    const transferInFlight =
        useIsMutating({ mutationKey: TRANSFER_VISITS_MUTATION_KEY }) > 0;

    const report = transferMutation.data;

    const errorMsg = useMemo(() => {
        const err = transferMutation.error;
        if (!err) return undefined;
        return err instanceof ApiError
            ? {
                  // El titulo es el tipo; Alert pinta el detalle debajo, asi que
                  // pasar err.message aca lo mostraria dos veces.
                  status: err.statusCode,
                  msg: err.response?.type ?? err.message,
                  errors: err.response,
              }
            : { status: 500, msg: err.message, errors: undefined };
    }, [transferMutation.error]);

    const pendingVisits = useMemo(
        () => visits.filter((v) => !movedIds.includes(v.id)),
        [visits, movedIds],
    );

    const handleTransfer = () => {
        if (!destination?.api_id || pendingVisits.length === 0) return;
        transferMutation.mutate(
            {
                visits: pendingVisits.map((v) => v.id),
                destination_station: destination.api_id,
            },
            {
                onSuccess: (data) => {
                    // Por id o por fecha: la fecha es unica por estacion
                    // (unique station+date), asi que no sobre-matchea y cubre
                    // que el backend identifique la visita de otra forma.
                    const moved = visits
                        .filter((v) =>
                            data.transferred.some(
                                (t) => t.visit === v.id || t.date === v.date,
                            ),
                        )
                        .map((v) => v.id);
                    setMovedIds((prev) => [...new Set([...prev, ...moved])]);
                },
            },
        );
    };

    // Modal.tsx dispara el cierre dos veces cuando se clickea el backdrop
    // (onClick del boton + evento `close` del <dialog>).
    const closedRef = useRef(false);

    const handleCloseModal = () => {
        if (closedRef.current) return;
        closedRef.current = true;
        transferMutation.reset();
        setDestination(undefined);
        closeModal();
    };

    return (
        <Modal
            close={false}
            modalId={"TransferVisits"}
            size={"smPlus"}
            handleCloseModal={handleCloseModal}
        >
            <h3 className="font-bold text-center text-2xl my-2">
                {visits.length === 1 ? "Transfer visit" : "Transfer visits"}
            </h3>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <span className="font-bold">
                        {pendingVisits.length === 1
                            ? "Visit to move"
                            : `Visits to move (${pendingVisits.length})`}
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto rounded-md bg-base-200 p-2">
                        {pendingVisits.map((v) => (
                            <span key={v.id} className="badge badge-neutral">
                                {v.date}
                            </span>
                        ))}
                    </div>
                    <span className="text-sm opacity-70">
                        All files and resources move with the visit. From{" "}
                        <strong>
                            {station.network_code?.toUpperCase()}.
                            {station.station_code?.toUpperCase()}
                        </strong>
                        .
                    </span>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="font-bold">Destination station</span>
                    <StationSelectList
                        stations={stationsResult?.data}
                        isLoading={loadingStations}
                        selectedApiId={destination?.api_id}
                        onSelect={setDestination}
                        excludeApiId={station.api_id}
                        height={256}
                        collapsible
                    />
                </div>

                {errorMsg && <Alert msg={errorMsg} />}

                {report && (
                    <div className="flex flex-col gap-2">
                        {report.transferred.length > 0 && (
                            <div role="alert" className="alert alert-success">
                                <CheckCircleIcon className="size-6 shrink-0" />
                                <span>
                                    {report.transferred.length === 1
                                        ? "1 visit transferred"
                                        : `${report.transferred.length} visits transferred`}
                                </span>
                            </div>
                        )}
                        {report.rejected.length > 0 && (
                            <div
                                role="alert"
                                className="alert alert-error items-start"
                            >
                                <XCircleIcon className="size-6 shrink-0" />
                                <div className="flex flex-col gap-1 text-left">
                                    <span>
                                        {report.rejected.length === 1
                                            ? "1 visit was not transferred"
                                            : `${report.rejected.length} visits were not transferred`}
                                    </span>
                                    <ul className="list-disc ml-4 text-sm font-light">
                                        {report.rejected.map((r) => (
                                            <li key={r.visit}>
                                                <strong>{r.date}</strong>:{" "}
                                                {r.error}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {pendingVisits.length > 0 && (
                    <div className={modalActions.container}>
                        <button
                            type="button"
                            className={modalActions.primary}
                            disabled={!destination || transferInFlight}
                            onClick={handleTransfer}
                        >
                            {transferInFlight ? (
                                <span className="loading loading-spinner loading-sm" />
                            ) : (
                                <ArrowsRightLeftIcon className="size-5" />
                            )}
                            {report || errorMsg ? "Retry" : "Transfer"}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default TransferVisitsModal;

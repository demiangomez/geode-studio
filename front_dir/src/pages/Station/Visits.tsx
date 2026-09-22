import { useLocation, useOutletContext } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CardContainer,
    ConfirmDeleteModal,
    ImageModal,
    TableCard,
    TableSkeleton,
    TransferVisitsModal,
    VisitAddModal,
} from "@componentsReact";
import VisitDetailModal from "@components/modals/Station/StationVisitDetailModal";
import VisitThumbNail from "./VisitThumbNail";

import { useAuth, useApi } from "@hooks";

import {
    Photo,
    StationCampaignsData,
    StationData,
    StationVisitsData,
    StationVisitsFilesData,
} from "@types";

import { ApiError, showModal } from "@utils";

import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import {
    useCampaigns,
    useDeleteStationVisit,
    useMetadata,
    useStationVisitImages,
    useStationVisits,
} from "@hooks/queries";

interface OutletContext {
    station: StationData;
}

const Visits = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const queryClient = useQueryClient();

    const location = useLocation();

    const campaign = location.state
        ? "visitDetail" in location.state
            ? undefined
            : "start_date" in location.state
              ? (location.state as StationCampaignsData)
              : undefined
        : undefined;

    const visitByCampaign = location.state
        ? "visitDetail" in location.state
            ? (location.state.visitDetail as StationVisitsData)
            : undefined
        : undefined;

    const { station } = useOutletContext<OutletContext>();

    const [activeTab, setActiveTab] = useState<"visits" | "planned">("visits");

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [visitToDel, setVisitToDel] = useState<number | undefined>(undefined);

    // Snapshot al abrir el modal: el listado se refetchea tras transferir y el
    // reporte tiene que seguir mostrando las visitas que se mandaron.
    const [visitsToTransfer, setVisitsToTransfer] = useState<
        StationVisitsData[]
    >([]);

    const [visit, setVisit] = useState<StationVisitsData | undefined>(
        undefined,
    );

    const [photo, setPhoto] = useState<Photo | undefined>(undefined);

    const { statuses, types } = useMetadata(api, {
        enabled: !!station,
        only: ["types", "statuses"],
    });

    const {
        data: visits,
        isLoading: loading,
        isError: visitsError,
    } = useStationVisits(api, station?.api_id);

    const { data: images, isLoading: loadingVisitImages } =
        useStationVisitImages(api, station?.api_id);

    const { data: campaigns } = useCampaigns(api);

    const delVisitMutation = useDeleteStationVisit(api);

    const delMsg = delVisitMutation.isSuccess
        ? {
              status: delVisitMutation.data.statusCode,
              msg: delVisitMutation.data.msg,
          }
        : delVisitMutation.isError
          ? delVisitMutation.error instanceof ApiError
              ? {
                    status: delVisitMutation.error.statusCode,
                    msg: delVisitMutation.error.message,
                    errors: delVisitMutation.error.response,
                }
              : { status: 500, msg: delVisitMutation.error.message }
          : undefined;

    const refetchVisits = () => {
        queryClient.invalidateQueries({ queryKey: ["visits"] });
        queryClient.invalidateQueries({ queryKey: ["visitImages"] });
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    };

    const visibleVisits = useMemo(
        () =>
            visits?.filter((v) =>
                activeTab === "planned" ? v.planned : !v.planned,
            ),
        [visits, activeTab],
    );

    const plannedCount = useMemo(
        () => visits?.filter((v) => v.planned).length ?? 0,
        [visits],
    );

    // misma referencia por visita entre renders (memo de VisitThumbNail)
    const imagesByVisit = useMemo(() => {
        const byVisit = new Map<number, StationVisitsFilesData[]>();
        images?.forEach((img) => {
            const list = byVisit.get(img.visit);
            if (list) list.push(img);
            else byVisit.set(img.visit, [img]);
        });
        return byVisit;
    }, [images]);

    const openTransferModal = useCallback((toTransfer: StationVisitsData[]) => {
        setVisitsToTransfer(toTransfer);
        setModals({ show: true, title: "TransferVisits", type: "none" });
    }, []);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    useEffect(() => {
        if (campaign && !visitByCampaign) {
            setModals({
                show: true,
                title: "AddVisit",
                type: "edit",
            });
        } else if (!campaign && visitByCampaign) {
            setModals({
                show: true,
                title: "VisitDetail",
                type: "none",
            });
            setVisit(visitByCampaign);
        }
    }, [campaign, visitByCampaign]);

    return (
        <div className="">
            <h1 className="text-2xl font-base text-center">VISITS</h1>

            <div className="flex flex-grow w-full justify-center pr-2 space-x-2 px-2 pb-4">
                <CardContainer title="" titlePosition="start">
                    <TableCard
                        title={"Visits"}
                        size={"100%"}
                        addButtonTitle="Add Visit"
                        modalTitle="AddVisit"
                        setModals={setModals}
                        addButton={true}
                        headerActions={
                            <button
                                className="btn btn-neutral no-animation"
                                title="Transfer the listed visits to another station"
                                disabled={!visibleVisits?.length}
                                onClick={() =>
                                    openTransferModal(visibleVisits ?? [])
                                }
                            >
                                <ArrowsRightLeftIcon className="size-5" />
                                Transfer visits
                            </button>
                        }
                        headerContent={
                            <div
                                role="tablist"
                                className="tabs grid-cols-2 rounded-btn bg-base-300 p-1 gap-1"
                            >
                                <a
                                    role="tab"
                                    onClick={() => setActiveTab("visits")}
                                    className={`tab gap-2 rounded-btn border border-base-300 ${activeTab === "visits" ? "bg-base-100 shadow font-bold border-base-content/20" : "bg-base-200"}`}
                                >
                                    Completed
                                    <span
                                        className={`badge badge-sm ${activeTab === "visits" ? "badge-neutral" : "badge-ghost"}`}
                                    >
                                        {(visits?.length ?? 0) - plannedCount}
                                    </span>
                                </a>
                                <a
                                    role="tab"
                                    onClick={() => setActiveTab("planned")}
                                    className={`tab gap-2 rounded-btn border border-base-300 ${activeTab === "planned" ? "bg-base-100 shadow font-bold border-base-content/20" : "bg-base-200"}`}
                                >
                                    Planned
                                    <span
                                        className={`badge badge-sm ${activeTab === "planned" ? "badge-neutral" : "badge-ghost"}`}
                                    >
                                        {plannedCount}
                                    </span>
                                </a>
                            </div>
                        }
                    >
                        {loading ? (
                            <div className="grid gap-4 grid-cols-3 grid-flow-dense">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <TableSkeleton mainSize="300px" key={i} />
                                ))}
                            </div>
                        ) : visitsError ? (
                            <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                There is no visit data to show
                            </div>
                        ) : visibleVisits && visibleVisits.length === 0 ? (
                            <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                {activeTab === "planned"
                                    ? "There are no planned visits"
                                    : "There are no visits"}
                            </div>
                        ) : (
                            <div
                                className={`grid
                                    grid-cols-2
                                    grid-flow-dense gap-4`}
                            >
                                {visibleVisits?.map((vis) => (
                                    <VisitThumbNail
                                        key={vis.id}
                                        station={station}
                                        statuses={statuses ?? []}
                                        types={types ?? []}
                                        visit={vis}
                                        visitImages={imagesByVisit.get(vis.id)}
                                        campaigns={campaigns}
                                        loadingVisitImages={loadingVisitImages}
                                        setModals={setModals}
                                        setVisitToDel={setVisitToDel}
                                        onTransfer={openTransferModal}
                                        setVisit={setVisit}
                                        setPhoto={setPhoto}
                                    />
                                ))}
                            </div>
                        )}
                    </TableCard>
                </CardContainer>
            </div>

            {modals && modals?.title === "ConfirmDelete" && (
                <ConfirmDeleteModal
                    loading={delVisitMutation.isPending}
                    msg={delMsg}
                    confirmRemove={() =>
                        visitToDel && delVisitMutation.mutate(visitToDel)
                    }
                    closeModal={() => {
                        setModals({
                            show: false,
                            title: "",
                            type: "edit",
                        });
                        setVisitToDel(undefined);
                        delVisitMutation.reset();
                    }}
                />
            )}

            {modals?.show && modals?.title === "AddVisit" && (
                <VisitAddModal
                    campaigns={campaigns}
                    campaignB={campaign}
                    setStateModal={setModals}
                    station={station}
                    closeModal={() => {
                        refetchVisits();
                        setModals({
                            show: false,
                            title: "",
                            type: "edit",
                        });
                    }}
                    reFetch={refetchVisits}
                />
            )}
            {modals?.show && modals.title === "TransferVisits" && (
                <TransferVisitsModal
                    station={station}
                    visits={visitsToTransfer}
                    closeModal={() => {
                        setModals({ show: false, title: "", type: "none" });
                        setVisitsToTransfer([]);
                    }}
                />
            )}
            {modals?.show && modals.title === "VisitDetail" && (
                <VisitDetailModal
                    campaigns={campaigns}
                    visitId={visit?.id}
                    setStateModal={setModals}
                    closeModal={() => {
                        refetchVisits();
                        setVisit(undefined);
                    }}
                />
            )}
            {modals?.show && modals.title === "ViewStationPhoto" && (
                <ImageModal
                    photo={photo}
                    visit={true}
                    closeModal={() => setPhoto(undefined)}
                    refetch={() =>
                        queryClient.invalidateQueries({
                            queryKey: ["visitImages"],
                        })
                    }
                    setStateModal={setModals}
                    type="edit"
                />
            )}
        </div>
    );
};

export default Visits;

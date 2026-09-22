import { useEffect, useState } from "react";
import {
    Modal,
    Spinner,
    Alert,
    MissingPhoto,
    ZoomableImage,
} from "@componentsReact";

import { useAuth, useApi, useCursorZoom } from "@hooks";
import {
    getStationImageByIdService,
    getStationVisitsImagesByIdService,
    patchVisitImagesDescription,
} from "@services";
import { downloadFromBase64, modalActions } from "@utils";
import {
    ArrowDownTrayIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";

import {
    StationImagesData,
    PatchDescriptionVisitImageResponse,
    Errors,
    Photo,
} from "@types";

interface Props {
    photo: Photo | undefined;
    visit?: boolean;
    closeModal: () => void;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    type?: "add" | "edit" | "none";
    refetch?: () => void;
}

const ImageModal = ({
    photo,
    visit,
    closeModal,
    setStateModal,
    type,
    refetch,
}: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [msg, setMsg] = useState<{
        status: number;
        msg: string;
        errors?: Errors;
    } | null>(null);

    const [success, setSuccess] = useState<boolean>(false);

    const [loading, setLoading] = useState<boolean>(true);

    const [originalPhoto, setOriginalPhoto] = useState<
        StationImagesData | undefined
    >(undefined);

    const [downloadingFull, setDownloadingFull] = useState<boolean>(false);

    const [globalDescription, setGlobalDescription] = useState<
        string | undefined
    >(undefined);

    const [aspectRatio, setAspectRatio] = useState<number | undefined>(
        undefined,
    );

    const {
        zoom,
        origin,
        pan,
        isDragging,
        boxRef: zoomBoxRef,
        zoomIn,
        zoomOut,
        handleWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        min: zoomMin,
        max: zoomMax,
    } = useCursorZoom({
        min: 1,
        max: 4,
        step: 0.5,
        wheelStep: 0.25,
        contentAspectRatio: aspectRatio,
    });

    const handleCloseModal = () => {
        closeModal();
    };

    const getOriginalPhoto = async () => {
        try {
            setLoading(true);

            const service = visit
                ? getStationVisitsImagesByIdService
                : getStationImageByIdService;

            const res = await service<StationImagesData>(api, photo?.id ?? 0);

            if (res.actual_image) {
                setOriginalPhoto(res);
                if (res.description) {
                    const description = res.description;
                    setGlobalDescription(description);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadFullQuality = async () => {
        try {
            setDownloadingFull(true);
            const service = visit
                ? getStationVisitsImagesByIdService
                : getStationImageByIdService;
            const res = await service<StationImagesData>(
                api,
                photo?.id ?? 0,
                true,
            );
            if (res.actual_image) {
                downloadFromBase64(
                    res.actual_image,
                    res.filename || res.name || `photo_${photo?.id}`,
                );
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDownloadingFull(false);
        }
    };

    const updatePhotoDescription = async () => {
        setLoading(true);
        try {
            if (globalDescription !== undefined) {
                const body = {
                    description: globalDescription,
                };
                if (typeof originalPhoto?.id === "number") {
                    const res =
                        await patchVisitImagesDescription<PatchDescriptionVisitImageResponse>(
                            api,
                            body,
                            originalPhoto?.id,
                        );

                    if (res.statusCode !== 200) {
                        setMsg({
                            status: 400,
                            errors: {
                                errors: [
                                    {
                                        code: "400",
                                        attr: "files",
                                        detail: "",
                                    },
                                ],
                                type: "error",
                            },
                            msg: "Files were not uploaded successfully",
                        });
                    } else {
                        setMsg({
                            status: 200,
                            msg: "Photo description updated successfully",
                        });
                    }
                }
            }
        } catch (err) {
            setMsg({
                status: 400,
                errors: {
                    errors: [
                        {
                            code: "400",
                            attr: "files",
                            detail: "",
                        },
                    ],
                    type: "error",
                },
                msg: "Files were not uploaded successfully",
            });
        } finally {
            setLoading(false);
            setSuccess(true);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        updatePhotoDescription();
        refetch && refetch();
    };

    useEffect(() => {
        setAspectRatio(undefined);
        getOriginalPhoto();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photo]);

    return (
        <Modal
            close={false}
            modalId={"ViewStationPhoto"}
            size={"md"}
            handleCloseModal={() => handleCloseModal()}
            setModalState={setStateModal}
        >
            {!originalPhoto && loading ? (
                <div className="flex flex-col flex-grow w-full items-center py-4">
                    <span className="font-semibold text-xl mb-12">
                        Loading image...
                    </span>
                    <Spinner size={"lg"} />
                </div>
            ) : !originalPhoto ? (
                <MissingPhoto className="w-full h-60 rounded" />
            ) : (
                originalPhoto?.name && (
                    <div className="space-y-4">
                        <div className="flex justify-center items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-circle btn-ghost"
                                title="Download original quality"
                                disabled={downloadingFull}
                                onClick={downloadFullQuality}
                            >
                                {downloadingFull ? (
                                    <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                    <ArrowDownTrayIcon className="size-6" />
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn btn-circle btn-ghost"
                                onClick={zoomOut}
                                disabled={zoom <= zoomMin}
                                title="Zoom out"
                            >
                                <MagnifyingGlassMinusIcon className="size-6" />
                            </button>
                            <span className="text-sm w-12 text-center select-none">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                type="button"
                                className="btn btn-circle btn-ghost"
                                onClick={zoomIn}
                                disabled={zoom >= zoomMax}
                                title="Zoom in"
                            >
                                <MagnifyingGlassPlusIcon className="size-6" />
                            </button>
                        </div>
                        <ZoomableImage
                            src={
                                "data:image/png;base64," +
                                originalPhoto?.actual_image
                            }
                            alt={"photo" + originalPhoto?.name}
                            zoom={zoom}
                            origin={origin}
                            pan={pan}
                            isDragging={isDragging}
                            boxRef={zoomBoxRef}
                            handleWheel={handleWheel}
                            handlePointerDown={handlePointerDown}
                            handlePointerMove={handlePointerMove}
                            handlePointerUp={handlePointerUp}
                            onNaturalSize={setAspectRatio}
                        />
                        {originalPhoto?.description && type !== "none" && (
                            <p className="break-words border-t-2 border-neutral-300 pt-3 leading-6 tracking-tight text-xl font-semibold">
                                {originalPhoto?.description}
                            </p>
                        )}
                        {type === "none" && (
                            <form
                                className="flex flex-col items-center space-y-2"
                                onSubmit={handleSubmit}
                            >
                                <label
                                    htmlFor="description"
                                    className="text-lg font-semibold"
                                >
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={
                                        globalDescription
                                            ? globalDescription
                                            : ""
                                    }
                                    className="rounded-md text-md input input-sm input-bordered w-full"
                                    onChange={(e) =>
                                        setGlobalDescription(e.target.value)
                                    }
                                />
                                {msg && <Alert msg={msg} />}
                                <button
                                    type="submit"
                                    disabled={success}
                                    className={`${modalActions.primary} mt-2`}
                                >
                                    Submit
                                </button>
                                {loading && (
                                    <div className="flex flex-col items-center justify-center space-y-4 w-full">
                                        <Spinner size="lg" />
                                    </div>
                                )}
                            </form>
                        )}
                    </div>
                )
            )}
        </Modal>
    );
};

export default ImageModal;

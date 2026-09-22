import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import {
    CardContainer,
    ConfirmDeleteModal,
    ImageModal,
    MissingPhoto,
    PhotoSkeleton,
    StationPhotoModal,
} from "@componentsReact";

import {
    MagnifyingGlassPlusIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

import { delStationsImagesService } from "@services";

import { showModal } from "@utils";

import { useAuth, useApi } from "@hooks";

import { ErrorResponse, Errors, Photo as PhotoType, StationData } from "@types";

interface Props {
    phArray: PhotoType[];
    loader: boolean;
    reFetch: () => void;
}

const Photo = ({ phArray, loader, reFetch }: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { station } = useOutletContext<{ station: StationData }>();

    const [edit, setEdit] = useState<boolean>(false);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [blurPhoto, setBlurPhoto] = useState<
        { blur: boolean; id: number } | undefined
    >(undefined);
    const [delPhoto, setDelPhoto] = useState<PhotoType | undefined>(undefined);
    const [photo, setPhoto] = useState<PhotoType | undefined>(undefined);

    const [loading, setLoading] = useState<boolean>(false);
    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const delPhotoService = async () => {
        if (!delPhoto) return;
        try {
            setLoading(true);
            const res = await delStationsImagesService<ErrorResponse>(
                api,
                delPhoto.id,
            );
            if ("status" in res && res.status === "success") {
                setMsg({
                    status: res.statusCode,
                    msg: res.msg,
                });
            } else {
                setMsg({
                    status: res.statusCode,
                    msg: res.response.type,
                    errors: res.response,
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            reFetch();
        }
    };

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    const editFunction = () => {
        setEdit(!edit);
    };

    const addFunction = () => {
        setModals({
            show: true,
            title: "AddStationPhoto",
            type: "add",
        });
        setEdit(false);
    };

    return (
        <div className="w-6/12">
            <CardContainer
                title={"Photos"}
                height={true}
                addButton={station ? true : false}
                addFunction={addFunction}
                editFunction={station ? editFunction : undefined}
            >
                {loader ? (
                    <PhotoSkeleton />
                ) : phArray.length !== 0 ? (
                    <div className="grid grid-cols-2 w-full gap-6 overflow-auto pr-2">
                        {phArray.map((s: PhotoType, idx) => {
                            const hasImage = !!s.actual_image;
                            const openPhoto = () => {
                                setPhoto(s);
                                setModals({
                                    show: true,
                                    title: edit
                                        ? "AddStationPhoto"
                                        : "ViewStationPhoto",
                                    type: "edit",
                                });
                            };
                            const handlePhotoClick = () => {
                                if (edit || hasImage) openPhoto();
                            };
                            return (
                                <div
                                    key={"photo" + String(idx)}
                                    className={`relative flex flex-col justify-between rounded-md card-compact bg-base-100
                                    h-80 shadow-xl hover:shadow-2xl transition-all duration-200 ease-in-out group ${
                                        hasImage
                                            ? "hover:cursor-zoom-in"
                                            : edit
                                              ? "hover:cursor-pointer"
                                              : ""
                                    }`}
                                    onMouseEnter={() =>
                                        setBlurPhoto({ blur: true, id: s.id })
                                    }
                                    onMouseLeave={() => setBlurPhoto(undefined)}
                                >
                                    <figure className="relative my-auto overflow-hidden rounded-md h-full">
                                        {hasImage ? (
                                            <img
                                                src={
                                                    "data:image/png;base64," +
                                                    s.actual_image
                                                }
                                                alt={"photo" + String(idx)}
                                                className={`
                                                object-center object-cover w-full h-full transition-transform duration-200 ease-in-out group-hover:scale-110 `}
                                                onClick={handlePhotoClick}
                                            />
                                        ) : (
                                            <MissingPhoto className="w-full h-full" />
                                        )}
                                        {hasImage && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-200 pointer-events-none">
                                                <MagnifyingGlassPlusIcon className="size-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                            </div>
                                        )}
                                        {!hasImage && edit && (
                                            <div
                                                className="absolute inset-0"
                                                onClick={handlePhotoClick}
                                            />
                                        )}
                                        {edit && (
                                            <div
                                                className="absolute top-0 right-0 text-black 
                                            group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
                                            >
                                                <button
                                                    className="bg-white rounded-sm shadow-xl z-[200000] 
                                                hover:bg-slate-200 transition-all duration-200 "
                                                    onClick={() => {
                                                        setDelPhoto(s);
                                                        setModals({
                                                            show: true,
                                                            title: "ConfirmDelete",
                                                            type: "edit",
                                                        });
                                                    }}
                                                >
                                                    <XMarkIcon className="size-12" />
                                                </button>
                                            </div>
                                        )}
                                    </figure>
                                    <div
                                        className={`${blurPhoto && blurPhoto.id === s.id ? "bg-gray-300 " : ""} 
                                            flex flex-col space-y-2 p-4 text-center`}
                                        onClick={handlePhotoClick}
                                    >
                                        <p className="break-words text-md">
                                            {s.description
                                                ? s.description
                                                : "NONE"}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        className="text-center text-neutral content-center text-2xl 
                        font-bold w-full rounded-md bg-neutral-content p-6"
                    >
                        There are no photos
                    </div>
                )}
            </CardContainer>

            {modals && modals?.title === "AddStationPhoto" && (
                <StationPhotoModal
                    modalType={modals.type}
                    setStateModal={setModals}
                    reFetch={reFetch}
                    photo={photo ?? undefined}
                    edit={edit}
                />
            )}

            {modals && modals?.title === "ViewStationPhoto" && (
                <ImageModal
                    photo={photo ?? undefined}
                    closeModal={() => {
                        setPhoto(undefined);
                    }}
                    setStateModal={setModals}
                />
            )}

            {modals && modals?.title === "ConfirmDelete" && (
                <ConfirmDeleteModal
                    msg={msg}
                    loading={loading}
                    confirmRemove={() => {
                        delPhotoService();
                    }}
                    closeModal={() => {
                        setModals({
                            show: false,
                            title: "",
                            type: "edit",
                        });
                        setDelPhoto(undefined);
                        setMsg(undefined);
                    }}
                />
            )}
        </div>
    );
};

export default Photo;

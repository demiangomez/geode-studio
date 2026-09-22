import Modal from "@components/modals/Modal";
import ZoomableImage from "@components/ZoomableImage";
import { pdfjs } from "react-pdf";
import { Document, Page } from "react-pdf";

import pdfJSWorkerURL from "pdfjs-dist/build/pdf.worker?url";

import {
    ArrowDownTrayIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
} from "@heroicons/react/24/outline";

import { useCallback, useEffect, useMemo, useState } from "react";

import useResizeObserver from "@hooks/useResizeObserver";
import useCursorZoom from "@hooks/useCursorZoom";

import { getFileMimeType, showModal } from "@utils";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfJSWorkerURL;

// el PDF puede achicarse por debajo del 100% para ver mas paginas de una;
// la imagen usa 1 como piso (el "fit" inicial) via useCursorZoom
const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 3;
const PDF_ZOOM_STEP = 0.25;
const BASE_PDF_WIDTH = 800;

interface Props {
    file: string | null | undefined;
    filename: string | null | undefined;
    closeModal: () => void;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
}

// useResizeObserver reconecta el observer si cambia la referencia de options
const RESIZE_OBSERVER_OPTIONS: ResizeObserverOptions = {};

const RenderFileModal = ({
    file,
    filename,
    closeModal,
    setStateModal,
}: Props) => {
    const [numPages, setNumPages] = useState<number>();

    const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>();

    const [aspectRatio, setAspectRatio] = useState<number | undefined>(
        undefined,
    );

    const onResize = useCallback<ResizeObserverCallback>((entries) => {
        const [entry] = entries;

        if (entry) {
            setContainerWidth(entry.contentRect.width);
        }
    }, []);

    useResizeObserver(containerRef, RESIZE_OBSERVER_OPTIONS, onResize);

    // Se monta lazy: el showModal del padre corre antes de que exista el <dialog>
    useEffect(() => {
        showModal("FileRender");
    }, []);

    const mimeType = useMemo(() => getFileMimeType(filename), [filename]);
    const isImage = mimeType?.startsWith("image/") ?? false;
    const isPdf = mimeType === "application/pdf";
    const dataUrl =
        file && mimeType ? `data:${mimeType};base64,${file}` : undefined;

    useEffect(() => {
        setAspectRatio(undefined);
    }, [dataUrl]);

    // para imagenes el zoom minimo es 1 (el "fit" inicial, via
    // useCursorZoom); el PDF si puede achicarse por debajo del 100% para
    // ver mas paginas de una
    const {
        zoom,
        origin,
        pan,
        isDragging,
        boxRef: imageBoxRef,
        zoomIn,
        zoomOut,
        handleWheel: handleImageWheel,
        handlePointerDown: handleImagePointerDown,
        handlePointerMove: handleImagePointerMove,
        handlePointerUp: handleImagePointerUp,
        min: zoomMin,
        max: zoomMax,
    } = useCursorZoom({
        min: isImage ? 1 : PDF_ZOOM_MIN,
        max: PDF_ZOOM_MAX,
        step: PDF_ZOOM_STEP,
        wheelStep: PDF_ZOOM_STEP,
        contentAspectRatio: isImage ? aspectRatio : undefined,
    });

    function onDocumentLoadSuccess({ numPages: nextNumPages }: any): void {
        setNumPages(nextNumPages);
    }

    const handleCloseModal = () => {
        closeModal();
    };

    const baseWidth = containerWidth
        ? Math.min(containerWidth, BASE_PDF_WIDTH)
        : BASE_PDF_WIDTH;

    return (
        <Modal
            close={false}
            modalId={"FileRender"}
            size={"md"}
            handleCloseModal={() => handleCloseModal()}
            setModalState={setStateModal}
        >
            <div className="flex flex-col items-center">
                <div className="mb-4 flex justify-center items-center gap-2">
                    <a
                        className="btn btn-circle btn-ghost"
                        download={filename}
                        href={dataUrl}
                        title="Download"
                    >
                        <ArrowDownTrayIcon className="size-6" />
                    </a>
                    {(isImage || isPdf) && (
                        <>
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
                        </>
                    )}
                </div>

                <div className="w-full">
                    {isImage && dataUrl ? (
                        <ZoomableImage
                            src={dataUrl}
                            alt={filename ?? "preview"}
                            zoom={zoom}
                            origin={origin}
                            pan={pan}
                            isDragging={isDragging}
                            boxRef={imageBoxRef}
                            handleWheel={handleImageWheel}
                            handlePointerDown={handleImagePointerDown}
                            handlePointerMove={handleImagePointerMove}
                            handlePointerUp={handleImagePointerUp}
                            onNaturalSize={setAspectRatio}
                        />
                    ) : isPdf && dataUrl ? (
                        <div
                            ref={setContainerRef}
                            className="max-h-[70vh] overflow-auto flex [justify-content:safe_center] [scrollbar-gutter:stable]"
                        >
                            <Document
                                file={dataUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                            >
                                {Array.from(
                                    new Array(numPages),
                                    (_el, index) => (
                                        <Page
                                            key={`page_${index + 1}`}
                                            pageNumber={index + 1}
                                            width={baseWidth * zoom}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    marginBottom: "1rem",
                                                }}
                                            >
                                                <span className="text-gray-600 font-thin text-sm">
                                                    page {index + 1}
                                                </span>
                                            </div>
                                        </Page>
                                    ),
                                )}
                            </Document>
                        </div>
                    ) : (
                        <div className="text-center text-neutral p-6">
                            Preview not available for this file type.
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default RenderFileModal;

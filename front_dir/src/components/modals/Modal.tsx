import { ReactNode } from "react";

import { modalSizes } from "@utils";

interface ModalProps {
    close: boolean;
    modalId: string;
    size?: "sm" | "smPlus" | "md" | "lg" | "xl" | "fit";
    variant?: "danger" | "warning" | "success";
    handleCloseModal?: () => void;
    setModalState?: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    noPadding?: boolean;
    children: ReactNode;
}

const Modal = ({
    close,
    modalId,
    size,
    variant,
    handleCloseModal,
    setModalState,
    noPadding,
    children,
}: ModalProps) => {
    return (
        <dialog
            id={modalId + "-modal"}
            className="modal"
            onClose={() => {
                handleCloseModal ? handleCloseModal() : null;
                setModalState ? setModalState(undefined) : null;
            }}
        >
            <div
                className={`modal-box 
                    ${
                        variant && variant === "danger"
                            ? "border-t-4 border-t-red-500"
                            : variant === "warning"
                              ? "border-t-4 border-t-yellow-500"
                              : variant === "success"
                                ? "border-t-4 border-t-green-500"
                                : ""
                    }`}
                style={
                    noPadding
                        ? {
                              maxWidth: "",
                              minWidth: size ? modalSizes[size] : "",
                              padding: "0px",
                          }
                        : {
                              maxWidth: "",
                              minWidth: size ? modalSizes[size] : "",
                          }
                }
            >
                {close && (
                    <form method="dialog">
                        <button
                            className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
                            onClick={() => {
                                handleCloseModal ? handleCloseModal() : null;
                                setModalState ? setModalState(undefined) : null;
                            }}
                        >
                            ✕
                        </button>
                    </form>
                )}
                {children}
            </div>
            {/* Mount point para popups (p.ej. el calendario de react-datepicker):
                deben escapar el overflow + transform del .modal-box (que los recorta y
                scrollea) pero seguir dentro del <dialog> para verse en el top layer.
                position:absolute (fuera del grid de .modal) → el modal-box no se mueve
                al abrir el popup; el calendario se posiciona solo (floating-ui). */}
            <div
                id={modalId + "-dp-portal"}
                className="absolute left-0 top-0"
            />
            {!close && (
                <form method="dialog" className="modal-backdrop ">
                    <button
                        onClick={() => {
                            handleCloseModal ? handleCloseModal() : null;
                            setModalState ? setModalState(undefined) : null;
                        }}
                    >
                        close
                    </button>
                </form>
            )}
        </dialog>
    );
};

export default Modal;

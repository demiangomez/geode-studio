import { useRef } from "react";

import { Dropzone } from "@componentsReact";

export type FileOrTextMode = "manual" | "by file";

interface FileOrTextFieldProps {
    title: string;
    value: string;
    onChange: (value: string) => void;
    mode: FileOrTextMode | undefined;
    onModeChange: (mode: FileOrTextMode) => void;
    file: File | undefined;
    setFile: (file: File | undefined) => void;
    hint?: string;
    error?: string;
    readOnly?: boolean;
    emptyText: string;
    /** Clase de alto de la card (Tailwind). */
    height?: string;
    /** Al cargar un archivo pasa a Manual con su contenido, para poder verlo. */
    manualOnFileLoad?: boolean;
}

const FileOrTextField = ({
    title,
    value,
    onChange,
    mode,
    onModeChange,
    file,
    setFile,
    hint,
    error,
    readOnly = false,
    emptyText,
    height = "h-72",
    manualOnFileLoad = false,
}: FileOrTextFieldProps) => {
    // Al pasar a Manual con un archivo cargado, su texto queda editable en el
    // textarea. Se lee una sola vez por archivo para no pisar ediciones al
    // volver a alternar los modos.
    const readFile = useRef<File>();
    const loadIntoManual = (f: File) => {
        if (readFile.current === f) return;
        readFile.current = f;
        f.text().then(
            (text) => {
                onChange(text);
                onModeChange("manual");
            },
            () => {
                readFile.current = undefined;
            },
        );
    };
    const chooseManual = () => {
        onModeChange("manual");
        file && loadIntoManual(file);
    };
    const handleFile = (f: File | undefined) => {
        setFile(f);
        manualOnFileLoad && f && loadIntoManual(f);
    };

    return (
        <div
            className={`card bg-base-200 grow shadow-xl ${height} flex flex-col`}
        >
            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                {title}
            </h2>
            <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">
                {!readOnly ? (
                    <>
                        <div className="flex gap-2">
                            <button
                                className={`btn flex-1 ${mode === "by file" ? "btn-primary" : ""}`}
                                onClick={() => onModeChange("by file")}
                            >
                                By File
                            </button>
                            <button
                                className={`btn flex-1 ${mode === "manual" ? "btn-primary" : ""}`}
                                onClick={chooseManual}
                            >
                                Manual
                            </button>
                        </div>
                        {mode === "manual" ? (
                            <textarea
                                className="textarea textarea-ghost resize-none w-full flex-1 min-h-0"
                                autoComplete="off"
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                            ></textarea>
                        ) : mode === "by file" ? (
                            <div className="flex flex-1 min-h-0">
                                <Dropzone
                                    setFile={handleFile}
                                    file={file}
                                    hint={hint}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center opacity-60">
                                <span className="font-bold">
                                    No data to display
                                </span>
                                <span className="text-sm">
                                    Choose By File to upload one or Manual to
                                    write it
                                </span>
                            </div>
                        )}
                        {error && (
                            <span className="badge badge-error self-start -mt-2">
                                {error}
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        {value ? (
                            <p className="break-words whitespace-pre-wrap overflow-y-auto flex-1 min-h-0 p-2">
                                {value}
                            </p>
                        ) : (
                            <div className="card-body">
                                <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                    {emptyText}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FileOrTextField;

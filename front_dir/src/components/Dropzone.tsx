import { useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { CloudArrowDownIcon } from "@heroicons/react/24/outline";

interface DropzoneProps {
    file: File | undefined;
    setFile: (file: File | undefined) => void;
    hint?: string;
}

const Dropzone = ({
    file,
    setFile,
    hint = "Drag 'n' drop station info file, or click to select file",
}: DropzoneProps) => {
    const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
        maxFiles: 1,
    });

    useEffect(() => {
        if (acceptedFiles.length > 0 && acceptedFiles[0] !== file) {
            setFile(acceptedFiles[0]);
        }
    }, [acceptedFiles, file, setFile]);

    return (
        <section className="w-full p-2 flex">
            <div
                {...getRootProps({
                    className:
                        "w-full border-2 border-dashed cursor-pointer border-neutral-400 rounded-lg p-4 focus:border-violet-500 text-neutral-500",
                    style: {
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: "20px",
                        backgroundColor: "#fafafa",
                        outline: "none",
                        transition: "border .24s ease-in-out",
                    },
                })}
            >
                <input {...getInputProps()} />
                {file ? (
                    <div>
                        <p>{file.name}</p>
                        <p>{file.size} bytes</p>
                    </div>
                ) : (
                    <>
                        <CloudArrowDownIcon className="size-10" />
                        <p>{hint}</p>
                    </>
                )}
            </div>
        </section>
    );
};

export default Dropzone;

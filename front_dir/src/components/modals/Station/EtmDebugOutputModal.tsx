import { CopyButton, Modal } from "@componentsReact";

interface Props {
    output: string;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
}

const EtmDebugOutputModal = ({ output, setStateModal }: Props) => {
    const hasOutput = output.trim().length > 0;

    // console.log(output)

    return (
        <Modal
            close={true}
            modalId={"EtmDebugOutput"}
            size={"lg"}
            setModalState={setStateModal}
        >
            <div className="flex items-center justify-center gap-2 my-2">
                <h3 className="font-bold text-center text-2xl">
                    ETM Debug Output
                </h3>
                {hasOutput && (
                    <CopyButton text={output} iconClassName="size-5" />
                )}
            </div>

            {hasOutput ? (
                <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 text-xs leading-relaxed whitespace-pre overflow-auto max-h-[70vh]">
                    {output}
                </pre>
            ) : (
                <p className="text-center text-gray-500 py-8">
                    No debug output was produced by this ETM run.
                </p>
            )}
        </Modal>
    );
};

export default EtmDebugOutputModal;

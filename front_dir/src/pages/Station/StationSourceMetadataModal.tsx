import { Modal, Spinner } from "@componentsReact";

import { SourcesMetadataData } from "@types";

interface StationSourceMetadataModalProps {
    metadata: SourcesMetadataData | undefined;
    loading: boolean;
    linked: boolean;
    handleCloseModal: () => void;
}

const FIELDS: { key: keyof SourcesMetadataData; label: string }[] = [
    { key: "protocol", label: "PROTOCOL" },
    { key: "fqdn", label: "FQDN" },
    { key: "username", label: "USERNAME" },
    { key: "password", label: "PASSWORD" },
    { key: "path", label: "PATH" },
    { key: "format", label: "FORMAT" },
];

const StationSourceMetadataModal = ({
    metadata,
    loading,
    linked,
    handleCloseModal,
}: StationSourceMetadataModalProps) => {
    return (
        <Modal
            modalId="Station Source Metadata"
            size="md"
            handleCloseModal={handleCloseModal}
            close={false}
        >
            <div className="flex flex-col gap-4 items-center">
                <h2 className="text-2xl font-bold">Metadata Source</h2>
                {loading ? (
                    <Spinner size="lg" />
                ) : !linked ? (
                    <div className="text-center text-neutral text-xl font-bold w-full rounded-md bg-neutral-content p-6">
                        This server has no metadata source configured
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 w-full">
                        {FIELDS.map(({ key, label }) => (
                            <label
                                key={key}
                                className="w-full input input-bordered flex items-center gap-2"
                            >
                                <div className="label">
                                    <span className="font-bold">{label}</span>
                                </div>
                                <span className="grow truncate">
                                    {metadata?.[key] ?? ""}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default StationSourceMetadataModal;

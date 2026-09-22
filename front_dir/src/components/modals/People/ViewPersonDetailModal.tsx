import { useMemo } from "react";
import { Modal, CopyButton } from "@componentsReact";
import { UserIcon } from "@heroicons/react/24/outline";
import { People } from "@types";

interface ViewPersonDetailModalProps {
    Person: People | undefined;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
}

interface ContactField {
    label: string;
    value: string | undefined | null;
}

const ViewPersonDetailModal = ({
    Person,
    setStateModal,
}: ViewPersonDetailModalProps) => {
    const photoSrc = useMemo(() => {
        if (!Person?.photo_actual_file) return null;
        const src = Person.photo_actual_file;
        return src.startsWith("data:image")
            ? src
            : `data:image/jpeg;base64,${src}`;
    }, [Person?.photo_actual_file]);

    const fields: ContactField[] = useMemo(
        () => [
            { label: "First name", value: Person?.first_name },
            { label: "Last name", value: Person?.last_name },
            { label: "Email", value: Person?.email },
            { label: "Phone", value: Person?.phone },
            { label: "Address", value: Person?.address },
            { label: "Institution", value: Person?.institution },
            { label: "Position", value: Person?.position },
        ],
        [Person],
    );

    const vcardText = useMemo(() => {
        if (!Person) return "";
        const lines = [
            "BEGIN:VCARD",
            "VERSION:4.0",
            `FN:${Person.first_name} ${Person.last_name}`,
            `N:${Person.last_name};${Person.first_name};;;`,
            Person.email ? `EMAIL:${Person.email}` : null,
            Person.phone ? `TEL:${Person.phone}` : null,
            // ADR format: po-box;ext-addr;street;locality;region;postal-code;country
            Person.address ? `ADR:;;${Person.address};;;;` : null,
            Person.institution ? `ORG:${Person.institution}` : null,
            Person.position ? `TITLE:${Person.position}` : null,
            "END:VCARD",
        ].filter(Boolean);
        return lines.join("\r\n");
    }, [Person]);

    if (!Person) return null;

    return (
        <Modal
            close={true}
            modalId={"ViewPersonDetail"}
            size={"smPlus"}
            setModalState={setStateModal}
        >
            <div className="flex flex-col items-center gap-4 p-2">
                <div className="flex flex-col items-center gap-2">
                    {photoSrc ? (
                        <img
                            src={photoSrc}
                            alt={`${Person.first_name} ${Person.last_name}`}
                            className="w-28 h-28 rounded-full object-cover shadow-lg"
                        />
                    ) : (
                        <UserIcon className="w-28 h-28 rounded-full text-gray-400 bg-gray-100 p-4" />
                    )}
                    <h3 className="text-xl font-bold">
                        {Person.first_name} {Person.last_name}
                    </h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full mt-2">
                    {fields.map((f) => (
                        <div key={f.label}>
                            <div className="text-xs font-bold text-gray-500 uppercase">
                                {f.label}
                            </div>
                            <div className="text-sm break-words">
                                {f.value && f.value.trim() !== "" ? (
                                    f.label === "Email" ? (
                                        <a
                                            href={`mailto:${f.value}`}
                                            className="link link-hover"
                                        >
                                            {f.value}
                                        </a>
                                    ) : (
                                        f.value
                                    )
                                ) : (
                                    <span className="text-gray-400">—</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col w-full items-end">
                    <div className="mt-2 mx-1">
                        <CopyButton
                            text={vcardText}
                            className="btn btn-ghost btn-sm gap-1"
                            iconClassName="size-6"
                        />
                    </div>
                    <span className="text-gray-600 text-xs">Copy Vcard</span>
                </div>
            </div>
        </Modal>
    );
};

export default ViewPersonDetailModal;

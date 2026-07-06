import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { useClipboard } from "@hooks";

interface CopyButtonProps {
    text: string;
    className?: string;
    iconClassName?: string;
    tooltipClass?: string;
}

const CopyButton = ({
    text,
    className = "",
    iconClassName = "size-6",
    tooltipClass = "z-[9999]",
}: CopyButtonProps) => {
    const { copied, copy } = useClipboard(2000);

    return (
        <button
            type="button"
            className={`${copied ? `tooltip tooltip-open ${tooltipClass}` : ""} hover:scale-125 ${className}`}
            data-tip="Copied!"
            onClick={() => copy(text)}
        >
            <ClipboardDocumentIcon
                className={`cursor-pointer rounded-md  ${iconClassName}`}
            />
        </button>
    );
};

export default CopyButton;

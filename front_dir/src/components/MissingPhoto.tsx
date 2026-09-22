import { PhotoIcon } from "@heroicons/react/24/outline";

interface Props {
    className?: string;
    text?: string;
}

const MissingPhoto = ({
    className = "",
    text = "No image available",
}: Props) => {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-2 bg-base-200 text-gray-400 select-none ${className}`}
        >
            <PhotoIcon className="size-12" />
            <span className="text-sm font-medium">{text}</span>
        </div>
    );
};

export default MissingPhoto;

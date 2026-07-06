import { Rnd } from "react-rnd";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { useAuth, useApi } from "@hooks";
import { useMetadata } from "@hooks/queries";

const StationMetadataLegend = ({ close }: { close: () => void }) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { types, statuses } = useMetadata(api);

    const modalWidth = 420;
    const modalHeight = 420;

    const rndOptions = {
        x: Math.max(0, window.innerWidth / 2 - modalWidth / 2),
        y: Math.max(0, window.innerHeight / 2 - modalHeight / 1.4),
        width: modalWidth,
        height: modalHeight,
    };

    return (
        <Rnd
            default={rndOptions}
            minWidth={420}
            minHeight={520}
            maxHeight={520}
            maxWidth={420}
            bounds={"window"}
            className="z-[100000] card border-[1px] border-neutral-300 shadow-2xl bg-base-100 overflow-clip"
        >
            <div className="sticky top-0 bg-base-100 flex justify-between items-center p-4 border-b border-neutral-200 drag-handle">
                <h2 className="text-xl font-bold">Station Legend</h2>
                <button
                    type="button"
                    onClick={() => close()}
                    className="btn btn-ghost btn-sm btn-square"
                >
                    <XMarkIcon className="size-5" />
                </button>
            </div>

            <div className="p-4 grid grid-cols-1 gap-4 overflow-y-auto h-[calc(100%-64px)] scrollbar-base overflow-x-hidden">
                <div className="card border-[1px] border-neutral-200 bg-base-200/30 flex flex-col h-fit">
                    <div className="p-4">
                        <h3 className="text-lg font-bold mb-3 border-b pb-1 border-neutral-300">
                            Types
                        </h3>
                        <ul className="grid grid-cols-2 gap-x-2 gap-y-3">
                            {types?.map((t) => {
                                const base64 = "data:image/png;base64,";
                                return (
                                    <li
                                        key={t.id}
                                        className="flex items-center space-x-4"
                                    >
                                        <img
                                            src={base64 + t.image}
                                            alt={t.name}
                                            className="size-10 object-contain pointer-events-none"
                                        />
                                        <span className="font-medium text-sm">
                                            {t.name}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                <div className="card border-[1px] border-neutral-200 bg-base-200/30 flex flex-col h-fit">
                    <div className="p-4">
                        <h3 className="text-lg font-bold mb-3 border-b pb-1 border-neutral-300">
                            Statuses
                        </h3>
                        <ul className="grid grid-cols-2 gap-x-2 gap-y-3">
                            {statuses?.map((s) => (
                                <li
                                    key={s.id}
                                    className="flex items-center space-x-4"
                                >
                                    <div
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                            backgroundColor: "#000",
                                            borderRadius: "50%",
                                        }}
                                        className={`${s.color}`}
                                    ></div>
                                    <span className="font-medium text-sm">
                                        {s.name}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </Rnd>
    );
};

export default StationMetadataLegend;

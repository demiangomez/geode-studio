import { Rnd } from "react-rnd";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { useAuth, useApi } from "@hooks";
import { useMetadata } from "@hooks/queries";

import StationLegendContent from "@components/map/StationLegendContent";

const StationMetadataLegend = ({ close }: { close: () => void }) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { types, statuses } = useMetadata(api, {
        only: ["types", "statuses"],
    });

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
                <StationLegendContent types={types} statuses={statuses} />
            </div>
        </Rnd>
    );
};

export default StationMetadataLegend;

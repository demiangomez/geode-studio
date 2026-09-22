// Forma común a las tabs de estación (Rinex/Sources/People/Visits/TimeSeries/Events):

import { StationSubtituleSkeleton } from "./StationMapPhotoSkeleton";

// CardContainer + TableCard — card clara con header y un bloque de contenido más gris
const StationTabSkeleton = () => (
    <div className="flex flex-col pt-6 w-full px-4">
        <StationSubtituleSkeleton />
        <div className="card bg-base-200 p-4 space-y-4 overflow-hidden">
            <div className="flex w-full justify-between items-center flex-wrap gap-2">
                <div
                    className="skeleton h-6 w-28"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
                ></div>
                <div
                    className="skeleton h-10 w-32"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
                ></div>
            </div>
            <div
                className="skeleton w-full h-[220px]"
                style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
            ></div>
        </div>
    </div>
);

export default StationTabSkeleton;

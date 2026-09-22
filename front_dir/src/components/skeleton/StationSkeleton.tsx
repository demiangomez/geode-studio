import { useLocation } from "react-router-dom";
import StationMapPhotoSkeleton from "./StationMapPhotoSkeleton";
import StationTabSkeleton from "./StationTabSkeleton";

const TAB_SEGMENTS = [
    "rinex",
    "sources",
    "people",
    "visits",
    "timeseries",
    "events",
];

const StationSkeleton = () => {
    const { pathname } = useLocation();
    const isTab = TAB_SEGMENTS.some((seg) =>
        pathname.replace(/\/$/, "").endsWith(`/${seg}`),
    );

    return (
        <div className="flex w-full">
            <div
                className="w-20 flex-shrink-0 bg-gray-800"
                style={{ minHeight: "calc(100vh - 8vh)" }}
            ></div>
            <div className="w-full min-w-0 flex flex-col pt-20">
                <div className="flex justify-center">
                    <div
                        className="skeleton w-64 h-[60px]"
                        style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
                    ></div>
                </div>
                {isTab ? <StationTabSkeleton /> : <StationMapPhotoSkeleton />}
            </div>
        </div>
    );
};

export default StationSkeleton;

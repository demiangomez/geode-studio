import CardContainer from "@components/CardContainer";
import MapSkeleton from "./MapSkeleton";
import PhotoSkeleton from "./PhotoSkeleton";

export const StationSubtituleSkeleton = () => (
    <div className="w-full h-8"></div>
);

// Clona la estructura real de StationMain (MapStationOL + Photo) para que su montaje no salte
const StationMapPhotoSkeleton = () => (
    <div>
        <StationSubtituleSkeleton />
        <div className="flex flex-col items-center justify-center space-y-4 px-2 pb-4">
            <div className="flex w-full space-x-2 relative">
                <div className="z-10 pt-6 w-6/12 flex justify-center">
                    <div className="w-full" style={{ position: "relative" }}>
                        <MapSkeleton
                            styles={{
                                backgroundColor: "rgb(202, 202, 202)",
                                paddingBottom: "0.7rem",
                            }}
                            height="55vh"
                        />
                    </div>
                </div>
                <div className="w-6/12">
                    <CardContainer
                        title={"Photos"}
                        height={true}
                        addButton={false}
                    >
                        <PhotoSkeleton />
                    </CardContainer>
                </div>
            </div>
        </div>
    </div>
);

export default StationMapPhotoSkeleton;

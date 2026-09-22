import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CountryFlag, MapSkeleton, Photo } from "@componentsReact";
import MapStationOL from "@components/map/ol/MapStationOL";
import { StationSubtituleSkeleton } from "@components/skeleton/StationMapPhotoSkeleton";

import { hasDifferences } from "@utils";

import {
    StationData,
    StationImagesData,
    StationMetadataServiceData,
    StationVisitsData,
} from "@types";

interface OutletContext {
    station: StationData;
    reStation: StationData;
    stationMeta: StationMetadataServiceData;
    images: StationImagesData[];
    visits: StationVisitsData[] | undefined;
    photoLoading: boolean;
    getStationImages: () => void;
}

interface VisitsStates {
    visitId: number;
    checked: boolean;
    color: string;
}

const StationMain = () => {
    const {
        station,
        reStation,
        stationMeta,
        images,
        visits,
        photoLoading,
        getStationImages,
    } = useOutletContext<OutletContext>();

    const [changeMeta, setChangeMeta] = useState<boolean>(false);

    const [changeKml, setChangeKml] = useState<VisitsStates[]>([]);

    const [mapFlicker, setMapFlicker] = useState<boolean>(true);

    const definitiveStation =
        station && reStation && hasDifferences(station, reStation)
            ? reStation
            : station;

    const routesScrollerProps = useMemo(
        () => ({
            visits: visits ?? [],
            changeKml,
            changeMeta,
            setChangeKml,
            setChangeMeta,
            stationMeta,
        }),
        [visits, changeKml, changeMeta, stationMeta],
    );

    const stationCountry = useMemo(() => {
        if (!station) return <StationSubtituleSkeleton />;

        const iso3 = station?.country_code ?? "ATA";

        return (
            <div className="flex w-full justify-center items-center">
                <CountryFlag iso3={iso3} className="mr-2 w-[30px] h-[20px]" />
                <h1 className="text-2xl font-base text-center">
                    {iso3?.toUpperCase()}
                </h1>
            </div>
        );
    }, [station]);

    useEffect(() => {
        setChangeMeta(
            stationMeta &&
                stationMeta.navigation_actual_file !== null &&
                stationMeta.navigation_actual_file !== "",
        );
    }, [stationMeta]);

    useEffect(() => {
        if (visits && stationMeta) {
            setMapFlicker(false);
        }
    }, [visits, stationMeta]);

    return (
        <div>
            {stationCountry}
            <div className="flex flex-col items-center justify-center space-y-4 px-2 pb-4">
                <div className="flex w-full space-x-2 relative">
                    {mapFlicker && (
                        <div className="absolute z-[1000] pt-6 w-6/12 h-[55vh]">
                            <MapSkeleton
                                styles={{
                                    backgroundColor: "rgb(202, 202, 202)",
                                    paddingBottom: "0.7rem",
                                }}
                                height="55vh"
                            />
                        </div>
                    )}

                    <MapStationOL
                        station={definitiveStation}
                        visitScrollerProps={routesScrollerProps}
                    />

                    <Photo
                        loader={photoLoading}
                        phArray={
                            images?.map((img) => {
                                return {
                                    id: img.id ?? 0,
                                    actual_image: img.actual_image ?? "",
                                    description: img.description ?? "",
                                    name: img.name ?? "",
                                };
                            }) ?? []
                        }
                        reFetch={() => {
                            getStationImages();
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default StationMain;

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { StationInfoModal, StationMetadataModal } from "@componentsReact";

import {
    CalendarDaysIcon,
    ClipboardDocumentListIcon,
    CodeBracketIcon,
    DocumentTextIcon,
    InformationCircleIcon,
    PresentationChartLineIcon,
    UsersIcon,
    ServerStackIcon,
} from "@heroicons/react/24/outline";

import { GetParams, StationData, StationMetadataServiceData } from "@types";
import { showModal } from "@utils";

interface SidebarProps {
    station: StationData | undefined;
    mainParams?: GetParams;
    stationMeta?: StationMetadataServiceData | undefined;
    refetchStationMeta?: () => void;
    refetch?: () => void;
}

interface SidebarItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, onClick }: SidebarItemProps) => (
    <li
        className="tooltip tooltip-right flex justify-center w-full"
        data-tip={label}
    >
        <button
            className="flex items-center justify-center w-full py-3 rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
            onClick={onClick}
        >
            <Icon className="h-7 w-7 hover:scale-110 transition-transform" />
        </button>
    </li>
);

const Sidebar = ({
    station,
    mainParams,
    stationMeta,
    refetch,
}: SidebarProps) => {
    const icons: Record<string, React.ComponentType<any>> = {
        Instruments: InformationCircleIcon,
        Metadata: CodeBracketIcon,
        "Time Series": PresentationChartLineIcon,
        Rinex: DocumentTextIcon,
        Visits: CalendarDaysIcon,
        People: UsersIcon,
        Events: ClipboardDocumentListIcon,
        "Data Sources": ServerStackIcon,
    };

    const sidebarItems = [
        "Instruments",
        "Metadata",
        "Time Series",
        "Rinex",
        "Data Sources",
        "Visits",
        "People",
        "Events",
    ];

    const stationPages = [
        "Visits",
        "Rinex",
        "Data Sources",
        "Time Series",
        "People",
        "Events",
    ];

    const navigate = useNavigate();

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const formatTitle = (title: string) => {
        const formattedTitle = title.replace(/ /g, "").toLowerCase();
        return formattedTitle === "datasources" ? "sources" : formattedTitle;
    };

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    if (!station) return null;


    return (
        <>
            <div
                className="sidebar relative z-[100004] w-20 flex-shrink-0 bg-gray-800"
                style={{ minHeight: `calc(100vh - 8vh)` }}
            >
                <ul className="flex flex-col items-center pt-[8vh] mt-10 px-2 w-full gap-2">
                    {sidebarItems.map((title, idx) => {
                        const IconComponent = icons[title];
                        if (!IconComponent) return null;
                        return (
                            <SidebarItem
                                key={title + idx}
                                icon={IconComponent}
                                label={title}
                                onClick={() => {
                                    stationPages.includes(title)
                                        ? navigate(
                                            `/${station.network_code}/${station.station_code}/${formatTitle(title)}`,
                                            {
                                                state: {
                                                    ...station,
                                                    mainParams,
                                                },
                                            },
                                        )
                                        : setModals({
                                            show: true,
                                            title,
                                            type: "none",
                                        });
                                }}
                            />
                        );
                    })}
                </ul>
            </div>

            {modals?.show && modals.title === "Instruments" && (
                <StationInfoModal
                    close={false}
                    station={station}
                    size={"xl"}
                    refetch={refetch ? refetch : () => { }}
                    setModalState={setModals}
                />
            )}
            {modals?.show && modals.title === "Metadata" && (
                <StationMetadataModal
                    close={false}
                    station={station}
                    stationMetaMain={stationMeta}
                    size={"xl"}
                    refetch={refetch ? refetch : () => { }}
                    setModalState={setModals}
                />
            )}
        </>
    );
};

export default React.memo(Sidebar);

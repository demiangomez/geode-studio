import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import { Modal, StationSelectList } from "@componentsReact";

import { useAuth, useApi } from "@hooks";
import { useStationCatalog, useStationVisits } from "@hooks/queries";

import { CampaignsData, StationData } from "@types";

interface Props {
    campaign: CampaignsData | undefined;
    setCampaign: React.Dispatch<
        React.SetStateAction<CampaignsData | undefined>
    >;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
}

const StationSelectModal = ({
    campaign,
    setCampaign,
    setStateModal,
}: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const navigate = useNavigate();

    const [tab, setTab] = useState<1 | 2>(1);

    const [station, setStation] = useState<StationData | undefined>(undefined);

    const { data: stationsResult, isLoading: loadingStations } =
        useStationCatalog(api);

    const { data: visits, isLoading: loadingVisits } = useStationVisits(
        api,
        station?.api_id,
    );

    const selectTab = (next: 1 | 2) => {
        setTab(next);
        setStation(undefined);
    };

    return (
        <Modal
            close={false}
            modalId={"SelectStation"}
            size={"sm"}
            handleCloseModal={() => setCampaign(undefined)}
            setModalState={setStateModal}
        >
            <div className="flex p-4 flex-col">
                <div role="tablist" className="tabs tabs-bordered mb-6">
                    <a
                        role="tab"
                        onClick={() => selectTab(1)}
                        className={`tab ${tab === 1 && "tab-active font-bold"} `}
                    >
                        Add new visit
                    </a>
                    <a
                        role="tab"
                        onClick={() => selectTab(2)}
                        className={`tab ${tab === 2 && "tab-active font-bold"}`}
                    >
                        Add existing visit
                    </a>
                </div>

                {tab === 1 ? (
                    <StationSelectList
                        stations={stationsResult?.data}
                        isLoading={loadingStations}
                        selectedApiId={undefined}
                        onSelect={(s) =>
                            navigate(
                                `/${s.network_code}/${s.station_code}/visits`,
                                { state: campaign },
                            )
                        }
                        height={256}
                        collapsible
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        <StationSelectList
                            stations={stationsResult?.data}
                            isLoading={loadingStations}
                            selectedApiId={station?.api_id}
                            onSelect={setStation}
                            height={256}
                            collapsible
                        />

                        {!station ? (
                            <span className="text-center font-bold text-xl">
                                Select a station
                            </span>
                        ) : loadingVisits ? (
                            <div className="w-full flex justify-center">
                                <span className="loading loading-spinner loading-lg" />
                            </div>
                        ) : visits && visits.length > 0 ? (
                            <ul className="menu bg-base-200 rounded-box w-full max-h-56 overflow-y-auto">
                                <li>
                                    <h2 className="menu-title">Visits</h2>
                                    <ul>
                                        {visits.map((v) => (
                                            <li
                                                key={v.id}
                                                className="w-full flex"
                                            >
                                                <Link
                                                    to={`/${station.network_code}/${station.station_code}/visits`}
                                                    state={{ visitDetail: v }}
                                                    className="font-bold text-lg"
                                                >
                                                    {v.date}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            </ul>
                        ) : (
                            <span className="text-center font-bold text-xl">
                                No visits for this station
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default StationSelectModal;

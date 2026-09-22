import { Modal, CopyButton } from "@componentsReact";

import { StationEvents } from "@types";

import { formatValue } from "@utils";

interface Props {
    event: StationEvents | undefined;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    showNetworkStation?: boolean;
}

const EventsDetail = ({
    event,
    setStateModal,
    showNetworkStation = false,
}: Props) => {
    const keysToIgnore = showNetworkStation
        ? ["event_id"]
        : ["event_id", "network_code", "station_code"];

    const handleDescription = (value: string) => {
        if (value.includes("comments")) {
            const comments = value.match(/"comments":"(.*?)"/);
            if (comments && comments[1]) {
                return comments[1].replace(/\\n/g, "<br />");
            }
        }
        return value;
    };

    return (
        <Modal
            close={false}
            modalId={"EventsDetail"}
            size={"lg"}
            setModalState={setStateModal}
        >
            <h1 className="text-center text-2xl font-bold">Event Details</h1>
            <div className="grid grid-cols-3 grid-flow-dense">
                {event &&
                    Object.entries(event).map(([key, value]) => {
                        if (keysToIgnore.includes(key)) return null;
                        if (key === "description") {
                            const newValue = handleDescription(value);
                            return (
                                <div
                                    key={key}
                                    className={`card bg-base-200 shadow-xl col-span-3 m-2 p-3`}
                                >
                                    <h2 className="card-title justify-between border-b-2 border-base-300 p-2">
                                        {key.replace(/_/g, " ").toUpperCase()}
                                        <CopyButton
                                            text={formatValue(value, false)}
                                            iconClassName="size-6"
                                        />
                                    </h2>
                                    <div className="card-body font-medium">
                                        <span className="whitespace-pre-wrap">
                                            {newValue}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={key}
                                className={`card bg-base-200 shadow-xl ${key === "description" ? "col-span-3" : ""} m-2 p-3`}
                            >
                                <h2 className="card-title justify-between border-b-2 border-base-300 p-2">
                                    {key.replace(/_/g, " ").toUpperCase()}
                                </h2>
                                <div className="card-body font-medium">
                                    <span className="whitespace-pre-wrap">
                                        {formatValue(value, false)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </Modal>
    );
};

export default EventsDetail;

import Overlay from "ol/Overlay";
import { PopupChildren } from "@componentsReact";
import { GetParams, StationData } from "@types";

interface Props {
    popupRef: React.RefObject<HTMLDivElement>;
    popupOverlay: React.RefObject<Overlay | null>;
    showPopup: boolean;
    fromMain: boolean | undefined;
    reload?: boolean;
    mainParams?: GetParams | undefined;
    station: StationData | undefined | null;
    kmlPoint?: { description: string; coordinate: number[] } | null;
    setSelectedStation?: React.Dispatch<
        React.SetStateAction<StationData | null>
    >;
    setSelectedKmlPoint?: React.Dispatch<
        React.SetStateAction<{
            description: string;
            coordinate: number[];
        } | null>
    >;
}

const Popup = ({
    popupRef,
    showPopup,
    fromMain,
    reload,
    mainParams,
    popupOverlay,
    station,
    kmlPoint,
    setSelectedStation,
    setSelectedKmlPoint,
}: Props) => {
    const handleClosePopup = () => {
        popupOverlay.current?.setPosition(undefined);
        setSelectedStation?.(null);
        if (setSelectedKmlPoint) {
            setSelectedKmlPoint(null);
        }
    };

    // Don't render if neither station nor kmlPoint
    if (!showPopup || (!station && !kmlPoint)) {
        return <div ref={popupRef} className="ol-popup-container" />;
    }

    return (
        <div ref={popupRef} className="ol-popup-container">
            <div
                className="ol-popup"
                style={
                    kmlPoint
                        ? { maxWidth: "600px", minWidth: "300px" }
                        : undefined
                }
            >
                <button className="ol-popup-closer" onClick={handleClosePopup}>
                    ✕
                </button>

                {station && (
                    <PopupChildren
                        key={station.api_id}
                        station={station}
                        fromMain={fromMain}
                        reload={reload}
                        mainParams={mainParams}
                    />
                )}

                {kmlPoint && (
                    <div
                        dangerouslySetInnerHTML={{
                            __html: kmlPoint.description,
                        }}
                    />
                )}

                <div className="ol-popup-arrow" />
                <div className="ol-popup-arrow-border" />
            </div>
        </div>
    );
};

export default Popup;

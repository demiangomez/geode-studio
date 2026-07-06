import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

import { useApi, useAuth } from "@hooks";
import { useStationPdf } from "@hooks/queries";

import { Errors, StationData } from "@types";

interface Props {
    station: StationData | undefined;
    setMessage: React.Dispatch<
        React.SetStateAction<{
            error: boolean | undefined;
            msg: string;
            errors?: Errors;
        }>
    >;
}

const PdfContainer = ({ station, setMessage }: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const reportMutation = useStationPdf(api);

    const openReport = () => {
        if (!station?.api_id) return;
        setMessage({ error: undefined, msg: "" });

        // la pestaña se abre sincrónicamente en el click para evitar el popup blocker
        const reportWindow = window.open("", "_blank");
        if (!reportWindow) {
            setMessage({
                error: true,
                msg: "The browser blocked the report tab, allow popups for this site",
            });
            return;
        }
        reportWindow.document.write("<p>Loading station report...</p>");

        reportMutation.mutate(String(station.api_id), {
            onSuccess: (data) => {
                if (reportWindow.closed) return;
                reportWindow.document.open();
                reportWindow.document.write(data.html);
                reportWindow.document.close();
            },
            onError: (error) => {
                reportWindow.close();
                setMessage({ error: true, msg: error.message });
            },
        });
    };

    return (
        <button
            className="hover:scale-110 btn-ghost rounded-lg p-1 transition-all align-top"
            title="Open station report"
            disabled={reportMutation.isPending}
            onClick={openReport}
        >
            <DocumentArrowDownIcon className="size-6" />
        </button>
    );
};

export default PdfContainer;

import { useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { dateFromDay, dayFromDate } from "@utils";

interface GregorianDatePickerProps {
    year: string | number;
    doy: string | number;
    onChange: (year: string, doy: string) => void;
    label?: string;
    disabled?: boolean;
    // Id de un nodo donde portalear el calendario (para escapar el overflow de un
    // modal). Si se omite, el popup se renderiza inline como hasta ahora.
    portalId?: string;
    labelAbove?: boolean;
}

const GregorianDatePicker = ({
    year,
    doy,
    onChange,
    label = "Date",
    disabled = false,
    portalId,
    labelAbove = false,
}: GregorianDatePickerProps) => {
    const selectedDate = useMemo(() => {
        if (year === "" || year === undefined || doy === "" || doy === undefined)
            return null;
        const date = dateFromDay(`${year} ${doy}`);
        return isNaN(date.getTime()) ? null : date;
    }, [year, doy]);

    const handleChange = (date: Date | null) => {
        if (!date || isNaN(date.getTime())) return;
        const [newYear, newDoy] = dayFromDate(date)?.split(" ") ?? ["", ""];
        onChange(newYear, newDoy);
    };

    const formatted = selectedDate
        ? selectedDate.toISOString().split("T")[0]
        : "";

    const datePicker = (
        <DatePicker
            selected={selectedDate}
            onChange={handleChange}
            disabled={disabled}
            showYearDropdown
            scrollableYearDropdown
            yearDropdownItemNumber={100}
            showMonthDropdown
            dateFormat="yyyy-MM-dd"
            wrapperClassName="grow"
            preventOpenOnFocus
            // Portalea el calendario fuera del .modal-box (su overflow + transform
            // lo recortarían/scrollearían) pero dentro del <dialog> (top layer).
            portalId={portalId}
            customInput={
                <button
                    type="button"
                    disabled={disabled}
                    className="flex items-center justify-between gap-2 grow text-left w-full disabled:cursor-not-allowed"
                >
                    <span className={formatted ? "" : "text-gray-500"}>
                        {formatted || "Choose date"}
                    </span>
                    <CalendarDaysIcon className="size-5 flex-shrink-0" />
                </button>
            }
        />
    );

    if (labelAbove) {
        return (
            <div className="flex flex-col w-full min-w-0">
                <div className="flex items-end px-1 min-h-[1.25rem]">
                    <span className="font-bold text-xs truncate">
                        {label.toUpperCase()}
                    </span>
                </div>
                <label className="w-full input input-bordered flex items-center gap-2">
                    {datePicker}
                </label>
            </div>
        );
    }

    return (
        <label className="w-full input input-bordered flex items-center justify-center gap-2 h-16">
            <div className="label">
                <span className="font-bold">{label.toUpperCase()}</span>
            </div>
            {datePicker}
        </label>
    );
};

export default GregorianDatePicker;

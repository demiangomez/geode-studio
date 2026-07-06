import GregorianDatePicker from "./GregorianDatePicker";

interface DateRangePickerProps {
    yearFrom: string | number;
    doyFrom: string | number;
    yearTo: string | number;
    doyTo: string | number;
    onChangeFrom: (year: string, doy: string) => void;
    onChangeTo: (year: string, doy: string) => void;
    labelFrom?: string;
    labelTo?: string;
    disabled?: boolean;
}

const DateRangePicker = ({
    yearFrom,
    doyFrom,
    yearTo,
    doyTo,
    onChangeFrom,
    onChangeTo,
    labelFrom = "Fecha inicio",
    labelTo = "Fecha fin",
    disabled = false,
}: DateRangePickerProps) => {
    return (
        <div className="flex flex-col gap-2 w-full">
            <GregorianDatePicker
                year={yearFrom}
                doy={doyFrom}
                onChange={onChangeFrom}
                label={labelFrom}
                disabled={disabled}
            />
            <GregorianDatePicker
                year={yearTo}
                doy={doyTo}
                onChange={onChangeTo}
                label={labelTo}
                disabled={disabled}
            />
        </div>
    );
};

export default DateRangePicker;

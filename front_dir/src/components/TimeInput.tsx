interface TimeInputProps {
    value: string;
    onChange: (value: string) => void;
    // Segundos entre valores del input nativo: 60 muestra HH:MM, 1 muestra HH:MM:SS
    step?: 1 | 60;
    className?: string;
    disabled?: boolean;
}

// Componente de modulo a proposito: definido dentro de un render se remonta en
// cada tecla y el input pierde el foco (bug que tuvo DateTimePicker).
const TimeInput = ({
    value,
    onChange,
    step = 60,
    className,
    disabled = false,
}: TimeInputProps) => (
    <input
        type="time"
        step={step}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(e) => onChange(e.target.value)}
    />
);

export default TimeInput;

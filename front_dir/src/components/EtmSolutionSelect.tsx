interface EtmSolutionSelectProps {
    solutions: string[];
    selected: string;
    onChange: (solution: string) => void;
    disabled?: boolean;
    // Opción puntual a deshabilitar (p.ej. "GAMIT" si la estación no tiene stacks).
    optionDisabled?: string;
    label?: string;
}

const EtmSolutionSelect = ({
    solutions,
    selected,
    onChange,
    disabled = false,
    optionDisabled,
    label = "Solution",
}: EtmSolutionSelectProps) => {
    return (
        <label className="form-control">
            <div className="label">
                <span className="text-lg font-semibold">{label}</span>
            </div>
            <select
                className="select select-bordered"
                value={selected}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
            >
                {solutions.map((sol) => (
                    <option
                        key={sol}
                        value={sol}
                        disabled={sol === optionDisabled}
                    >
                        {sol}
                    </option>
                ))}
            </select>
        </label>
    );
};

export default EtmSolutionSelect;

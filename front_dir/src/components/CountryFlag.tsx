import { findFlagUrlByIso3Code } from "country-flags-svg-v2";

interface CountryFlagProps {
    iso3: string | null | undefined;
    className?: string;
}

// ATA (Antartida) es el fallback historico de la app para estaciones sin pais.
const CountryFlag = ({
    iso3,
    className = "w-[30px] h-[20px]",
}: CountryFlagProps) => {
    const code = iso3 || "ATA";
    return (
        <img
            src={findFlagUrlByIso3Code(code)}
            alt={code}
            className={className}
        />
    );
};

export default CountryFlag;

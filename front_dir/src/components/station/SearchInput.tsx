import React, {
    useEffect,
    useRef,
    useState,
    useMemo,
    useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "@componentsReact";

import { GetParams, StationData } from "@types";

import { useAuth, useApi, useClickOutside } from "@hooks";
import { useMetadata } from "@hooks/queries";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface SearchInputProps {
    stations: StationData[] | undefined;
    params: GetParams;
    setParams: React.Dispatch<React.SetStateAction<GetParams>>;
    setStation: React.Dispatch<React.SetStateAction<StationData | undefined>>;
    setPosToFly: (
        pos:
            | [number, number]
            | ((
                  prev: [number, number] | undefined,
              ) => [number, number] | undefined)
            | undefined,
    ) => void;
}

const EMPTY_ARRAY: StationData[] = [];

const SearchInput = ({
    stations,
    params,
    setParams,
    setPosToFly,
}: SearchInputProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const navigate = useNavigate();

    const location = useLocation();

    const locationState = location.state as
        | (StationData & { mainParams?: GetParams })
        | null;

    const [dropdown, setDropdown] = useState<{
        type: undefined | string;
        dropdown: boolean;
    }>({ type: undefined, dropdown: false });

    const codeSelected = (params.country_code ?? "").toUpperCase();
    const networkSelected = (params.network_code ?? "").toUpperCase();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const { countries, networks } = useMetadata(api, {
        only: ["countries", "networks"],
    });

    const filteredStations = useMemo(() => {
        const baseStations = stations ?? EMPTY_ARRAY;
        if (!params.station_code) return baseStations;
        const searchInputLower = params.station_code.toLowerCase();
        return baseStations.filter((station) =>
            station.station_code?.toLowerCase().includes(searchInputLower),
        );
    }, [stations, params.station_code]);

    const handleCountryChange: React.Dispatch<React.SetStateAction<string>> =
        useCallback(
            (value) => {
                const newValue =
                    typeof value === "function" ? value(codeSelected) : value;
                setParams((p) => ({
                    ...p,
                    country_code: newValue,
                    // Sin contexto de navegación, cambiar país resetea la red
                    ...(locationState ? {} : { network_code: "" }),
                }));
            },
            [codeSelected, locationState, setParams],
        );

    const handleNetworkChange: React.Dispatch<React.SetStateAction<string>> =
        useCallback(
            (value) => {
                const newValue =
                    typeof value === "function"
                        ? value(networkSelected)
                        : value;
                setParams((p) => ({
                    ...p,
                    network_code: newValue.toLowerCase(),
                }));
            },
            [networkSelected, setParams],
        );

    useClickOutside([dropdownRef, inputRef], () => setIsDropdownOpen(false));

    useEffect(() => {
        setSelectedIndex((prev) => (prev === -1 ? prev : -1));
    }, [filteredStations, isDropdownOpen]);

    useEffect(() => {
        if (selectedIndex >= 0 && dropdownRef.current) {
            const selectedElement = dropdownRef.current.querySelector(
                `li:nth-child(${selectedIndex + 1})`,
            );
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: "nearest",
                });
            }
        }
    }, [selectedIndex]);

    useEffect(() => {
        if (params.station_code && filteredStations.length === 1) {
            const s = filteredStations[0];
            setPosToFly((prev) => {
                if (prev && prev[0] === s.lat && prev[1] === s.lon) return prev;
                return [s.lat, s.lon];
            });
        }
    }, [filteredStations, params.station_code, setPosToFly]);

    const handleStationSelect = useCallback(
        (station: StationData) => {
            setParams((prev) => ({
                ...prev,
                station_code: station.station_code ?? "",
            }));
            setIsDropdownOpen(false);
            setSelectedIndex(-1);
            setPosToFly([station.lat, station.lon]);
            navigate(`/${station.network_code}/${station.station_code}`, {
                state: { ...station, mainParams: params },
            });
        },
        [navigate, params, setParams, setPosToFly],
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedIndex >= 0 && selectedIndex < filteredStations.length) {
            handleStationSelect(filteredStations[selectedIndex]);
            return;
        }

        if (params.station_code && filteredStations.length > 0) {
            const exactMatch = filteredStations.find(
                (s) =>
                    s.station_code?.toLowerCase() ===
                    params.station_code?.toLowerCase(),
            );
            handleStationSelect(exactMatch || filteredStations[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setParams((prev) => ({
            ...prev,
            station_code: value,
        }));
        setIsDropdownOpen(value.length > 0);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isDropdownOpen || filteredStations.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) =>
                prev < filteredStations.length - 1 ? prev + 1 : prev,
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > -1 ? prev - 1 : prev));
        } else if (e.key === "Escape") {
            setIsDropdownOpen(false);
            setSelectedIndex(-1);
        }
    };

    const handleClearFilters = useCallback(() => {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);

        if (location.state) {
            navigate(location.pathname, { replace: true, state: {} });
        }

        setParams((prev) => ({
            ...prev,
            country_code: "",
            network_code: "",
            station_code: "",
        }));
    }, [location, navigate, setParams]);

    const handleInputClick = () => {
        if (params.station_code) {
            setIsDropdownOpen(true);
        }
    };

    return (
        <div className="bg-inherit h-16 flex flex-col items-center justify-center text-black text-2xl w-full self-center relative">
            <form
                onSubmit={handleSubmit}
                className="relative w-full h-full rounded-md bg-white flex flex-nowrap items-stretch"
            >
                <Dropdown
                    position="first"
                    type="country"
                    dropdown={dropdown}
                    data={countries}
                    dataSelected={codeSelected}
                    setDataSelected={handleCountryChange as any}
                    setDropdown={setDropdown}
                />
                <Dropdown
                    type="networks"
                    dropdown={dropdown}
                    data={networks}
                    dataSelected={networkSelected}
                    setDataSelected={handleNetworkChange as any}
                    setDropdown={setDropdown}
                />

                <div className="w-full">
                    <button
                        type="button"
                        className="btn btn-circle absolute -top-4 z-10 left-[125px] btn-error"
                        title="Clear filters"
                        style={{
                            width: "30px",
                            height: "30px",
                            minHeight: "10px",
                        }}
                        onClick={handleClearFilters}
                    >
                        <XMarkIcon className="size-6" />
                    </button>
                    <input
                        id="search-station"
                        type="text"
                        autoComplete="off"
                        className="w-full h-full peer placeholder-transparent
                    bg-transparent bg-clip-padding py-[0.25rem] pl-4
                    text-2xl font-normal leading-[1.6] text-surface outline-none transition 
                    duration-200 ease-in-out focus:z-[3] focus:border-primary 
                    focus:shadow-inset focus:outline-none motion-reduce:transition-none  
                    autofill:shadow-autofill disabled:bg-gray-200 
                    disabled:cursor-not-allowed disabled:text-gray-500 disabled:text"
                        placeholder="Search for station code"
                        aria-label="station"
                        // disabled={!networkSelected || !codeSelected}
                        title={
                            !networkSelected && codeSelected
                                ? "Select a network"
                                : networkSelected && !codeSelected
                                  ? "Select a country"
                                  : undefined
                        }
                        aria-describedby="addon-wrapping"
                        onClick={handleInputClick}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        value={params.station_code}
                        ref={inputRef}
                    />
                    <label
                        className="absolute left-[170px] text-black text-xs pointer-events-none
                        transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4
                         peer-focus:-top-0 peer-focus:text-xs peer-focus:left-[170px]"
                    >
                        Search for station code
                    </label>
                </div>
                <button
                    className="flex justify-center items-center hover:bg-gray-100 rounded-r-md w-2/12 px-2
                    disabled:bg-gray-200 
                    disabled:cursor-not-allowed disabled:text-gray-500 disabled:text
                    "
                    type="submit"
                    // disabled={!networkSelected || !codeSelected}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                        />
                    </svg>
                </button>
            </form>
            <div
                className={
                    isDropdownOpen && filteredStations.length > 0
                        ? "absolute top-full left-0 w-full pt-2 z-50"
                        : "hidden"
                }
                ref={dropdownRef}
            >
                <ul
                    tabIndex={0}
                    className="dropdown-content z-30 menu divide-y-2 
                    divide-neutral items-center w-full text-white 
                    shadow bg-gray-800 rounded-box max-h-[400px]"
                    style={{
                        overflowY: "auto",
                        flexDirection: "column",
                        flexWrap: "nowrap",
                        overflowX: "hidden",
                    }}
                >
                    {filteredStations.map((station, index) => (
                        <li
                            key={station?.api_id}
                            className="text-lg w-full"
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <button
                                type="button"
                                onClick={() => handleStationSelect(station)}
                                className={`w-full justify-center ${selectedIndex === index ? "bg-gray-700" : ""}`}
                            >
                                {`${station?.network_code?.toUpperCase()}.${station?.station_code?.toUpperCase()}`}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default SearchInput;

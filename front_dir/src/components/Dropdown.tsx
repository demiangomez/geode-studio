import { CountriesData, NetworkData, DropdownState } from "@types";
import { useState, useMemo } from "react";

interface DropdownProps {
    position?: string;
    type: string;
    dropdown: DropdownState;
    data: any;
    dataSelected: string;
    setDataSelected: React.Dispatch<React.SetStateAction<string>>;
    setDropdown: React.Dispatch<React.SetStateAction<DropdownState>>;
}

const Dropdown = ({
    position,
    type,
    dropdown,
    data,
    dataSelected,
    setDataSelected,
    setDropdown,
}: DropdownProps) => {
    const [countryInput, setCountryInput] = useState("");
    const [networkInput, setNetworkInput] = useState("");

    const filteredCountriesData = useMemo(() => {
        if (!data) return [];
        if (!countryInput) return data;
        const lowerInput = countryInput.toLowerCase();
        return data.filter(
            (country: CountriesData) =>
                country?.three_digits_code
                    ?.toLowerCase()
                    .includes(lowerInput) ||
                country?.name?.toLowerCase().includes(lowerInput),
        );
    }, [data, countryInput]);

    const filteredNetworksData = useMemo(() => {
        if (!data) return [];
        let filtered = data;
        if (networkInput) {
            const lowerInput = networkInput.toLowerCase().trim();
            filtered = data.filter(
                (nc: NetworkData) =>
                    nc?.network_code?.toLowerCase().includes(lowerInput) ||
                    nc?.network_name?.toLowerCase().includes(lowerInput),
            );
        }
        return [...filtered].sort((a: NetworkData, b: NetworkData) => {
            if (a?.network_code?.includes("?")) return 1;
            if (b?.network_code?.includes("?")) return -1;
            return a.network_code?.localeCompare(b.network_code) ?? 0;
        });
    }, [data, networkInput]);

    const buttonStyles =
        position === "first"
            ? "whitespace-nowrap  h-full bg-gray-800 shadow-sm rounded-l-md flex items-center justify-center w-[70px] py-2 text-sm font-medium text-white hover:bg-gray-50 hover:bg-gray-500 focus:outline-none"
            : "whitespace-nowrap  h-full bg-gray-800 shadow-sm flex items-center justify-center w-[70px] py-2 text-sm font-medium text-white hover:bg-gray-50 hover:bg-gray-500 focus:outline-none";

    const handleItemSelect = (code: string) => {
        setDataSelected(code);
        setDropdown({
            dropdown: false,
            type: undefined,
        });
        setCountryInput("");
        setNetworkInput("");
    };

    return (
        <div
            className="dropdown dropdown-end"
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropdown((prev) => {
                        if (prev.type === type) {
                            return { type: undefined, dropdown: false };
                        }
                        return prev;
                    });
                }
            }}
        >
            <div
                tabIndex={0}
                role="button"
                className={buttonStyles}
                id="options-menu"
                title={"Select " + type}
                onClick={() => {
                    setDropdown((prev) => {
                        if (prev.dropdown && prev.type === type) {
                            return { type: undefined, dropdown: false };
                        }
                        return { type: type, dropdown: true };
                    });
                }}
            >
                {type === "country" && !dataSelected
                    ? "CC"
                    : type === "networks" && !dataSelected
                      ? "NC"
                      : dataSelected}
                <svg
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 1792 1792"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M1408 704q0 26-19 45l-448 448q-19 19-45 19t-45-19l-448-448q-19-19-19-45t19-45 45-19h896q26 0 45 19t19 45z"></path>
                </svg>
            </div>
            {dropdown.dropdown &&
            dropdown?.type === "country" &&
            type === "country" ? (
                <ul
                    tabIndex={0}
                    className="dropdown-content z-[200000] p-2 shadow bg-gray-800 
                    max-h-[500px] overflow-y-auto sidebar scrollbar-thin scrollbar-webkit rounded-box w-52"
                >
                    <div className="text-white">
                        <input
                            type="text"
                            id="country-input"
                            autoComplete="off"
                            autoFocus
                            className="w-full h-16 peer placeholder-transparent mt-1
                      bg-transparent bg-clip-padding py-[0.25rem] pl-4 border-b-2
                    text-xl font-normal leading-[1.6] text-surface outline-none  transition
                    duration-200 ease-in-out focus:z-[3] focus:border-primary
                    focus:shadow-inset focus:outline-none motion-reduce:transition-none
                    autofill:shadow-autofill "
                            placeholder="Search Country"
                            aria-label="country"
                            aria-describedby="addon-wrapping"
                            value={countryInput}
                            onChange={(e) => setCountryInput(e.target.value)}
                        />
                        <label
                            htmlFor="country-input"
                            className="absolute left-1 -top-1 text-white text-xs mt-2 pointer-events-none
                        transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2
                         peer-focus:-top-1 peer-focus:text-xs peer-focus:left-1 peer-placeholder-shown:left-1"
                        >
                            Search Country
                        </label>
                    </div>
                    <li>
                        {filteredCountriesData.length > 0 ? (
                            filteredCountriesData.map((code: CountriesData) => (
                                <button
                                    type="button"
                                    key={code.id}
                                    className="flex items-center w-full
                                    justify-around py-2  
                                    hover:rounded-md  text-gray-100 
                                    hover:text-white hover:bg-gray-600 cursor-pointer"
                                    role="menuitem"
                                    onClick={() =>
                                        handleItemSelect(code.three_digits_code)
                                    }
                                >
                                    <img
                                        width={50}
                                        height={50}
                                        src={`https://flagcdn.com/${code?.two_digits_code?.toLowerCase()}.svg`}
                                        alt={code.three_digits_code}
                                    />
                                    <strong>{code.three_digits_code}</strong>
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-400">
                                No results found
                            </div>
                        )}
                    </li>
                </ul>
            ) : (
                dropdown.dropdown &&
                dropdown?.type === "networks" &&
                type === "networks" && (
                    <ul
                        tabIndex={0}
                        className="dropdown-content z-30 p-2 shadow bg-gray-800 
                        max-h-[500px] overflow-y-auto sidebar scrollbar-thin scrollbar-webkit rounded-box w-52"
                    >
                        <div className="text-white">
                            <input
                                type="text"
                                id="network-code"
                                autoComplete="off"
                                autoFocus
                                className="w-full h-16 peer placeholder-transparent mt-1
                      bg-transparent bg-clip-padding py-[0.25rem] pl-4 border-b-2
                    text-xl font-normal leading-[1.6] text-surface outline-none  transition
                    duration-200 ease-in-out focus:z-[3] focus:border-primary
                    focus:shadow-inset focus:outline-none motion-reduce:transition-none
                    autofill:shadow-autofill "
                                placeholder="Search Network Code"
                                aria-label="Network Code"
                                aria-describedby="addon-wrapping"
                                value={networkInput}
                                onChange={(e) =>
                                    setNetworkInput(e.target.value)
                                }
                            />
                            <label
                                htmlFor="network-code"
                                className="absolute left-1 -top-1 text-white text-xs mt-2 pointer-events-none
                        transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2
                         peer-focus:-top-1 peer-focus:text-xs peer-focus:left-1 peer-placeholder-shown:left-1"
                            >
                                Search Network Code
                            </label>
                        </div>
                        {filteredNetworksData.length > 0 ? (
                            filteredNetworksData.map((n: NetworkData) => (
                                <li key={n.api_id || n.network_code}>
                                    <button
                                        type="button"
                                        className="flex items-center w-full justify-center py-2
                                        hover:rounded-md 
                                        text-gray-100 hover:text-white
                                        hover:bg-gray-600 cursor-pointer"
                                        role="menuitem"
                                        onClick={() =>
                                            handleItemSelect(
                                                n?.network_code?.toUpperCase() ??
                                                    "",
                                            )
                                        }
                                    >
                                        <strong>
                                            {n?.network_code?.toUpperCase()}
                                        </strong>
                                    </button>
                                </li>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-400">
                                No results found
                            </div>
                        )}
                    </ul>
                )
            )}
        </div>
    );
};

export default Dropdown;

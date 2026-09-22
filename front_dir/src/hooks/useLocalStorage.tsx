import { useCallback, useState } from "react";

export const useLocalStorage = (key: string, initialValue: string | null) => {
    //TRAER DEL LOCALSTORAGE LA KEY Y EL VALOR INICIAL

    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? item : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    // identidad estable: es dependencia de logout y de useApi
    const setValue = useCallback(
        (value: string | null) => {
            try {
                if (value === null) {
                    setStoredValue(null);
                    window.localStorage.removeItem(key);
                    return;
                } else {
                    setStoredValue(value);
                    window.localStorage.setItem(key, value);
                }
            } catch (error) {
                console.error(error);
                if (error instanceof DOMException && error.code === 22) {
                    console.error("LocalStorage is full, please empty data");
                }
            }
        },
        [key],
    );

    return [storedValue, setValue] as const;
};

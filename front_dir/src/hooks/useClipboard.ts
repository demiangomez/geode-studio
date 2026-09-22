import { usePopup } from "./usePopup";

export const useClipboard = (timeout = 2000) => {
    const { showPopup, show } = usePopup(timeout);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            show();
            return true;
        } catch {
            return false;
        }
    };

    return { copied: showPopup, copy };
};

import { useEffect } from "react";
import { useMatches } from "react-router-dom";

const BASE = "GeoDE";

type TitleMatch = { params: Record<string, string | undefined> };
type TitleHandle = { title?: string | ((match: TitleMatch) => string) };

// document.title setter
export const usePageTitle = () => {
    const matches = useMatches();

    useEffect(() => {
        const match = [...matches]
            .reverse()
            .find((m) => (m.handle as TitleHandle | null)?.title);

        const title = (match?.handle as TitleHandle | undefined)?.title;
        const label =
            typeof title === "function" ? title(match as TitleMatch) : title;

        document.title = label ? `${BASE}: ${label}` : BASE;
    }, [matches]);
};

export default usePageTitle;

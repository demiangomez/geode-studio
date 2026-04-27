import { StationData } from "@types";
import placemarkSquare from "@assets/images/placemark_square.png";
import caution from "@assets/images/caution.png";

const iconCache = new Map<string, string>();
const imageSizeCache = new Map<string, { width: number; height: number }>();

export const iconUrl = (
    s: StationData,
    types: { image: string; name: string }[],
): string => {
    if (!s || !s.has_stationinfo || s.has_gaps) {
        return caution;
    }
    const foundUrl = types.find((t) => t.name === s.type)?.image;
    return foundUrl
        ? "data:image/png;base64," + foundUrl
        : placemarkSquare;
};

export const iconClass = (
    s: StationData,
    statuses: { color: string; name: string }[],
): string => {
    if (!s || !s.has_stationinfo || s.has_gaps) {
        return "";
    }
    return statuses.find((t) => t.name === s.status)?.color ?? "green-icon";
};

const FILTER_MAP: Record<string, string> = {
    "granate-icon":
        "invert(9%) sepia(60%) saturate(4585%) hue-rotate(341deg) brightness(88%) contrast(100%)",
    "light-green-icon":
        "invert(86%) sepia(20%) saturate(848%) hue-rotate(62deg) brightness(96%) contrast(96%)",
    "yellow-icon":
        "invert(84%) sepia(100%) saturate(1000%) hue-rotate(0deg) brightness(100%) contrast(100%)",
    "green-icon":
        "invert(18%) sepia(33%) saturate(7316%) hue-rotate(97deg) brightness(97%) contrast(102%)",
    "light-gray-icon":
        "invert(72%) sepia(0%) saturate(0%) hue-rotate(141deg) brightness(88%) contrast(85%)",
    "gray-icon":
        "invert(19%) sepia(0%) saturate(1102%) hue-rotate(257deg) brightness(100%) contrast(84%)",
    "light-red-icon":
        "invert(31%) sepia(75%) saturate(4977%) hue-rotate(2deg) brightness(99%) contrast(103%)",
    "orange-icon":
        "invert(54%) sepia(77%) saturate(1117%) hue-rotate(0deg) brightness(105%) contrast(102%)",
    "light-blue-icon":
        "invert(58%) sepia(24%) saturate(2543%) hue-rotate(155deg) brightness(106%) contrast(90%)",
    "purple-icon":
        "invert(20%) sepia(84%) saturate(3857%) hue-rotate(280deg) brightness(88%) contrast(99%)",
    "lilac-icon":
        "invert(59%) sepia(10%) saturate(1190%) hue-rotate(245deg) brightness(89%) contrast(89%)",
    "blue-icon":
        "invert(10%) sepia(100%) saturate(5793%) hue-rotate(247deg) brightness(96%) contrast(149%)",
};

export const getFilterFromClass = (className: string): string =>
    FILTER_MAP[className] ?? "";

export const createColoredIcon = (
    iconSrc: string,
    filter: string,
): Promise<string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            if (ctx) {
                ctx.filter = filter;
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL());
            } else {
                resolve(iconSrc);
            }
        };
        img.onerror = () => resolve(iconSrc);
        img.src = iconSrc;
    });

const getImageDimensions = (
    src: string,
): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
        const cached = imageSizeCache.get(src);
        if (cached) {
            resolve(cached);
            return;
        }
        const img = new Image();
        img.onload = () => {
            const dimensions = {
                width: Math.min(img.width, 64),
                height: Math.min(img.height, 64),
            };
            imageSizeCache.set(src, dimensions);
            resolve(dimensions);
        };
        img.onerror = reject;
        img.src = src;
    });

export const getIconScale = async (iconSrc: string): Promise<number> => {
    try {
        const { width, height } = await getImageDimensions(iconSrc);
        const targetSize = 24;
        const maxDimension = Math.max(width, height);
        const scale = targetSize / maxDimension;
        return Math.max(0.2, Math.min(1.5, scale));
    } catch {
        return 0.6;
    }
};

export const getCachedColoredIcon = async (
    iconSrc: string,
    cssClass: string,
): Promise<string> => {
    const filter = getFilterFromClass(cssClass);
    if (!filter) return iconSrc;

    const cacheKey = `${iconSrc}_${cssClass}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    try {
        const colored = await createColoredIcon(iconSrc, filter);
        iconCache.set(cacheKey, colored);
        return colored;
    } catch {
        return iconSrc;
    }
};

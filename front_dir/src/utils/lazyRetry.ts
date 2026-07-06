import { lazy, ComponentType, LazyExoticComponent } from "react";

/**
 * Wraps a dynamic import so that if the chunk file no longer exists
 * (e.g. after a redeploy changed hashes), the page reloads once
 * to pick up the new index.html with updated chunk references.
 */
export function lazyRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
    return lazy(() =>
        factory().catch((err: unknown) => {
            const key = "chunk-reload";
            const hasReloaded = sessionStorage.getItem(key);

            if (!hasReloaded) {
                sessionStorage.setItem(key, "1");
                window.location.reload();
                // Return a never-resolving promise so React doesn't try to render
                return new Promise(() => {});
            }

            // Already reloaded once — clear flag and let the error propagate
            sessionStorage.removeItem(key);
            throw err;
        }),
    );
}

/**
 * A generic version of retry for non-React dynamic imports
 * (e.g. loading a library like Cesium).
 */
export async function dynamicImportRetry<T>(
    factory: () => Promise<T>,
): Promise<T> {
    try {
        return await factory();
    } catch (err) {
        const key = "chunk-reload-generic";
        const hasReloaded = sessionStorage.getItem(key);

        if (!hasReloaded) {
            sessionStorage.setItem(key, "1");
            window.location.reload();
            // Return a never-resolving promise
            return new Promise(() => {});
        }

        sessionStorage.removeItem(key);
        throw err;
    }
}

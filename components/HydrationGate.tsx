'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

const subscribe = () => () => {};

/** False during server rendering and hydration, true once React has attached event handlers */
export function useHydrated(): boolean {
    return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Keeps the form controls inside it disabled until React has hydrated the page. Without it, a
 * click on a server-rendered button before hydration does nothing (no handler is attached yet),
 * and text typed into an input can be lost when React takes over the field.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
    const hydrated = useHydrated();
    return (
        <fieldset disabled={!hydrated} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            {children}
        </fieldset>
    );
}

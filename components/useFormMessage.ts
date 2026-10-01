'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FormMessageState {
    kind: 'error' | 'success';
    text: string;
}

/** Inline form message state; success messages clear themselves after clearSuccessAfterMs, like the legacy screens */
export function useFormMessage(clearSuccessAfterMs: number) {
    const [message, setMessage] = useState<FormMessageState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const show = useCallback((kind: FormMessageState['kind'], text: string) => {
        clearTimeout(timer.current);
        setMessage({ kind, text });
        if (kind === 'success') timer.current = setTimeout(() => setMessage(null), clearSuccessAfterMs);
    }, [clearSuccessAfterMs]);
    const clear = useCallback(() => { clearTimeout(timer.current); setMessage(null); }, []);
    useEffect(() => () => clearTimeout(timer.current), []);
    return { message, show, clear };
}

'use client';

import { useState, type ComponentProps, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { HydrationGate } from '@/components/HydrationGate';

export interface AuthMessage {
    kind: 'error' | 'success';
    text: string;
}

/**
 * The legacy auth screen frame: "BalanceTrack" heading, the active form, and #auth-message.
 * Same ids and classes as the former single-page app, so the shared CSS and the Playwright flows apply.
 */
export function AuthShell({ message, children }: { message?: AuthMessage | null; children: ReactNode }) {
    return (
        <div id="auth-section">
            <h2>BalanceTrack</h2>
            <HydrationGate>{children}</HydrationGate>
            <div id="auth-message" className={message?.kind ?? 'error'}>{message?.text ?? ''}</div>
        </div>
    );
}

type AuthButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
    icon?: LucideIcon;
    action: string;
};

/**
 * A button that does not take focus on mousedown. Inputs show help text while focused;
 * if a click blurred the input first, the help would disappear and move the button before
 * mouseup, and the click would miss (the legacy "first click on Continue does nothing" bug).
 */
export function AuthButton({ icon: Icon, action, children, ...props }: AuthButtonProps) {
    return (
        <button type="button" data-action={action} onMouseDown={event => event.preventDefault()} {...props}>
            {Icon ? <span className="icon-enhanced"><Icon /></span> : null}
            {children}
        </button>
    );
}

type HelpedInputProps = ComponentProps<'input'> & {
    id: string;
    help?: ReactNode;
};

/** An input whose help text (if any) is shown only while it has focus, like the legacy forms */
export function HelpedInput({ id, help, ...props }: HelpedInputProps) {
    const [focused, setFocused] = useState(false);
    return (
        <>
            <input
                id={id}
                {...props}
                onFocus={event => { setFocused(true); props.onFocus?.(event); }}
                onBlur={event => { setFocused(false); props.onBlur?.(event); }}
            />
            {help ? <small id={`${id}-help`} className={`field-help${focused ? '' : ' hidden'}`}>{help}</small> : null}
        </>
    );
}

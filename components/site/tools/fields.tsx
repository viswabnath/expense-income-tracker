'use client';

import { useId, useState, type ReactNode } from 'react';

/** Rupees in Indian digit grouping, without paise (₹12,34,567) */
export const rupees = (amount: number) =>
    `${amount < 0 ? '-' : ''}₹${Math.round(Math.abs(amount)).toLocaleString('en-IN')}`;

interface NumberFieldProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    /** Shown after the typed value in the slider's accessible text, for example "%" or "years" */
    unit?: string;
    help?: ReactNode;
}

/**
 * A number with a slider and a typed box that stay in step. Typing may go past the slider's range
 * (a ₹3 crore loan is fine); the slider simply stops at its ends.
 */
export function NumberField({ label, value, onChange, min, max, step, unit, help }: NumberFieldProps) {
    const id = useId();
    const [text, setText] = useState<string | null>(null);
    return (
        <div className="field">
            <div className="field-top">
                <label htmlFor={id}>{label}</label>
                <input
                    id={id}
                    className="value-input"
                    inputMode="decimal"
                    value={text ?? String(value)}
                    onChange={event => {
                        setText(event.target.value);
                        const parsed = Number(event.target.value.replace(/,/g, ''));
                        if (event.target.value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
                    }}
                    onBlur={() => setText(null)}
                />
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={Math.min(Math.max(value, min), max)}
                aria-label={label}
                aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
                onChange={event => {
                    setText(null);
                    onChange(Number(event.target.value));
                }}
            />
            {help && <small>{help}</small>}
        </div>
    );
}

/** A labelled result row */
export function Row({ label, value }: { label: string; value: string }) {
    return <div><span>{label}</span><span>{value}</span></div>;
}

/** A bar split into two parts, for principal against interest and similar */
export function SplitBar({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
    const total = a + b || 1;
    return (
        <div className="field">
            <div className="split-bar" role="img" aria-label={`${labelA} ${Math.round((a / total) * 100)}%, ${labelB} ${Math.round((b / total) * 100)}%`}>
                <i className="a" style={{ width: `${(a / total) * 100}%` }} />
                <i className="b" style={{ width: `${(b / total) * 100}%` }} />
            </div>
            <div className="legend-row">
                <span><i className="a" />{labelA} {rupees(a)}</span>
                <span><i className="b" />{labelB} {rupees(b)}</span>
            </div>
        </div>
    );
}

'use client';

import type { ReactNode } from 'react';

interface ModalProps {
    id: string;
    title: string;
    open: boolean;
    /** data-action of the close (x) button, kept from the legacy markup */
    closeAction: string;
    onClose: () => void;
    footer: ReactNode;
    small?: boolean;
    children: ReactNode;
}

/** Legacy modal markup (modal-overlay / modal-content / header / body / footer) */
export function Modal({ id, title, open, closeAction, onClose, footer, small, children }: ModalProps) {
    return (
        <div
            id={id}
            className={`modal-overlay${open ? '' : ' hidden'}`}
            onClick={event => { if (event.target === event.currentTarget) onClose(); }}
        >
            <div className={`modal-content${small ? ' modal-small' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
                <div className="modal-header">
                    <h3 id={`${id}-title`}>{title}</h3>
                    <button type="button" className="modal-close" data-action={closeAction} aria-label="Close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">{children}</div>
                <div className="modal-footer">{footer}</div>
            </div>
        </div>
    );
}

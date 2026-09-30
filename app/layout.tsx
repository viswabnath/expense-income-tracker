import type { ReactNode } from 'react';

export const metadata = {
    title: 'BalanceTrack',
    description: 'Track your expenses and income',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

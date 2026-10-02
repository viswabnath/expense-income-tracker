import { redirect } from 'next/navigation';

/**
 * The app's home. proxy.ts answers "/" first (to /login without a session cookie, otherwise to
 * the screen named in a legacy ?section= link, or /setup); this only runs if it did not.
 */
export default function Home() {
    redirect('/setup');
}

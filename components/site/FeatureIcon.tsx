import {
    CalendarHeart, ChartPie, Coins, CreditCard, FileUp, Gauge, HandCoins, House, Landmark,
    PiggyBank, Receipt, Umbrella, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { FeatureIconName } from './content';

const ICONS: Record<FeatureIconName, LucideIcon> = {
    wallet: Wallet,
    receipt: Receipt,
    upload: FileUp,
    chart: ChartPie,
    calendar: CalendarHeart,
    people: HandCoins,
    loan: Landmark,
    card: CreditCard,
    gold: Coins,
    home: House,
    piggy: PiggyBank,
    umbrella: Umbrella,
    gauge: Gauge,
    family: Users,
};

/** A feature's icon in its tinted tile */
export function FeatureIcon({ name, size = 22 }: { name: FeatureIconName; size?: number }) {
    const Icon = ICONS[name];
    return (
        <span className="feature-icon" aria-hidden="true">
            <Icon size={size} strokeWidth={1.75} />
        </span>
    );
}

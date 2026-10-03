import {
    ArrowDownUp, Banknote, CalendarHeart, ChartPie, Coins, CreditCard, FileUp, Fuel, Gauge, HandCoins,
    House, Landmark, PiggyBank, Receipt, ShoppingCart, TrendingUp, Umbrella, Users, UtensilsCrossed,
    Wallet, Zap, Calculator, ChartLine, Plane, Gem, type LucideIcon,
} from 'lucide-react';
import type { FeatureIconName, ToolIconName } from './content';

/** Each feature's icon and the category colour of its tile (classes defined in site.css) */
const FEATURE_ICONS: Record<FeatureIconName, [LucideIcon, string]> = {
    wallet: [Wallet, 'c-income'],
    receipt: [Receipt, 'c-food'],
    upload: [FileUp, 'c-bill'],
    chart: [ChartPie, 'c-shop'],
    calendar: [CalendarHeart, 'c-travel'],
    people: [HandCoins, 'c-groc'],
    loan: [Landmark, 'c-loan'],
    card: [CreditCard, 'c-fuel'],
    gold: [Coins, 'c-gold'],
    home: [House, 'c-home'],
    piggy: [PiggyBank, 'c-groc'],
    umbrella: [Umbrella, 'c-bill'],
    gauge: [Gauge, 'c-income'],
    family: [Users, 'c-shop'],
};

/** A feature's icon on its coloured tile */
export function FeatureIcon({ name, size = 22, tile = '' }: { name: FeatureIconName; size?: number; tile?: '' | 'sm' | 'lg' }) {
    const [Icon, colour] = FEATURE_ICONS[name];
    return (
        <span className={`icon-tile ${tile} ${colour}`} aria-hidden="true">
            <Icon size={size} strokeWidth={2} />
        </span>
    );
}

const TOOL_ICONS: Record<ToolIconName, [LucideIcon, string]> = {
    emi: [Calculator, 'c-loan'],
    payoff: [ArrowDownUp, 'c-fuel'],
    fd: [Landmark, 'c-bill'],
    rd: [PiggyBank, 'c-groc'],
    sip: [TrendingUp, 'c-income'],
    gold: [Gem, 'c-gold'],
    chit: [Users, 'c-shop'],
    inflation: [ChartLine, 'c-food'],
};

/** A calculator's icon on its coloured tile */
export function ToolIcon({ name, size = 22, tile = '' }: { name: ToolIconName; size?: number; tile?: '' | 'sm' | 'lg' }) {
    const [Icon, colour] = TOOL_ICONS[name];
    return (
        <span className={`icon-tile ${tile} ${colour}`} aria-hidden="true">
            <Icon size={size} strokeWidth={2} />
        </span>
    );
}

export type CategoryName = 'food' | 'fuel' | 'groceries' | 'shopping' | 'gold' | 'loan' | 'bills' | 'travel' | 'home' | 'income';

const CATEGORY_ICONS: Record<CategoryName, [LucideIcon, string]> = {
    food: [UtensilsCrossed, 'c-food'],
    fuel: [Fuel, 'c-fuel'],
    groceries: [ShoppingCart, 'c-groc'],
    shopping: [Receipt, 'c-shop'],
    gold: [Coins, 'c-gold'],
    loan: [Landmark, 'c-loan'],
    bills: [Zap, 'c-bill'],
    travel: [Plane, 'c-travel'],
    home: [House, 'c-home'],
    income: [Banknote, 'c-income'],
};

/** A spending category's icon in its colour, as the app shows it */
export function CategoryDot({ name }: { name: CategoryName }) {
    const [Icon, colour] = CATEGORY_ICONS[name];
    return (
        <span className={`cat-dot ${colour}`} aria-hidden="true">
            <Icon strokeWidth={2.2} />
        </span>
    );
}

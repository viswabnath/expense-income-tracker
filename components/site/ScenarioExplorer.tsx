'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Banknote, Gift, Landmark, Plane, Gem, Users, type LucideIcon } from 'lucide-react';

interface Line {
    account: string;
    note: string;
    amount: number;
}

interface Effect {
    label: string;
    /** Signed change; 0 means unchanged */
    change: number;
}

interface Scenario {
    id: string;
    tab: string;
    icon: LucideIcon;
    /** Category colour class of the icon tile (site.css) */
    colour: string;
    title: string;
    story: string;
    from: Line[];
    to: Line[];
    effects: Effect[];
}

/** Real situations and how FinDB records each one (sample amounts) */
export const SCENARIOS: Scenario[] = [
    {
        id: 'atm',
        tab: 'Cash from an ATM',
        icon: Banknote, colour: 'c-income',
        title: 'You withdraw ₹5,000 from an ATM',
        story: 'Money moved from your bank to your wallet. You have not spent anything yet, so FinDB does not count it as spending.',
        from: [{ account: 'HDFC Savings', note: 'Bank account', amount: 5000 }],
        to: [{ account: 'Cash', note: 'In your wallet', amount: 5000 }],
        effects: [{ label: 'Spending', change: 0 }, { label: 'Net worth', change: 0 }],
    },
    {
        id: 'emi',
        tab: 'A home loan EMI',
        icon: Landmark, colour: 'c-loan',
        title: 'Your home loan EMI of ₹32,000 is paid',
        story: 'Only the interest is a real cost. The rest reduces what you owe, so it is not spending: it is your own money building up in your home.',
        from: [{ account: 'SBI Salary', note: 'Bank account', amount: 32000 }],
        to: [
            { account: 'Home loan', note: 'You now owe less', amount: 16800 },
            { account: 'Loan interest', note: 'Spending', amount: 15200 },
        ],
        effects: [{ label: 'Spending', change: 15200 }, { label: 'Net worth', change: -15200 }],
    },
    {
        id: 'gold-family',
        tab: 'Gold for your wife',
        icon: Gem, colour: 'c-gold',
        title: 'You buy a ₹1,20,000 gold chain for your wife',
        story: 'The gold stays in the family, so it is something you own, not money gone. FinDB records her as the owner and values it by weight every day.',
        from: [{ account: 'ICICI Savings', note: 'Bank account', amount: 120000 }],
        to: [{ account: 'Gold chain, 16 g 22K', note: 'Owned by your wife', amount: 120000 }],
        effects: [{ label: 'Spending', change: 0 }, { label: 'Net worth', change: 0 }],
    },
    {
        id: 'gift',
        tab: 'A gift for a friend',
        icon: Gift, colour: 'c-shop',
        title: 'You give ₹25,000 of gold at a friend\'s wedding',
        story: 'This gold leaves your family, so it is a gift you have spent, even though it is gold.',
        from: [{ account: 'ICICI Savings', note: 'Bank account', amount: 25000 }],
        to: [{ account: 'Gifts', note: 'Spending, under the event "Ravi\'s wedding"', amount: 25000 }],
        effects: [{ label: 'Spending', change: 25000 }, { label: 'Net worth', change: -25000 }],
    },
    {
        id: 'trip',
        tab: 'A trip with friends',
        icon: Plane, colour: 'c-travel',
        title: 'You book ₹12,000 of train tickets for four friends',
        story: 'Only your share is your spending. The other three shares are money your friends owe you, and FinDB reminds them, and you, until it is settled.',
        from: [{ account: 'HDFC Savings', note: 'Bank account', amount: 12000 }],
        to: [
            { account: 'Goa trip', note: 'Your share, spending', amount: 3000 },
            { account: 'Friends owe you', note: '₹3,000 each from three friends', amount: 9000 },
        ],
        effects: [{ label: 'Spending', change: 3000 }, { label: 'Net worth', change: -3000 }],
    },
    {
        id: 'chit',
        tab: 'A chit fund month',
        icon: Users, colour: 'c-bill',
        title: 'Your ₹10,000 chit instalment, with a ₹1,200 dividend',
        story: 'This month\'s auction gave every member a dividend, so you pay only ₹8,800. Your full ₹10,000 still counts towards the chit, and the dividend is income.',
        from: [
            { account: 'SBI Salary', note: 'Bank account', amount: 8800 },
            { account: 'Chit dividend', note: 'Income', amount: 1200 },
        ],
        to: [{ account: 'Chit fund', note: 'Your contributions so far', amount: 10000 }],
        effects: [{ label: 'Income', change: 1200 }, { label: 'Spending', change: 0 }, { label: 'Net worth', change: 1200 }],
    },
];

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

function EffectChip({ label, change }: Effect) {
    if (change === 0) return <span className="effect same">{label}: <b>no change</b></span>;
    return (
        <span className={`effect ${change > 0 ? 'up' : 'down'}`}>
            {label}: <b>{change > 0 ? '+' : '-'}{rupees(Math.abs(change))}</b>
        </span>
    );
}

/**
 * "Real life, recorded correctly": choose a situation and see where the money came from, where
 * it went, and what it does to spending and net worth. The first situation is rendered on the
 * server, so the section reads fully before the page is interactive.
 */
export function ScenarioExplorer() {
    const [selected, setSelected] = useState(0);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const scenario = SCENARIOS[selected]!;
    const total = scenario.from.reduce((sum, line) => sum + line.amount, 0);

    // Arrow keys move between tabs, as screen reader users expect from a tab list
    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        let next: number | undefined;
        if (event.key in keys) next = (selected + keys[event.key]! + SCENARIOS.length) % SCENARIOS.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = SCENARIOS.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        setSelected(next);
        tabs.current[next]?.focus();
    }

    return (
        <div className="explorer">
            <div className="explorer-tabs" role="tablist" aria-label="Situations" aria-orientation="vertical" onKeyDown={onKeyDown}>
                {SCENARIOS.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            ref={element => { tabs.current[index] = element; }}
                            type="button"
                            role="tab"
                            id={`tab-${item.id}`}
                            aria-selected={index === selected}
                            aria-controls="scenario-panel"
                            tabIndex={index === selected ? 0 : -1}
                            className="explorer-tab"
                            onClick={() => setSelected(index)}
                        >
                            <span className={`cat-dot ${item.colour}`} aria-hidden="true"><Icon strokeWidth={2.2} /></span>
                            {item.tab}
                        </button>
                    );
                })}
            </div>

            <div key={scenario.id} className="explorer-panel" role="tabpanel" id="scenario-panel" aria-labelledby={`tab-${scenario.id}`}>
                <h3>{scenario.title}</h3>
                <p className="story">{scenario.story}</p>

                <div className="journal">
                    <div className="journal-head"><span>Where the money came from</span></div>
                    {scenario.from.map(line => (
                        <div className="journal-line" key={line.account}>
                            <span className="acct">{line.account}<small>{line.note}</small></span>
                            <span className="amt out">{rupees(line.amount)}</span>
                        </div>
                    ))}
                    <div className="journal-head"><span>Where it went</span></div>
                    {scenario.to.map(line => (
                        <div className="journal-line" key={line.account}>
                            <span className="acct">{line.account}<small>{line.note}</small></span>
                            <span className="amt in">{rupees(line.amount)}</span>
                        </div>
                    ))}
                    <div className="journal-total">
                        <span>Every rupee accounted for</span>
                        <span>{rupees(total)} = {rupees(total)}</span>
                    </div>
                </div>

                <div className="effects" aria-label="What changes">
                    {scenario.effects.map(effect => <EffectChip key={effect.label} {...effect} />)}
                </div>
            </div>
        </div>
    );
}

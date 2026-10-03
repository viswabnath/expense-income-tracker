import { BellRing } from 'lucide-react';
import { CategoryDot, type CategoryName } from './FeatureIcon';

/** Net worth over twelve months in lakhs (sample data) */
const NET_WORTH = [22.5, 23.1, 23.7, 23.4, 24.6, 25.3, 25.9, 27.1, 27.6, 28.4, 29.2, 29.9];

function sparkPath(values: number[], width: number, height: number) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = values.map((value, index) => [
        (index / (values.length - 1)) * width,
        height - 4 - ((value - min) / (max - min)) * (height - 8),
    ]);
    const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

const RECENT: { name: string; category: string; icon: CategoryName; amount: string; income?: boolean }[] = [
    { name: 'Swiggy', category: 'Eating out', icon: 'food', amount: '-₹640' },
    { name: 'HP Petrol', category: 'Fuel', icon: 'fuel', amount: '-₹2,000' },
    { name: 'BigBasket', category: 'Groceries', icon: 'groceries', amount: '-₹3,120' },
    { name: 'Electricity', category: 'Bills', icon: 'bills', amount: '-₹1,840' },
    { name: 'Salary', category: 'Income', icon: 'income', amount: '+₹85,000', income: true },
];

function StatusBar() {
    return (
        <div className="phone-status" aria-hidden="true">
            <span>9:41</span>
            <span className="phone-island" />
            <span>5G</span>
        </div>
    );
}

/**
 * The hero illustration: three phone screens with sample data (accounts, this month, net worth),
 * drawn in markup so they stay sharp and follow the light and dark theme.
 */
export function HeroPhones() {
    const spark = sparkPath(NET_WORTH, 200, 44);
    return (
        <div className="phones rise rise-3" role="img" aria-label="FinDB on a phone: accounts, this month's spending and net worth, with sample data">
            <div className="phone side left" aria-hidden="true">
                <div className="phone-screen">
                    <StatusBar />
                    <div className="phone-body">
                        <span className="phone-title">Your accounts</span>
                        <div className="phone-card">
                            <span className="phone-label">Banks and cash</span>
                            <div className="tx">
                                <div className="tx-row"><CategoryDot name="income" /><span className="name">HDFC Savings<small>Bank</small></span><span className="amt">₹2,41,560</span></div>
                                <div className="tx-row"><CategoryDot name="income" /><span className="name">SBI Salary<small>Bank</small></span><span className="amt">₹68,200</span></div>
                                <div className="tx-row"><CategoryDot name="shopping" /><span className="name">Cash<small>Wallet</small></span><span className="amt">₹4,350</span></div>
                            </div>
                        </div>
                        <div className="phone-card">
                            <span className="phone-label">Credit cards</span>
                            <div className="tx-row"><CategoryDot name="loan" /><span className="name">HDFC Regalia<small>Due in 3 days</small></span><span className="amt">₹18,400</span></div>
                            <div className="meter"><i style={{ width: '18%' }} /></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="phone main" aria-hidden="true">
                <div className="phone-screen">
                    <StatusBar />
                    <div className="phone-body">
                        <span className="phone-title">October</span>
                        <div className="phone-card green on-green">
                            <span className="phone-label">Spent this month</span>
                            <span className="phone-big">₹52,180</span>
                            <div className="meter"><i style={{ width: '87%' }} /></div>
                            <span>₹7,820 left of your ₹60,000 budget</span>
                        </div>
                        <div className="phone-alert"><BellRing size={15} />HDFC card bill of ₹18,400 is due in 3 days</div>
                        <span className="phone-label">Recent</span>
                        <div className="tx">
                            {RECENT.map(row => (
                                <div className="tx-row" key={row.name}>
                                    <CategoryDot name={row.icon} />
                                    <span className="name">{row.name}<small>{row.category}</small></span>
                                    <span className={`amt${row.income ? ' in' : ''}`}>{row.amount}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="phone side right" aria-hidden="true">
                <div className="phone-screen">
                    <StatusBar />
                    <div className="phone-body">
                        <span className="phone-title">Net worth</span>
                        <div className="phone-card green">
                            <span className="phone-label">Own minus owe</span>
                            <span className="phone-big">₹29,88,910</span>
                            <span>+₹7,41,800 this year</span>
                            <svg className="spark" viewBox="0 0 200 44" preserveAspectRatio="none">
                                <path className="area" d={spark.area} />
                                <path d={spark.line} />
                            </svg>
                        </div>
                        <div className="tx">
                            <div className="tx-row"><CategoryDot name="gold" /><span className="name">Gold<small>42 g, 22K</small></span><span className="amt">₹2,98,200</span></div>
                            <div className="tx-row"><CategoryDot name="groceries" /><span className="name">PPF<small>Post office</small></span><span className="amt">₹6,85,000</span></div>
                            <div className="tx-row"><CategoryDot name="home" /><span className="name">Flat, 50%<small>Hyderabad</small></span><span className="amt">₹38,50,000</span></div>
                            <div className="tx-row"><CategoryDot name="loan" /><span className="name">Home loan<small>You owe</small></span><span className="amt">-₹21,40,000</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <span className="sample-tag">Sample screens. Some features are still being built.</span>
        </div>
    );
}

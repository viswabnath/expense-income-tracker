import { BellRing } from 'lucide-react';

/** Net worth over twelve months in lakhs (sample data), drawn as a sparkline */
const NET_WORTH = [21.7, 22.3, 22.9, 22.6, 23.8, 24.5, 25.1, 26.3, 26.8, 27.6, 28.4, 29.1];

function sparkPath(values: number[], width: number, height: number) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const points = values.map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - 4 - ((value - min) / (max - min)) * (height - 8);
        return [x, y] as const;
    });
    const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

/** Monthly spending, six months (sample data), as bar heights in percent */
const SPENDING = [62, 70, 58, 92, 66, 60];

/**
 * The hero illustration: the dashboard on a computer, and the month's budget on a phone.
 * Built from markup with sample data (labelled as such), so it stays sharp, themes with the
 * page and needs no image files.
 */
export function HeroShowcase() {
    const spark = sparkPath(NET_WORTH, 300, 46);
    const budgetShare = 0.87;
    const circumference = 2 * Math.PI * 44;

    return (
        <div className="showcase rise rise-4" aria-label="Illustration of the FinDB dashboard on a computer and a phone, with sample data" role="img">
            <div className="mock mock-desktop">
                <div className="mock-bar"><i /><i /><i /><span>findb · Dashboard</span></div>
                <div className="mock-body">
                    <div className="mock-next">
                        <BellRing size={16} />
                        <span>HDFC card bill of ₹18,400 is due in 3 days</span>
                    </div>
                    <div className="mock-row">
                        <div className="mock-card">
                            <span className="mock-label">Net worth</span>
                            <span className="mock-big">₹29,11,360</span>
                            <span className="mock-up">+₹7,41,800 this year</span>
                            <svg className="spark" viewBox="0 0 300 46" preserveAspectRatio="none" aria-hidden="true">
                                <path className="area" d={spark.area} />
                                <path d={spark.line} />
                            </svg>
                        </div>
                        <div className="mock-card mock-hide-sm">
                            <span className="mock-label">Spending, 6 months</span>
                            <div className="bars" aria-hidden="true">
                                {SPENDING.map((height, index) => (
                                    <span key={index} className={index === 5 ? 'hi' : undefined} style={{ height: `${height}%` }} />
                                ))}
                            </div>
                            <span className="mock-down">Fuel is 2x your average</span>
                        </div>
                    </div>
                    <div className="mock-row">
                        <div className="mock-card">
                            <span className="mock-label">What you own</span>
                            <div className="mock-list">
                                <div><span>HDFC Savings</span><span>₹2,41,560</span></div>
                                <div><span>Gold, 42 g (22K)</span><span>₹2,98,200</span></div>
                                <div><span>PPF</span><span>₹6,85,000</span></div>
                                <div><span>Flat, Hyderabad (50%)</span><span>₹38,50,000</span></div>
                            </div>
                        </div>
                        <div className="mock-card mock-hide-sm">
                            <span className="mock-label">What you owe</span>
                            <div className="mock-list">
                                <div><span>Home loan</span><span>₹21,40,000</span></div>
                                <div><span>HDFC card</span><span>₹18,400</span></div>
                                <div><span>Owed to Ravi</span><span>₹5,000</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mock mock-phone float">
                <div className="screen">
                    <div className="notch" />
                    <span className="mock-label">October budget</span>
                    <div className="ring">
                        <svg viewBox="0 0 108 108" aria-hidden="true">
                            <circle className="track" cx="54" cy="54" r="44" />
                            <circle
                                className="value" cx="54" cy="54" r="44"
                                strokeDasharray={`${circumference * budgetShare} ${circumference}`}
                                transform="rotate(-90 54 54)"
                            />
                            <text x="54" y="54" textAnchor="middle">₹52,180</text>
                            <text className="small" x="54" y="70" textAnchor="middle">of ₹60,000</text>
                        </svg>
                    </div>
                    <div className="cat">
                        <div><span>Groceries</span><b>₹9,400</b></div>
                        <div className="meter"><i style={{ width: '62%' }} /></div>
                    </div>
                    <div className="cat">
                        <div><span>Eating out</span><b>₹6,800</b></div>
                        <div className="meter"><i className="warn" style={{ width: '96%' }} /></div>
                    </div>
                    <div className="cat">
                        <div><span>Fuel</span><b>₹4,200</b></div>
                        <div className="meter"><i style={{ width: '48%' }} /></div>
                    </div>
                </div>
            </div>
            <span className="sample-tag">Sample data</span>
        </div>
    );
}

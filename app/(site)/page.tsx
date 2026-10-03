import type { ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowRight, Ban, ChartNoAxesCombined, CircleCheck, EyeOff, FileSpreadsheet, KeyRound, Languages,
    LockKeyhole, Monitor, ServerOff, ShieldCheck, Smartphone, Sparkles, Tablet, X,
} from 'lucide-react';
import { FEATURES, FAQ } from '@/components/site/content';
import { FeatureIcon } from '@/components/site/FeatureIcon';
import { StatusBadge } from '@/components/site/StatusBadge';
import { HeroShowcase } from '@/components/site/HeroShowcase';
import { ScenarioExplorer } from '@/components/site/ScenarioExplorer';
import { FaqList } from '@/components/site/FaqList';

/** A half-circle gauge for the health check preview */
function Gauge({ share, tone, label }: { share: number; tone: 'good' | 'watch' | 'act'; label: string }) {
    const length = Math.PI * 50;
    return (
        <svg className="gauge" viewBox="0 0 120 70" aria-hidden="true">
            <path className="track" d="M10 62 A50 50 0 0 1 110 62" />
            <path className={`fill ${tone}`} d="M10 62 A50 50 0 0 1 110 62" strokeDasharray={`${length * share} ${length}`} />
            <text x="60" y="58" textAnchor="middle">{label}</text>
        </svg>
    );
}

const HEALTH = [
    { title: 'Emergency fund', share: 0.66, tone: 'good', label: '4 months', verdict: 'Healthy', text: 'Covers 4 months of essential spending of ₹45,000.' },
    { title: 'Savings vs inflation', share: 0.35, tone: 'act', label: '2.7%', verdict: 'Losing value', text: '₹4,00,000 earns 2.7% while prices rise about 5% a year.' },
    { title: 'EMIs vs income', share: 0.38, tone: 'good', label: '38%', verdict: 'Within limits', text: 'EMIs take ₹32,000 of ₹85,000 take-home pay.' },
    { title: 'Life cover', share: 0.5, tone: 'watch', label: '5x', verdict: 'Worth a look', text: 'Cover is 5 times yearly income; a common guide is 10 times.' },
] as const;

export default function HomePage() {
    return (
        <>
            <section className="hero">
                <div className="wrap hero-grid">
                    <div className="hero-copy">
                        <span className="eyebrow rise">Personal finance dashboard for India</span>
                        <h1 className="rise rise-2">All your family&apos;s money. <em>One honest picture.</em></h1>
                        <p className="lede rise rise-3">
                            FinDB keeps track of your bank accounts, cards, cash, loans, gold, property and savings, and
                            explains it all in plain language. Free for everyone, with no ads and no selling your data.
                        </p>
                        <div className="hero-actions rise rise-4">
                            <a className="btn btn-primary btn-lg" href="/register">Start free <ArrowRight size={18} /></a>
                            <Link className="btn btn-ghost btn-lg" href="/features">See what it does</Link>
                        </div>
                        <ul className="trust-row rise rise-5">
                            <li><CircleCheck size={18} />Free for everyone</li>
                            <li><CircleCheck size={18} />No ads, ever</li>
                            <li><CircleCheck size={18} />Never connects to your bank on its own</li>
                        </ul>
                    </div>
                    <HeroShowcase />
                </div>
            </section>

            <section className="section section-alt" aria-labelledby="problem-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">Why FinDB</span>
                        <h2 id="problem-title">Most money apps only see half the picture.</h2>
                        <p className="lede">
                            An Indian family&apos;s money is more than a bank balance. It is gold in the locker, a chit with
                            relatives, PF from work, a loan to a cousin, and a house being built slowly over years.
                        </p>
                    </div>
                    <div className="compare">
                        <div className="compare-item reveal">
                            <span className="x"><X size={18} />Spending trackers</span>
                            <h3>Record what you spend, and stop there.</h3>
                            <p>They count an ATM withdrawal as spending, and know nothing about your gold, loans or PF.</p>
                        </div>
                        <div className="compare-item reveal">
                            <span className="x"><X size={18} />Investment apps</span>
                            <h3>Show your funds, then sell you more.</h3>
                            <p>Their business is loans, cards and products. Your data is how they choose what to sell you.</p>
                        </div>
                        <div className="compare-item reveal">
                            <span className="x"><X size={18} />Spreadsheets</span>
                            <h3>Flexible, until a formula breaks.</h3>
                            <p>Hours of upkeep, nothing on your phone, and no reminder when a bill or renewal is due.</p>
                        </div>
                    </div>
                    <div className="compare-answer reveal">
                        <Sparkles size={22} />
                        <p>
                            <strong>FinDB is the complete, private record of your family&apos;s money, made for India.</strong>{' '}
                            Everything you own and owe in one place, recorded the way an accountant would, explained the way a
                            friend would.
                        </p>
                    </div>
                </div>
            </section>

            <section className="section" aria-labelledby="features-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">Everything you own and owe</span>
                        <h2 id="features-title">One place for every part of your money.</h2>
                        <p className="lede">
                            Turn on only what you need. Start with your spending today and add gold, loans or property
                            whenever you are ready.
                        </p>
                        <div className="legend">
                            <StatusBadge status="available" /> in the app today
                            <StatusBadge status="building" /> being built now
                            <StatusBadge status="planned" /> coming later
                        </div>
                    </div>
                    <div className="feature-grid home">
                        {FEATURES.map(feature => (
                            <Link key={feature.slug} href={`/features/${feature.slug}`} className={`feature-card reveal${feature.status === 'available' ? ' wide' : ''}`}>
                                <div className="feature-card-top">
                                    <FeatureIcon name={feature.icon} />
                                    <StatusBadge status={feature.status} />
                                </div>
                                <h3>{feature.name}</h3>
                                <p>{feature.short}</p>
                                <span className="more">Learn more <ArrowRight size={16} /></span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section section-alt" aria-labelledby="explorer-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">Real life, recorded correctly</span>
                        <h2 id="explorer-title">Every rupee goes somewhere. FinDB shows where.</h2>
                        <p className="lede">
                            Pick a situation. FinDB records where the money came from and where it went, so your spending
                            and your net worth are always right.
                        </p>
                    </div>
                    <div className="reveal">
                        <ScenarioExplorer />
                    </div>
                </div>
            </section>

            <section className="section" aria-labelledby="steps-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">How it works</span>
                        <h2 id="steps-title">Useful in five minutes.</h2>
                    </div>
                    <div className="steps">
                        <div className="step reveal">
                            <span className="step-num">1</span>
                            <h3>Choose what to track</h3>
                            <p>Just your spending, your spending and savings, or everything. Change your mind any time.</p>
                        </div>
                        <div className="step reveal">
                            <span className="step-num">2</span>
                            <h3>Add your accounts</h3>
                            <p>Your banks, cards and cash with today&apos;s balance. Soon: upload a statement instead of typing.</p>
                        </div>
                        <div className="step reveal">
                            <span className="step-num">3</span>
                            <h3>See the full picture</h3>
                            <p>Where the money went, what is due next, and how your month compares with the last.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section section-alt" aria-labelledby="health-title">
                <div className="wrap health">
                    <div className="section-head reveal" style={{ marginBottom: 0 }}>
                        <span className="eyebrow">The money health check</span>
                        <h2 id="health-title">Not just charts. An answer to &ldquo;Am I doing okay?&rdquo;</h2>
                        <p className="lede">
                            FinDB checks your money against inflation, your income and simple, well-known rules, and tells
                            you in plain words what is healthy and what needs a look.
                        </p>
                        <ul className="check-list">
                            <li><CircleCheck size={20} /><span>Shows the rule it used every time, so you can judge for yourself</span></li>
                            <li><CircleCheck size={20} /><span>Leaves one-off events like a wedding out of your averages</span></li>
                            <li><CircleCheck size={20} /><span>Information to help you decide, never advice to buy or sell</span></li>
                        </ul>
                        <p><StatusBadge status="planned" /></p>
                    </div>
                    <div className="health-cards" role="img" aria-label="Example health check with sample data">
                        {HEALTH.map(item => (
                            <div className="health-card reveal" key={item.title}>
                                <span className="mock-label">{item.title}</span>
                                <Gauge share={item.share} tone={item.tone} label={item.label} />
                                <span className={`verdict ${item.tone}`}>{item.verdict}</span>
                                <p>{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section band" aria-labelledby="privacy-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">Private by design</span>
                        <h2 id="privacy-title">Your money is personal. FinDB keeps it that way.</h2>
                        <p className="lede">
                            FinDB is free and has nothing to sell you, so it has no reason to look at your data. Here is how
                            it is protected.
                        </p>
                    </div>
                    <div className="band-grid">
                        <div className="band-item reveal">
                            <ServerOff size={26} />
                            <h3>No bank passwords</h3>
                            <p>FinDB never asks for net banking passwords, PINs or OTPs, and never moves money.</p>
                        </div>
                        <div className="band-item reveal">
                            <LockKeyhole size={26} />
                            <h3>Only you see your data</h3>
                            <p>Every request is limited to your own records, and the database itself blocks anyone else&apos;s.</p>
                        </div>
                        <div className="band-item reveal">
                            <KeyRound size={26} />
                            <h3>Two-step login</h3>
                            <p>Coming next: a code from an authenticator app at every login, free, with no SMS needed.</p>
                        </div>
                        <div className="band-item reveal">
                            <EyeOff size={26} />
                            <h3>Sensitive details encrypted</h3>
                            <p>PAN, account and policy numbers will be encrypted and shown masked. Aadhaar: last 4 digits at most.</p>
                        </div>
                        <div className="band-item reveal">
                            <FileSpreadsheet size={26} />
                            <h3>Your data, your choice</h3>
                            <p>Export it whenever you like. Delete your account and your data goes with it.</p>
                        </div>
                        <div className="band-item reveal">
                            <ShieldCheck size={26} />
                            <h3>Every change logged</h3>
                            <p>An activity log keeps the old and new value of every change you make.</p>
                        </div>
                    </div>
                    <ul className="never reveal" aria-label="What FinDB will never do">
                        <li><Ban size={16} />No ads</li>
                        <li><Ban size={16} />No selling or sharing data</li>
                        <li><Ban size={16} />No loan or card offers</li>
                        <li><Ban size={16} />No commissions on funds or insurance</li>
                    </ul>
                    <p style={{ marginTop: 28 }}>
                        <Link className="btn btn-on-band btn-ghost" href="/security">How FinDB protects you <ArrowRight size={18} /></Link>
                    </p>
                </div>
            </section>

            <section className="section" aria-labelledby="devices-title">
                <div className="wrap">
                    <div className="section-head reveal">
                        <span className="eyebrow">On every screen</span>
                        <h2 id="devices-title">Your phone, your tablet, your computer.</h2>
                        <p className="lede">
                            FinDB runs in your browser and can be added to your home screen, where it opens like an app.
                            Apps for iPhone and Android are planned.
                        </p>
                    </div>
                    <div className="devices">
                        <div className="device reveal">
                            <FeatureIconTile><Smartphone size={26} strokeWidth={1.75} /></FeatureIconTile>
                            <h3>Phone</h3>
                            <p>Add an expense in seconds, wherever you are. Designed for the phone first.</p>
                        </div>
                        <div className="device reveal">
                            <FeatureIconTile><Tablet size={26} strokeWidth={1.75} /></FeatureIconTile>
                            <h3>Tablet</h3>
                            <p>The month at a glance, with room for charts and your full list of accounts.</p>
                        </div>
                        <div className="device reveal">
                            <FeatureIconTile><Monitor size={26} strokeWidth={1.75} /></FeatureIconTile>
                            <h3>Computer</h3>
                            <p>Import statements, review entries in bulk, and prepare for tax season.</p>
                        </div>
                    </div>
                    <p style={{ marginTop: 28 }}>
                        <Link className="text-link" href="/download">Add FinDB to your home screen <ArrowRight size={16} /></Link>
                    </p>
                </div>
            </section>

            <section className="section section-alt" aria-labelledby="free-title">
                <div className="wrap split">
                    <div className="section-head reveal" style={{ marginBottom: 0 }}>
                        <span className="eyebrow">Free for everyone</span>
                        <h2 id="free-title">No plans, no paywall, no catch.</h2>
                        <p className="lede">
                            FinDB is built to cost almost nothing to run, so it can stay free for everyone. Every feature
                            is for everyone. It earns nothing from your data, because it never sells or shares it.
                        </p>
                    </div>
                    <div className="panel reveal">
                        <h3>Built for India, from the start</h3>
                        <ul>
                            <li><ChartNoAxesCombined size={18} /><span>Amounts in lakhs and crores, written the Indian way</span></li>
                            <li><CircleCheck size={18} /><span>Gold by weight and purity, chits, PF, NPS, PPF and post office schemes</span></li>
                            <li><CircleCheck size={18} /><span>Meal cards, UPI wallets, and statements from Indian banks</span></li>
                            <li><Languages size={18} /><span>Hindi and Telugu first, then Tamil, Kannada, Marathi and Bengali</span></li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="section" aria-labelledby="faq-title">
                <div className="wrap narrow">
                    <div className="section-head center reveal">
                        <span className="eyebrow">Questions</span>
                        <h2 id="faq-title">Good questions to ask about a money app.</h2>
                    </div>
                    <FaqList items={FAQ.slice(0, 5)} />
                    <p style={{ marginTop: 24, textAlign: 'center' }}>
                        <Link className="text-link" href="/faq">All questions <ArrowRight size={16} /></Link>
                    </p>
                </div>
            </section>

            <section className="section-tight">
                <div className="wrap">
                    <div className="cta reveal">
                        <span className="eyebrow">Start today</span>
                        <h2>See where your money really stands.</h2>
                        <p>Free for everyone. It takes a minute to sign up, and nothing is connected to your bank.</p>
                        <div className="hero-actions">
                            <a className="btn btn-gold btn-lg" href="/register">Create your free account <ArrowRight size={18} /></a>
                            <Link className="btn btn-ghost btn-on-band btn-lg" href="/roadmap">See the roadmap</Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

function FeatureIconTile({ children }: { children: ReactNode }) {
    return <span className="feature-icon" aria-hidden="true">{children}</span>;
}

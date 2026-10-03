import type { Metadata } from 'next';
import { ArrowRight, Monitor, Smartphone, TabletSmartphone } from 'lucide-react';
import { StatusBadge } from '@/components/site/StatusBadge';

export const metadata: Metadata = {
    title: 'Get the app',
    description: 'Use FinDB on your phone, tablet or computer. Add it to your home screen and it opens like an app.',
};

export default function DownloadPage() {
    return (
        <>
            <section className="page-head">
                <div className="wrap">
                    <span className="eyebrow rise">Get the app</span>
                    <h1 className="rise rise-2">No app store needed. It installs from your browser.</h1>
                    <p className="lede rise rise-3">
                        FinDB is a web app: it runs in your browser on any phone, tablet or computer, and you can add it to
                        your home screen, where it opens full screen like any other app. It takes up almost no space and
                        is always up to date.
                    </p>
                    <div className="hero-actions rise rise-4">
                        <a className="btn btn-primary btn-lg" href="/register">Create your free account <ArrowRight size={18} /></a>
                    </div>
                </div>
            </section>

            <section className="section-tight" aria-labelledby="install-title">
                <div className="wrap">
                    <div className="section-head">
                        <h2 id="install-title" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>Add FinDB to your home screen</h2>
                        <p className="lede">Open FinDB in your browser first, then follow the steps for your device.</p>
                    </div>
                    <div className="platforms">
                        <div className="platform reveal">
                            <span className="feature-icon" aria-hidden="true"><Smartphone size={24} strokeWidth={1.75} /></span>
                            <h3>Android phone or tablet</h3>
                            <ol>
                                <li><span>Open FinDB in <b>Chrome</b>.</span></li>
                                <li><span>Tap the <b>menu</b> (three dots, top right).</span></li>
                                <li><span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li>
                                <li><span>Confirm. FinDB appears with your other apps.</span></li>
                            </ol>
                        </div>
                        <div className="platform reveal">
                            <span className="feature-icon" aria-hidden="true"><TabletSmartphone size={24} strokeWidth={1.75} /></span>
                            <h3>iPhone or iPad</h3>
                            <ol>
                                <li><span>Open FinDB in <b>Safari</b>.</span></li>
                                <li><span>Tap the <b>Share</b> button (a square with an arrow).</span></li>
                                <li><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
                                <li><span>Tap <b>Add</b>. FinDB appears on your home screen.</span></li>
                            </ol>
                        </div>
                        <div className="platform reveal">
                            <span className="feature-icon" aria-hidden="true"><Monitor size={24} strokeWidth={1.75} /></span>
                            <h3>Windows, Mac or Linux</h3>
                            <ol>
                                <li><span>Open FinDB in <b>Chrome</b> or <b>Edge</b>.</span></li>
                                <li><span>Click the <b>install</b> icon at the right end of the address bar.</span></li>
                                <li><span>Click <b>Install</b>. FinDB opens in its own window.</span></li>
                            </ol>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section-tight" aria-labelledby="native-title">
                <div className="wrap">
                    <div className="section-head">
                        <h2 id="native-title" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>Apps for iPhone and Android</h2>
                        <p className="lede">
                            Apps in the App Store and Google Play are planned, with home-screen widgets and faster entry. They
                            will use the same account, so everything you add today carries over.
                        </p>
                    </div>
                    <div className="soon">
                        <div className="soon-card reveal">
                            <span className="feature-icon" aria-hidden="true"><Smartphone size={24} strokeWidth={1.75} /></span>
                            <div>
                                <h3>iPhone and iPad</h3>
                                <p><StatusBadge status="planned" /></p>
                            </div>
                        </div>
                        <div className="soon-card reveal">
                            <span className="feature-icon" aria-hidden="true"><Smartphone size={24} strokeWidth={1.75} /></span>
                            <div>
                                <h3>Android</h3>
                                <p><StatusBadge status="planned" /></p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="section-tight" aria-labelledby="coming-title">
                <div className="wrap split">
                    <div className="panel coming reveal">
                        <h3 id="coming-title">Coming to the web app at launch</h3>
                        <ul>
                            <li><ArrowRight size={18} /><span>Add entries with no signal; they sync when you are back online</span></li>
                            <li><ArrowRight size={18} /><span>Reminders as phone notifications</span></li>
                            <li><ArrowRight size={18} /><span>Share a bank SMS, receipt photo or UPI screenshot straight into FinDB</span></li>
                        </ul>
                    </div>
                    <div className="panel reveal">
                        <h3>Works on</h3>
                        <ul>
                            <li><ArrowRight size={18} /><span>Chrome or Edge, version 111 or later, on Android, Windows, Mac and Linux</span></li>
                            <li><ArrowRight size={18} /><span>Safari 16.4 or later on iPhone, iPad and Mac</span></li>
                            <li><ArrowRight size={18} /><span>Firefox 111 or later</span></li>
                        </ul>
                    </div>
                </div>
            </section>
        </>
    );
}

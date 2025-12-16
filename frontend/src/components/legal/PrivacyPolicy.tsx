
import { Header } from '../layout/Header';
import { Footer } from '../layout/Footer';
import { StickyBackLink } from '../ui/StickyBackLink';

export function PrivacyPolicy() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-indigo-500/30">
            <Header />
            <StickyBackLink />

            <main className="flex-1 max-w-4xl mx-auto w-full px-6 pt-24 pb-12">


                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8 text-slate-900 dark:text-white">Privacy Policy</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 leading-relaxed">
                    Your privacy is critically important to us. This policy explains how we collect, use, and protect your information.
                </p>

                <div className="space-y-12">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">1. Information We Collect</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <p>We collect the following types of information to provide and improve our service:</p>
                            <ul className="list-disc pl-6 space-y-2 mt-4">
                                <li><strong>Account Information:</strong> When you sign in, we collect your email address and authentication tokens via our secure authentication provider.</li>
                                <li><strong>Usage Data:</strong> We collect inputs (prompts) you provide to generate extensions and the resulting code. This data is processed to generate the requested output.</li>
                                <li><strong>Technical Data:</strong> We automatically collect log data such as your IP address, browser type, and operating system for security and debugging purposes.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">2. How We Use Your Information</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <p>We use the collected information for the following purposes:</p>
                            <ul className="list-disc pl-6 space-y-2 mt-4">
                                <li>To generate and deliver the browser extensions you request.</li>
                                <li>To improve our AI models and service performance (prompts may be used anonymously to refine generation quality).</li>
                                <li>To communicate with you regarding your account or service updates.</li>
                                <li>To prevent abuse and ensure the security of our platform.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">3. Data Sharing</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <p>
                                We do not sell your personal data. We may share data with trusted third-party service providers (such as cloud hosting and AI inference providers) solely for the purpose of operating the Service. These providers are bound by confidentiality agreements.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">4. Data Retention</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <p>
                                We retain your account information as long as your account is active. Generated extension history may be retained to allow you to view and download past projects. You may request deletion of your data at any time by contacting support or deleting your account.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">5. Security</h2>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                            <p>
                                We implement industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
                            </p>
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}

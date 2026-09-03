import { redirect } from 'next/navigation';
import Nav from '../../components/Nav';
import AppFooter from '../../components/AppFooter';
import LoginForm from '../../components/LoginForm';
import { getSession } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Log in — Mindscale Echo',
  robots: { index: false, follow: false },
};

const ERRORS = {
  expired: 'That login link is invalid or has expired. Request a new one.',
  config: 'Sign-in is not fully configured yet. Please try again shortly.',
  session: 'We could not verify that checkout session. Request a login link instead.',
};

export default function LoginPage({ searchParams }) {
  const session = getSession();
  if (session?.email) redirect('/account');

  const errorKey = typeof searchParams?.error === 'string' ? searchParams.error : '';
  const message = ERRORS[errorKey];
  const prefill = typeof searchParams?.email === 'string' ? searchParams.email : '';

  return (
    <>
      <Nav />
      <main className="pb-10 pt-32 sm:pt-40">
        <div className="page-shell">
          <div className="mx-auto max-w-xl">
            <header className="text-center">
              <span className="eyebrow eyebrow-dot">Customer workspace</span>
              <h1 className="mt-7 text-[2.4rem] leading-[0.98] sm:text-[3.2rem]">
                <span className="text-gradient">Log in with email.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-md text-[1rem] leading-relaxed text-white/55">
                Use the same address Stripe collected at checkout. We’ll send a one-time link —
                no password.
              </p>
            </header>

            {message && (
              <p role="alert" className="mt-8 text-center text-[0.88rem] text-rose-300/85">
                {message}
              </p>
            )}

            <div className="mt-10">
              <LoginForm prefillEmail={prefill} />
            </div>
          </div>
        </div>
      </main>
      <AppFooter />
    </>
  );
}

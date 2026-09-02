import { redirect } from 'next/navigation';
import Nav from '../../components/Nav';
import AppFooter from '../../components/AppFooter';
import ReleaseCard from '../../components/ReleaseCard';
import { getSession } from '../../lib/auth';
import { isDatabaseConfigured, listOrdersForEmail } from '../../lib/orders';
import { ArrowUpRight } from '../../components/Icons';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your releases — Mindscale Echo',
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }) {
  const session = getSession();
  if (!session?.email) redirect('/login');

  const welcome = searchParams?.welcome === '1';
  let orders = [];
  let dbReady = isDatabaseConfigured();
  if (dbReady) {
    try {
      orders = await listOrdersForEmail(session.email);
    } catch (err) {
      console.error('[account] list orders failed:', err?.message);
      dbReady = false;
    }
  }

  return (
    <>
      <Nav userEmail={session.email} />
      <main className="pb-16 pt-32 sm:pt-40">
        <div className="page-shell">
          <header className="max-w-3xl">
            <span className="eyebrow eyebrow-dot">Your workspace</span>
            <h1 className="mt-7 text-[2.5rem] leading-[0.98] sm:text-[3.4rem]">
              <span className="text-gradient">Releases for</span>
              <br />
              <span className="text-gradient-mint">{session.email}</span>
            </h1>
            <p className="mt-5 max-w-xl text-[1rem] leading-relaxed text-white/55">
              This is your purchase history — not the marketing preview on the homepage. You can
              log back in anytime with this email.
            </p>
          </header>

          {welcome && (
            <div
              className="mt-8 max-w-3xl rounded-2xl px-5 py-4 text-[0.9rem] leading-relaxed text-white/65"
              style={{
                background: 'rgba(127,240,192,0.08)',
                boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.22)',
              }}
            >
              Payment confirmed. This workspace is tied to {session.email}. Keep that address —
              it’s how you return later.
            </div>
          )}

          <div className="mt-10 space-y-8">
            {!dbReady && (
              <p className="text-[0.95rem] text-white/50">
                Your workspace isn’t fully available right now. Please try again shortly.
              </p>
            )}

            {dbReady && orders.length === 0 && (
              <div className="bezel">
                <div className="bezel-core p-8 sm:p-12">
                  <h2 className="text-[1.8rem]">No releases yet</h2>
                  <p className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-white/55">
                    We don’t have a paid order for this email. If you just checked out, wait a
                    moment and refresh. Otherwise start from pricing — checkout collects this
                    address on the receipt.
                  </p>
                  <a href="/#pricing" className="btn btn-primary mt-8">
                    View packages
                    <span className="btn-nib">
                      <ArrowUpRight />
                    </span>
                  </a>
                </div>
              </div>
            )}

            {orders.map((order) => (
              <ReleaseCard key={order.id} order={order} email={session.email} />
            ))}
          </div>
        </div>
      </main>
      <AppFooter />
    </>
  );
}

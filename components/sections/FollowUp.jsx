/**
 * Demoted to a single line. It's the highest-friction, lowest-intent action on
 * the page and must not compete with the buy buttons.
 */
export default function FollowUp() {
  return (
    <section id="follow-up" className="relative pb-4 pt-2">
      <div className="page-shell">
        <p className="text-[0.9rem] leading-relaxed text-white/40">
          Want more coverage after distribution? Once your release is live we can use it as a
          media asset for regional, industry, or category-specific follow-up pitching.{' '}
          <a
            href="mailto:hello@mindscalepartners.com?subject=Follow-up%20pitching%20—%20Mindscale%20Echo"
            className="text-echo-mint underline decoration-echo-mint/30 underline-offset-4 transition-colors duration-500 ease-haptic hover:decoration-echo-mint"
          >
            Ask about follow-up pitching
          </a>
          .
        </p>
      </div>
    </section>
  );
}

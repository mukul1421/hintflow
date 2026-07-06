function Footer() {
  return (
    <section id="cta" className="mx-auto max-w-7xl px-6 pb-24 pt-10 lg:px-10">
      {/* CTA Box - Float Item */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-surface to-[#081225] px-6 py-14 text-center shadow-glow sm:px-10 antigravity-item">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.25),transparent_55%)]" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-secondary">Ready to build</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-5xl">
            Turn LeetCode into a guided learning experience.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Start with a lean, polished frontend that feels like a premium SaaS product while setting the stage for the AI
            mentor, backend APIs, and personalized learning engine.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="#home"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-background transition hover:-translate-y-0.5"
            >
              Back to top
            </a>
            <a
              href="mailto:hello@hintflow.dev"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-text transition hover:border-white/20 hover:bg-white/10"
            >
              Contact the team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Footer;
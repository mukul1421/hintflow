type HowItWorksProps = {
  steps: string[];
};

function HowItWorks({ steps }: HowItWorksProps) {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        {/* Left Column Text - Float Item */}
        <div className="antigravity-item">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
            A mentor loop designed around thinking, feedback, and momentum.
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            HintFlow is built for a browser sidebar that stays lightweight while it quietly pulls in the context needed to
            coach in real time.
          </p>
        </div>

        {/* Right Column Container */}
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="space-y-4">
            {/* Step Cards - Individual Float Items */}
            {steps.map((step, index) => (
              <div
                key={step}
                className="flex gap-4 rounded-2xl border border-white/8 bg-white/5 p-4 antigravity-item"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="pt-0.5 text-sm leading-7 text-muted sm:text-base">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
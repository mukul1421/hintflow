import BrowserMockup from './BrowserMockup';
import FloatingParticles from './FloatingParticles';

type Stat = {
  value: string;
  label: string;
};

type HeroProps = {
  stats: Stat[];
};

function Hero({ stats }: HeroProps) {
  return (
    <section id="home" className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 lg:px-10 lg:pb-28">
      {/* Background Canvas Particles */}
      <FloatingParticles />

      <div className="relative z-10 grid items-center gap-12 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:gap-14">
        <div className="min-w-0 max-w-2xl">
          {/* Badge Widget - Float Item */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted backdrop-blur-md antigravity-item">
            <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_18px_rgba(59,130,246,0.8)] motion-safe:animate-pulse" />
            Real-time coding mentor for LeetCode
          </div>

          {/* Headline - Float Item */}
          <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-[-0.04em] text-text sm:text-6xl lg:text-7xl antigravity-item">
            Learn how to think, not what to type.
          </h1>

          {/* Description - Float Item */}
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted sm:text-xl antigravity-item">
            HintFlow reads the current problem, understands your code, and responds with progressive hints,
            interview-style questions, and targeted feedback that builds problem-solving skill instead of dependency.
          </p>

          {/* Action CTAs - Float Item */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row antigravity-item">
            <a
              href="#modes"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-background transition hover:-translate-y-0.5"
            >
              See the experience
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-text transition hover:border-white/20 hover:bg-white/8"
            >
              How it guides you
            </a>
          </div>

          {/* Stats Grid - Individual Float Items */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="glass-panel rounded-2xl p-4 transition duration-300 hover:-translate-y-1 antigravity-item"
              >
                <p className="text-2xl font-semibold text-text">{stat.value}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Browser Mockup Panel - Float Item */}
        <div className="min-w-0 justify-self-center xl:justify-self-end xl:w-full xl:max-w-[620px] motion-safe:animate-float antigravity-item">
          <BrowserMockup currentPattern="Brute force" complexity="O(n²)" nextHint="Store seen numbers" />
        </div>
      </div>
    </section>
  );
}

export default Hero;
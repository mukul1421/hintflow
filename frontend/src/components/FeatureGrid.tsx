import FeatureCard from './FeatureCard';

type Feature = {
  title: string;
  description: string;
};

type FeatureGridProps = {
  features: Feature[];
};

function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
      {/* Header Container - Float Item */}
      <div className="max-w-2xl motion-safe:animate-fade-up antigravity-item">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-secondary">Core features</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
          Built to guide the next decision, not hand over the answer.
        </h2>
        <p className="mt-4 text-lg leading-8 text-muted">
          The interface stays minimal so the focus remains on reasoning, while each capability helps the user move one
          step closer to the optimal solution.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature, index) => (
          <FeatureCard
            key={feature.title}
            index={index + 1}
            title={feature.title}
            description={feature.description}
            delay={index * 90}
          />
        ))}
      </div>
    </section>
  );
}

export default FeatureGrid;
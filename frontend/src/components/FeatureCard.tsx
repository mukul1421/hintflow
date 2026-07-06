import type { CSSProperties } from 'react';

type FeatureCardProps = {
  index: number;
  title: string;
  description: string;
  delay?: number;
};

const accentLabels: Record<string, string> = {
  'Adaptive Hints': 'Hint',
  'Interview Mode': 'Coach',
  'Complexity Analysis': 'Big O',
  'Pattern Detection': 'Pattern',
  'Personalized Learning': 'Learn',
  'Code-Aware Guidance': 'Code',
};

function FeatureCard({ index, title, description, delay = 0 }: FeatureCardProps) {
  const animationStyle: CSSProperties = {
    animationDelay: `${delay}ms`,
  };

  return (
    <article
      className="glass-panel group min-w-0 overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 motion-safe:animate-fade-up antigravity-item"
      style={animationStyle}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-muted">
            0{index}
          </div>
          <h3 className="mt-4 break-words text-xl font-semibold leading-snug text-text">{title}</h3>
        </div>
        <div className="flex h-12 min-w-12 px-3 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/25 to-secondary/25 opacity-90 transition group-hover:scale-105 group-hover:opacity-100">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text/90">
            {accentLabels[title] ?? 'Flow'}
          </span>
        </div>
      </div>
      <p className="mt-4 break-words text-sm leading-7 text-muted">{description}</p>
    </article>
  );
}

export default FeatureCard;
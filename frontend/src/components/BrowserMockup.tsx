type BrowserMockupProps = {
  currentPattern: string;
  complexity: string;
  nextHint: string;
};

function BrowserMockup({ currentPattern, complexity, nextHint }: BrowserMockupProps) {
  return (
    <div className="relative w-full max-w-[620px]">
      <div className="absolute inset-x-12 top-0 h-20 rounded-full bg-primary/30 blur-3xl motion-safe:animate-pulse" />
      <div className="relative glass-panel overflow-hidden rounded-[2rem] p-4 sm:p-5">
        <div className="rounded-[1.6rem] border border-white/10 bg-[#0b1224] p-4 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400/90 motion-safe:animate-pulse" />
              <span className="h-3 w-3 rounded-full bg-amber-400/90 motion-safe:animate-pulse [animation-delay:180ms]" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90 motion-safe:animate-pulse [animation-delay:360ms]" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
              HintFlow sidebar live preview
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-[1.4rem] border border-white/8 bg-[#0f172a] p-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>LeetCode - Two Sum</span>
                <span>Java</span>
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-[#020617] p-4 font-mono text-[13px] leading-6 text-slate-200">
                <p>class Solution {'{'}</p>
                <p className="pl-4">public int[] twoSum(int[] nums, int target) {'{'}</p>
                <p className="pl-8 text-secondary">for (int i = 0; i &lt; nums.length; i++) {'{'}</p>
                <p className="pl-12">// checking pairs</p>
                <p className="pl-8">{'}'}</p>
                <p className="pl-4">{'}'}</p>
                <p>{'}'}</p>
              </div>
              <div className="mt-4 grid gap-3 grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Current pattern</p>
                  <p className="mt-1.5 text-sm font-medium text-text">{currentPattern}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Complexity</p>
                  <p className="mt-1.5 text-sm font-medium text-text">{complexity}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 shadow-[0_0_12px_rgba(124,58,237,0.12)]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80">Next hint</p>
                  <p className="mt-1.5 text-sm font-semibold text-text">{nextHint}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/8 bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">HintFlow</p>
                  <p className="text-xs text-muted">Interview Mode</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                  Active
                </span>
              </div>



              <div className="mt-4 space-y-3">
                {[
                  {
                    role: 'Interviewer',
                    text: 'Walk me through your current approach before we optimize it.',
                    tone: 'border-secondary/30 bg-secondary/10 text-secondary',
                  },
                  {
                    role: 'You',
                    text: 'I am checking every pair with nested loops.',
                    tone: 'border-white/10 bg-white/5 text-text',
                  },
                  {
                    role: 'Interviewer',
                    text: 'What data structure could help you remember values you have already seen?',
                    tone: 'border-primary/30 bg-primary/10 text-primary',
                  },
                ].map((message) => (
                  <div key={message.text} className={`rounded-2xl border p-3 ${message.tone}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-80">{message.role}</p>
                    <p className="mt-2 text-sm leading-6 text-text">{message.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#020617] p-3 text-sm leading-7 text-muted">
                Adaptive hint level adjusts based on your blockers, not a fixed script.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowserMockup;
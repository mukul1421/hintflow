import { useState } from 'react';

function ModesSection() {
  const [activeTab, setActiveTab] = useState<'hint' | 'interview'>('hint');

  const hintConversation = [
    {
      role: 'HintFlow',
      title: 'Adaptive Hint',
      text: 'You are using a brute-force approach. What if you could store the index of the elements you have already visited?',
      style: 'border-primary/20 bg-primary/5 text-primary',
    },
    {
      role: 'You',
      title: 'Action',
      text: 'Creating a HashMap to store values and indices...',
      style: 'border-white/10 bg-white/5 text-text',
    },
    {
      role: 'HintFlow',
      title: 'Progress Nudge',
      text: 'Correct. Now as you traverse, check if (target - current_val) exists in the map. If it does, you found your pair!',
      style: 'border-secondary/20 bg-secondary/5 text-secondary',
    },
  ];

  const interviewConversation = [
    {
      role: 'Interviewer',
      title: 'Probing Question',
      text: 'Your current solution works in O(n²) time. What is the bottleneck here, and how can we optimize the time complexity?',
      style: 'border-secondary/20 bg-secondary/5 text-secondary',
    },
    {
      role: 'You',
      title: 'Action',
      text: 'The bottleneck is the inner loop checking all subsequent elements. We can trade space for time.',
      style: 'border-white/10 bg-white/5 text-text',
    },
    {
      role: 'Interviewer',
      title: 'Complexity Challenge',
      text: 'Excellent. What would be the space complexity if we use a Hash Map, and are there any edge cases like duplicate elements?',
      style: 'border-primary/20 bg-primary/5 text-primary',
    },
  ];

  const activeMessages = activeTab === 'hint' ? hintConversation : interviewConversation;

  return (
    <section id="modes" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        {/* Text Area */}
        <div className="max-w-2xl antigravity-item">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-secondary">Switching modes</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">
            Choose your level of guidance.
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            HintFlow offers two distinct modes depending on your learning target. Switch instantly directly from your sidebar.
          </p>

          {/* Mode Tabs */}
          <div className="mt-8 flex gap-4 rounded-2xl border border-white/8 bg-[#0b1224]/80 p-2">
            <button
              onClick={() => setActiveTab('hint')}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${
                activeTab === 'hint'
                  ? 'bg-gradient-to-r from-primary/80 to-primary text-white shadow-lg shadow-primary/20'
                  : 'text-muted hover:text-text'
              }`}
            >
              Hint Mode
            </button>
            <button
              onClick={() => setActiveTab('interview')}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${
                activeTab === 'interview'
                  ? 'bg-gradient-to-r from-secondary/80 to-secondary text-white shadow-lg shadow-secondary/20'
                  : 'text-muted hover:text-text'
              }`}
            >
              Interview Mode
            </button>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
            {activeTab === 'hint' ? (
              <p>
                <strong>Hint Mode</strong> acts as an invisible tutor sitting next to you. It reads your editor state and, when you request a hint, reveals only the next logical conceptual block. No full answers, no spoilers, just the right spark to unblock you.
              </p>
            ) : (
              <p>
                <strong>Interview Mode</strong> mimics a real technical mock interviewer. It won't give you code suggestions directly. Instead, it asks high-level algorithmic questions, forces you to explain trade-offs, checks your edge cases, and guides you using standard whiteboard dialogue format.
              </p>
            )}
          </div>
        </div>

        {/* Visual Dashboard Overlay */}
        <div className="glass-panel overflow-hidden rounded-[2rem] p-5 sm:p-6 lg:p-8 antigravity-item">
          <div className="rounded-2xl border border-white/8 bg-[#020617] p-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${activeTab === 'hint' ? 'bg-primary' : 'bg-secondary'}`} />
                <span className="text-xs font-semibold text-text/90">
                  {activeTab === 'hint' ? 'Hint Mode (Active)' : 'Interview Coach (Active)'}
                </span>
              </div>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-muted">
                Sidebar Preview
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {activeMessages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border p-4 transition-all duration-500 transform scale-98 ${message.style}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-80">
                      {message.role}
                    </span>
                    <span className="text-[9px] opacity-60 font-mono">
                      {message.title}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{message.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ModesSection;

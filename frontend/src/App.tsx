import Footer from './components/Footer';
import FeatureGrid from './components/FeatureGrid';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Navbar from './components/Navbar';
import ModesSection from './components/ModesSection';

const features = [
  {
    title: 'Adaptive Hints',
    description:
      'Hints evolve with your progress, revealing the next insight only when you need it, so the answer stays yours.',
  },
  {
    title: 'Interview Mode',
    description:
      'A FAANG-style interviewer asks targeted questions, probes your reasoning, and pushes you toward the optimal path.',
  },
  {
    title: 'Complexity Analysis',
    description:
      'See time and space tradeoffs explained in plain language, with corrections when your estimate is off.',
  },
  {
    title: 'Pattern Detection',
    description:
      'HintFlow recognizes common problem archetypes and surfaces the pattern you should consider before coding.',
  },
  {
    title: 'Personalized Learning',
    description:
      'Your sessions build a memory of what you miss, what you master, and which feedback style helps you learn faster.',
  },
  {
    title: 'Code-Aware Guidance',
    description:
      'The mentor reads the current LeetCode problem and your editor state to respond to what you are actually doing.',
  },
];

const stats = [
  { value: 'Real-time', label: 'Problem + editor awareness' },
  { value: 'Zero spoilers', label: 'No full solution dumps' },
  { value: 'Mode switch', label: 'Hint Mode and Interview Mode' },
];

const flow = [
  'Detect the current LeetCode problem and the code you have written.',
  'Analyze your approach, identify the pattern, and infer the blocker.',
  'Deliver the next best hint, question, or review comment without revealing the answer.',
];

function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-text select-none">
      <div className="absolute inset-0 subtle-grid opacity-40" />
      <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-drift" />
      <div className="absolute right-[-6rem] top-[12rem] h-80 w-80 rounded-full bg-secondary/20 blur-3xl animate-drift" />

      <Navbar />

      <main className="relative z-10">
        <Hero stats={stats} />
        <FeatureGrid features={features} />
        <ModesSection />
        <HowItWorks steps={flow} />
        <Footer />
      </main>
    </div>
  );
}

export default App;
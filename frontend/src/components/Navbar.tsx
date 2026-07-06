import { useState } from 'react';

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        {/* Brand Logo */}
        <a href="#home" className="flex items-center gap-3 z-40">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-primary/20">
            <span className="text-lg font-semibold text-primary">H</span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-text/80">HINTFLOW</p>
            <p className="text-xs text-muted">AI mentor for LeetCode</p>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#features" className="transition hover:text-text">
            Features
          </a>
          <a href="#how-it-works" className="transition hover:text-text">
            How it works
          </a>
          <a href="#modes" className="transition hover:text-text">
            Modes
          </a>
          <a href="#cta" className="transition hover:text-text">
            Launch
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 z-40">
          <a
            href="#cta"
            className="hidden rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:scale-[1.02] sm:inline-flex"
          >
            Join waitlist
          </a>

          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-text transition hover:bg-white/10 md:hidden"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-x-0 top-full z-20 border-b border-white/10 bg-[#020617]/95 px-6 py-8 shadow-2xl backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-5 text-base font-medium">
            <a
              href="#features"
              onClick={() => setIsMenuOpen(false)}
              className="text-muted transition hover:text-text"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setIsMenuOpen(false)}
              className="text-muted transition hover:text-text"
            >
              How it works
            </a>
            <a
              href="#modes"
              onClick={() => setIsMenuOpen(false)}
              className="text-muted transition hover:text-text"
            >
              Modes
            </a>
            <a
              href="#cta"
              onClick={() => setIsMenuOpen(false)}
              className="text-muted transition hover:text-text"
            >
              Launch
            </a>

            <div className="mt-4 pt-6 border-t border-white/5 flex flex-col gap-3">
              <a
                href="#cta"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-semibold text-white shadow-lg"
              >
                Join waitlist
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Navbar;
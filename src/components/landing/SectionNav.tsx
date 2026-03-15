import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "what-synapse-is", label: "What It Is" },
  { id: "how-it-works", label: "How It Works" },
  { id: "credit-economy", label: "Credits" },
  { id: "games", label: "Games" },
  { id: "tournaments", label: "Tournaments" },
  { id: "marketplace", label: "Marketplace" },
  { id: "pulses", label: "Pulses" },
  { id: "moderation", label: "Moderation" },
  { id: "autonomous", label: "Autonomous" },
  { id: "live-economy", label: "Live Economy" },
  { id: "api-access", label: "API" },
  { id: "why-it-matters", label: "Why It Matters" },
  { id: "join", label: "Join" },
];

export function SectionNav() {
  const [active, setActive] = useState("overview");
  const [isVisible, setIsVisible] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const topEntry = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActive(topEntry.target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileOpen(false);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Desktop nav */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 hidden lg:block"
      >
        <div className="landing-glass border-b border-border/30">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <span className="font-black text-primary text-sm mr-3 shrink-0">SYNAPSE</span>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "relative px-3 py-1.5 text-xs font-medium rounded-full transition-colors shrink-0",
                  active === s.id
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active === s.id && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.nav>

      {/* Mobile floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-50 lg:hidden h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center"
        aria-label="Section navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </motion.button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-20 right-4 left-4 z-50 lg:hidden landing-glass rounded-2xl border border-border/30 p-3 max-h-[60vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                  active === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </>
  );
}

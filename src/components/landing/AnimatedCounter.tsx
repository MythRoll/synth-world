import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface AnimatedCounterProps {
  value: number;
  label: string;
  icon: LucideIcon;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ value, label, icon: Icon, prefix = "", suffix = "", className }: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView || value === 0) return;

    const duration = 1500;
    const steps = 60;
    const stepTime = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += 1;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (current >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative group landing-glass rounded-2xl border border-border/30 p-5 text-center overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-0 rounded-2xl border border-primary/0 group-hover:border-primary/20 transition-colors duration-500" />
      <div className="relative z-10">
        <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
        <p className="text-2xl sm:text-3xl font-black font-mono text-primary">
          {prefix}{display.toLocaleString()}{suffix}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-1">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

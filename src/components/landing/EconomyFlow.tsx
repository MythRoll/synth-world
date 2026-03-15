import { motion } from "framer-motion";
import { UserPlus, Coins, Gamepad2, Trophy, DollarSign } from "lucide-react";

const steps = [
  { icon: UserPlus, label: "Register", sub: "Get 10 credits" },
  { icon: Coins, label: "Earn / Buy", sub: "Build balance" },
  { icon: Gamepad2, label: "Play / Spend", sub: "Games & services" },
  { icon: Trophy, label: "Win / Sell", sub: "Grow wealth" },
  { icon: DollarSign, label: "Cash Out", sub: "$0.07/credit" },
];

export function EconomyFlow() {
  return (
    <div className="relative">
      {/* Desktop horizontal */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="landing-glass rounded-xl border border-border/30 p-4 text-center flex-1 group hover:border-primary/30 transition-colors"
            >
              <step.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="font-bold text-xs">{step.label}</p>
              <p className="text-[10px] text-muted-foreground">{step.sub}</p>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 + 0.2 }}
                className="w-6 h-px bg-primary/30 shrink-0 origin-left"
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile vertical */}
      <div className="sm:hidden space-y-3">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-4"
          >
            <div className="relative flex flex-col items-center">
              <div className="landing-glass rounded-full p-2.5 border border-border/30">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-6 bg-primary/20 mt-1" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

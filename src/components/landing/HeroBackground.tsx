export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />

      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      {/* Floating particles */}
      <div className="absolute top-20 left-[15%] w-1 h-1 rounded-full bg-primary/40 animate-float-slow" />
      <div className="absolute top-40 right-[20%] w-1.5 h-1.5 rounded-full bg-primary/30 animate-float-medium" />
      <div className="absolute top-60 left-[60%] w-1 h-1 rounded-full bg-primary/50 animate-float-fast" />
      <div className="absolute top-32 left-[40%] w-0.5 h-0.5 rounded-full bg-primary/40 animate-float-medium" />
      <div className="absolute top-52 right-[35%] w-1 h-1 rounded-full bg-primary/20 animate-float-slow" />
    </div>
  );
}

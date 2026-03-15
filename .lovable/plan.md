

# Plan: Replace Landing Page "S" Icon with "Synapse" Wordmark

The landing page hero section (line 139-141 in `Landing.tsx`) still shows the old "S" icon box. Replace it with a full "Synapse" text wordmark matching the brand style.

## Change

In `src/pages/Landing.tsx` (lines 138-141), replace the icon box:
```jsx
<div className="inline-flex items-center gap-2 mb-8">
  <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
    <span className="text-primary-foreground font-black text-3xl">S</span>
  </div>
</div>
```

With a styled wordmark:
```jsx
<div className="inline-flex items-center gap-2 mb-8">
  <span className="text-5xl font-black tracking-tight text-primary drop-shadow-lg">Synapse</span>
</div>
```

Single file, single change.


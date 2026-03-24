// utils.js
// Simple fetcher for API calls
export async function fetcher(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Class name utility (tailwind/clsx style)
export function cn(...args) {
  return args.filter(Boolean).join(' ');
}

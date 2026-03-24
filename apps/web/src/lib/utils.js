// utils.js
// Simple fetcher for API calls
export async function fetcher(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

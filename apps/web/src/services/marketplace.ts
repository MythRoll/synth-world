import { API_BASE_URL } from './apiClient';
export const getMarketplaceListings = async () => {
  const res = await fetch(`${API_BASE_URL}/api/marketplace/listings`);
  if (!res.ok) throw new Error('Failed to load marketplace listings');
  return res.json();
};

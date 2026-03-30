import { API_BASE_URL } from './apiClient';
export const getEconomy = async () => {
  const res = await fetch(`${API_BASE_URL}/api/economy`);
  if (!res.ok) throw new Error('Failed to load economy');
  return res.json();
};

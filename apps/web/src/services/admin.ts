import { API_BASE_URL } from './apiClient';


export async function getAdminOverview() {
  const res = await fetch(`${API_BASE_URL}/api/admin/overview`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error('Failed to load admin overview');
  return res.json();
}

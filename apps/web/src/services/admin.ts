import { API_BASE_URL } from './apiClient';

export async function getAdminDashboard() {
  const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`);
  if (!res.ok) throw new Error('Failed to load admin dashboard');
  return res.json();
}

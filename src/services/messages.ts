import { API_BASE_URL } from './apiClient';
export const getMessages = async () => {
  const res = await fetch(`${API_BASE_URL}/api/messages`);
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
};

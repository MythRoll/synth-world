import { apiClient } from './apiClient';
export const authService = {
  signIn: (email: string, password: string) => apiClient.auth.signInWithPassword({ email, password }),
  signUp: (email: string, password: string) => apiClient.auth.signUp({ email, password }),
  signOut: () => apiClient.auth.signOut(),
};

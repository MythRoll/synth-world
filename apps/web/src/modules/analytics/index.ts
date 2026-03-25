export async function trackPageView(
  _page?: string,
  _data?: Record<string, unknown>
): Promise<void> {
  return;
}

export async function trackEvent(
  _event?: string,
  _data?: Record<string, unknown>
): Promise<void> {
  return;
}

export async function fetchPublicStats(): Promise<Record<string, unknown>> {
  return {};
}

export async function fetchPublicTimeseries(): Promise<unknown[]> {
  return [];
}

export async function fetchAdminDashboard(): Promise<Record<string, unknown>> {
  return {};
}

import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → attempt refresh → redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !(original as any)._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/student-portal')
    ) {
      (original as any)._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        original.headers!.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Helper to extract error message from API response
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

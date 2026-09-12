// Central API and WebSocket configuration for local dev and cloud deployments (Vercel / Render)

const envApiUrl = import.meta.env.VITE_API_URL;

// In dev mode without an override, use relative path (Vite proxy). In production, default to the Render backend.
export const API_BASE: string = 
  envApiUrl !== undefined 
    ? envApiUrl.replace(/\/+$/, '') 
    : (import.meta.env.DEV ? '' : 'https://soc-agent-u5eb.onrender.com');

export function getWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE) {
    const wsPrefix = API_BASE.startsWith('https:') ? 'wss:' : 'ws:';
    const host = API_BASE.replace(/^https?:\/\//, '');
    return `${wsPrefix}//${host}${cleanPath}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}

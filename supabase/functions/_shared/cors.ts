// Shared CORS configuration for all edge functions
// Uses origin validation instead of wildcard to prevent CSRF attacks

const ALLOWED_ORIGINS = [
  'https://ops-watch-go.lovable.app',
  'https://id-preview--b9a37ea4-6a21-4ede-8f21-77cda9cd79de.lovable.app',
  'https://b9a37ea4-6a21-4ede-8f21-77cda9cd79de.lovableproject.com',
  'https://mhnzhwqroyyxpbxrylax.supabase.co',
  'https://nahorafrota.tech',
  'https://www.nahorafrota.tech',
];

// Development origins (only if ENVIRONMENT is development)
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
];

// Extra origins without a code change (e.g. the project's .vercel.app address):
// Edge Functions secret ALLOWED_ORIGINS, comma separated.
function extraOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const environment = Deno.env.get('ENVIRONMENT') || 'production';
  const isDev = environment === 'development';

  const allAllowedOrigins = isDev
    ? [...ALLOWED_ORIGINS, ...extraOrigins(), ...DEV_ORIGINS]
    : [...ALLOWED_ORIGINS, ...extraOrigins()];
  
  const origin = requestOrigin || '';
  
  // Check if the origin is in our allowed list
  const isAllowed = allAllowedOrigins.some(allowed => 
    origin === allowed ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com') ||
    origin.endsWith('.nahorafrota.tech')
  ) || DEV_ORIGINS.includes(origin);
  
  // Use the request origin if allowed, otherwise use the first allowed origin
  const allowedOrigin = isAllowed ? origin : allAllowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}

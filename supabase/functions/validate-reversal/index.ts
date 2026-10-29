import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration with origin validation
const ALLOWED_ORIGINS = [
  'https://ops-watch-go.lovable.app',
  'https://id-preview--b9a37ea4-6a21-4ede-8f21-77cda9cd79de.lovable.app',
  'https://mhnzhwqroyyxpbxrylax.supabase.co',
  'https://nahorafrota.tech',
  'https://www.nahorafrota.tech',
];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const environment = Deno.env.get('ENVIRONMENT') || 'production';
  const isDev = environment === 'development';
  
  const allAllowedOrigins = isDev 
    ? [...ALLOWED_ORIGINS, ...DEV_ORIGINS]
    : ALLOWED_ORIGINS;
  
  const origin = requestOrigin || '';
  const isAllowed = allAllowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith('.lovable.app')
  );
  
  const allowedOrigin = isAllowed ? origin : allAllowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Credentials': 'true',
  };
}

interface ValidateRequest {
  password: string;
  action: string;
  settlementId?: string;
  manifestCode?: string;
}

// In-memory rate limiting store
const rateLimitStore = new Map<string, { attempts: number; resetAt: number }>();

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes after max attempts

function checkRateLimit(userId: string): { allowed: boolean; remainingAttempts: number; retryAfterMs?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  
  if (record && now > record.resetAt) {
    rateLimitStore.delete(userId);
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }
  
  if (!record) {
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }
  
  if (record.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { 
      allowed: false, 
      remainingAttempts: 0,
      retryAfterMs: record.resetAt - now
    };
  }
  
  return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - record.attempts };
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, {
      attempts: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
  } else {
    record.attempts += 1;
    if (record.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      record.resetAt = now + LOCKOUT_DURATION_MS;
    }
    rateLimitStore.set(userId, record);
  }
}

function clearRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const reversalPassword = Deno.env.get('REVERSAL_PASSWORD');

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ valid: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.warn('Invalid JWT token');
      return new Response(
        JSON.stringify({ valid: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    
    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs || 0) / 1000);
      console.warn(`Rate limit exceeded for user: ${userId}. Retry after ${retryAfterSeconds}s`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Muitas tentativas. Tente novamente mais tarde.',
          retryAfterSeconds
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds)
          } 
        }
      );
    }

    console.log(`Reversal validation request from user: ${userId}`);

    const { password, action, settlementId, manifestCode }: ValidateRequest = await req.json();

    if (!password) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reversalPassword) {
      console.error('REVERSAL_PASSWORD secret not configured');
      return new Response(
        JSON.stringify({ valid: false, error: 'Reversal validation not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Timing-safe password comparison
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const reversalBytes = encoder.encode(reversalPassword);
    
    const maxLength = Math.max(passwordBytes.length, reversalBytes.length);
    const paddedPassword = new Uint8Array(maxLength);
    const paddedReversal = new Uint8Array(maxLength);
    paddedPassword.set(passwordBytes);
    paddedReversal.set(reversalBytes);
    
    let isValid = passwordBytes.length === reversalBytes.length;
    for (let i = 0; i < maxLength; i++) {
      if (paddedPassword[i] !== paddedReversal[i]) {
        isValid = false;
      }
    }

    console.log(`Reversal validation attempt - User: ${userId}, Action: ${action}, SettlementId: ${settlementId || 'N/A'}, ManifestCode: ${manifestCode || 'N/A'}, Valid: ${isValid}`);

    if (!isValid) {
      recordFailedAttempt(userId);
      const remainingAttempts = RATE_LIMIT_MAX_ATTEMPTS - (rateLimitStore.get(userId)?.attempts || 0);
      console.warn(`Failed reversal validation for user: ${userId}. Remaining attempts: ${remainingAttempts}`);
      
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Senha de estorno incorreta',
          remainingAttempts: Math.max(0, remainingAttempts)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    clearRateLimit(userId);

    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reversal validation error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' } }
    );
  }
});

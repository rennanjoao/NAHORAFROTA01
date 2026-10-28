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
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allAllowedOrigins = [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
  
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

interface GeocodeRequest {
  address: string;
}

interface GeocodeResponse {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  success: boolean;
  error?: string;
}

async function geocodeWithNominatim(address: string): Promise<GeocodeResponse> {
  const encodedAddress = encodeURIComponent(address);
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodedAddress}`;

  const response = await fetch(nominatimUrl, {
    headers: {
      'User-Agent': 'NahoraFrota/1.0 (geocode-address)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    return {
      success: false,
      error: `Nominatim API error: ${response.status}`,
      latitude: null,
      longitude: null,
      formattedAddress: null,
    };
  }

  const data = await response.json();
  const firstResult = Array.isArray(data) ? data[0] : null;

  if (!firstResult?.lat || !firstResult?.lon) {
    return {
      success: false,
      error: 'No results found for this address',
      latitude: null,
      longitude: null,
      formattedAddress: null,
    };
  }

  return {
    success: true,
    latitude: Number(firstResult.lat),
    longitude: Number(firstResult.lon),
    formattedAddress: firstResult.display_name || address,
  };
}

// Input validation constants
const MAX_ADDRESS_LENGTH = 500;
const MIN_ADDRESS_LENGTH = 5;
// Pattern for Brazilian addresses - allows letters (including accents), numbers, spaces, and common punctuation
const ADDRESS_PATTERN = /^[a-zA-Z0-9\s,.\-/°ºª'"\u00C0-\u017F]+$/;

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const MAPBOX_TOKEN = Deno.env.get('VITE_MAPBOX_TOKEN');

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('Missing or invalid authorization header for geocoding request');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.warn('Invalid JWT token for geocoding:', claimsError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized',
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Geocoding request from authenticated user: ${userId}`);
    
    // Parse and validate request body
    let body: GeocodeRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request body',
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { address } = body;

    // Validate address type
    if (!address || typeof address !== 'string') {
      console.warn('Invalid address type received');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Address must be a non-empty string',
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const trimmedAddress = address.trim();

    // Validate address length
    if (trimmedAddress.length < MIN_ADDRESS_LENGTH) {
      console.warn(`Address too short: ${trimmedAddress.length} chars`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Address must be at least ${MIN_ADDRESS_LENGTH} characters`,
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (trimmedAddress.length > MAX_ADDRESS_LENGTH) {
      console.warn(`Address too long: ${trimmedAddress.length} chars`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Address must be less than ${MAX_ADDRESS_LENGTH} characters`,
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate address pattern (allows common Brazilian address characters)
    if (!ADDRESS_PATTERN.test(trimmedAddress)) {
      console.warn(`Address contains invalid characters: ${trimmedAddress.substring(0, 50)}...`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Address contains invalid characters',
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Geocoding validated address for user ${userId}: ${trimmedAddress.substring(0, 100)}...`);

    if (!MAPBOX_TOKEN) {
      console.warn('MAPBOX_TOKEN not configured; using Nominatim fallback');
      const result = await geocodeWithNominatim(trimmedAddress);
      return new Response(
        JSON.stringify(result),
        {
          status: result.success ? 200 : 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Mapbox Geocoding API
    const encodedAddress = encodeURIComponent(trimmedAddress);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=BR&limit=1`;
    
    const response = await fetch(mapboxUrl);
    
    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Mapbox API error: ${response.status}`,
          latitude: null,
          longitude: null,
          formattedAddress: null
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      console.warn(`No results found for address: ${trimmedAddress.substring(0, 50)}...`);
      const fallbackResult = await geocodeWithNominatim(trimmedAddress);
      return new Response(
        JSON.stringify(fallbackResult),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.center;
    const formattedAddress = feature.place_name;

    console.log(`Geocoded successfully for user ${userId}: lat=${latitude}, lng=${longitude}`);

    const result: GeocodeResponse = {
      success: true,
      latitude,
      longitude,
      formattedAddress
    };

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        latitude: null,
        longitude: null,
        formattedAddress: null
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' } 
      }
    );
  }
});

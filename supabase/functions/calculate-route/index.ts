import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface RouteWaypoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
}

interface RouteRequest {
  start: RouteWaypoint;
  deliveries: RouteWaypoint[];
  returnToBase?: boolean;
}

function toCoordinate(point: RouteWaypoint) {
  return `${point.lng},${point.lat}`;
}

function normalizeOrderedWaypoints(
  start: RouteWaypoint,
  deliveries: RouteWaypoint[],
  optimizedWaypointIndexes: number[],
  returnToBase: boolean,
) {
  const orderedDeliveries = optimizedWaypointIndexes
    .map((index) => deliveries[index])
    .filter(Boolean);

  const ordered = [start, ...orderedDeliveries];

  if (returnToBase) {
    ordered.push({ ...start, id: `${start.id}-return`, label: "Retorno a Base" });
  }

  return ordered;
}

function distanceKm(a: RouteWaypoint, b: RouteWaypoint) {
  const radius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return radius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function orderNearestNeighbor(start: RouteWaypoint, deliveries: RouteWaypoint[]) {
  const ordered: RouteWaypoint[] = [];
  const remaining = [...deliveries];
  let current = start;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidateDistance = distanceKm(current, remaining[index]);
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearestIndex = index;
      }
    }

    current = remaining[nearestIndex];
    ordered.push(current);
    remaining.splice(nearestIndex, 1);
  }

  return ordered;
}

async function calculateOsrmRoute(start: RouteWaypoint, deliveries: RouteWaypoint[], returnToBase: boolean) {
  const orderedDeliveries = orderNearestNeighbor(start, deliveries);
  const waypoints = returnToBase
    ? [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
    : [start, ...orderedDeliveries];

  const url =
    `https://router.project-osrm.org/route/v1/driving/${waypoints.map(toCoordinate).join(";")}` +
    "?overview=full&geometries=geojson&steps=false";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM falhou (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (!route?.distance || !route?.duration || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("OSRM nao retornou uma rota valida");
  }

  return {
    success: true,
    totalDistance: Math.round((Number(route.distance) / 1000) * 10) / 10,
    totalDuration: Math.round(Number(route.duration) / 60),
    polyline: null,
    coordinates: coordinates
      .filter((coordinate: unknown) =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(Number(coordinate[0])) &&
        Number.isFinite(Number(coordinate[1])),
      )
      .map((coordinate: [number, number]) => [Number(coordinate[0]), Number(coordinate[1])]),
    source: "osrm",
    waypoints,
  };
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const mapboxToken = Deno.env.get("VITE_MAPBOX_TOKEN");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ success: false, error: "Configuracao do servidor incompleta" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Sessao invalida" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json()) as RouteRequest;
    const start = body?.start;
    const deliveries = Array.isArray(body?.deliveries) ? body.deliveries : [];
    const returnToBase = Boolean(body?.returnToBase);

    if (!start || deliveries.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "A rota precisa de pelo menos 2 pontos" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    for (const waypoint of [start, ...deliveries]) {
      if (
        typeof waypoint?.lat !== "number" ||
        typeof waypoint?.lng !== "number" ||
        Number.isNaN(waypoint.lat) ||
        Number.isNaN(waypoint.lng)
      ) {
        return new Response(JSON.stringify({ success: false, error: "Coordenadas invalidas na rota" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
    }

    if (!mapboxToken) {
      const osrmRoute = await calculateOsrmRoute(start, deliveries, returnToBase);
      return new Response(JSON.stringify(osrmRoute), { status: 200, headers: jsonHeaders });
    }

    if (deliveries.length === 1) {
      const directionsCoordinates = returnToBase
        ? [start, deliveries[0], { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
        : [start, deliveries[0]];

      const directionsUrl =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${directionsCoordinates.map(toCoordinate).join(";")}` +
        `?geometries=polyline6&overview=full&steps=false&access_token=${mapboxToken}`;

      const directionsResponse = await fetch(directionsUrl);
      if (!directionsResponse.ok) {
        const errorText = await directionsResponse.text();
        return new Response(
          JSON.stringify({
            success: false,
            error: `Mapbox Directions falhou (${directionsResponse.status}): ${errorText}`,
          }),
          { status: 502, headers: jsonHeaders },
        );
      }

      const directionsData = await directionsResponse.json();
      const route = directionsData?.routes?.[0];

      if (!route?.distance || !route?.duration) {
        return new Response(JSON.stringify({ success: false, error: "Mapbox nao retornou uma rota valida" }), {
          status: 502,
          headers: jsonHeaders,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalDistance: Math.round((Number(route.distance) / 1000) * 10) / 10,
          totalDuration: Math.round(Number(route.duration) / 60),
          polyline: typeof route.geometry === "string" ? route.geometry : null,
          source: "mapbox_directions",
          waypoints: directionsCoordinates,
        }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const buildOptimizedRoute = async (optimizationDeliveries: RouteWaypoint[], finalDelivery?: RouteWaypoint) => {
      const coordinates = finalDelivery
        ? [start, ...optimizationDeliveries.filter((delivery) => delivery.id !== finalDelivery.id), finalDelivery]
        : [start, ...optimizationDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }];

      const url =
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates.map(toCoordinate).join(";")}` +
        `?geometries=polyline6&overview=full&steps=false&roundtrip=false&source=first&destination=last&access_token=${mapboxToken}`;

      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      const trip = data?.trips?.[0];
      if (!trip?.distance || !trip?.duration) return null;

      const orderedIndexes = (data?.waypoints || [])
        .map((waypoint: { waypoint_index?: number }, inputIndex: number) => ({ waypoint, inputIndex }))
        .filter(
          (entry: { waypoint: { waypoint_index?: number }; inputIndex: number }) =>
            entry.inputIndex > 0 &&
            entry.inputIndex <= optimizationDeliveries.length &&
            typeof entry.waypoint?.waypoint_index === "number",
        )
        .sort(
          (
            a: { waypoint: { waypoint_index?: number } },
            b: { waypoint: { waypoint_index?: number } },
          ) => Number(a.waypoint.waypoint_index) - Number(b.waypoint.waypoint_index),
        )
        .map((entry: { inputIndex: number }) => entry.inputIndex - 1);

      const orderedDeliveries = orderedIndexes
        .map((deliveryIndex: number) => coordinates[deliveryIndex + 1])
        .filter((waypoint: RouteWaypoint | undefined) => waypoint && !waypoint.id.includes("return"));

      return {
        totalDistance: Math.round((Number(trip.distance) / 1000) * 10) / 10,
        totalDuration: Math.round(Number(trip.duration) / 60),
        polyline: typeof trip.geometry === "string" ? trip.geometry : null,
        waypoints: finalDelivery
          ? [start, ...orderedDeliveries]
          : [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }],
      };
    };

    if (!returnToBase) {
      const candidateRoutes = await Promise.all(
        deliveries.map((finalDelivery) => buildOptimizedRoute(deliveries, finalDelivery)),
      );
      const bestRoute = candidateRoutes
        .filter(Boolean)
        .sort((a, b) => Number(a?.totalDistance) - Number(b?.totalDistance))[0];

      if (bestRoute) {
        return new Response(
          JSON.stringify({
            success: true,
            totalDistance: bestRoute.totalDistance,
            totalDuration: bestRoute.totalDuration,
            polyline: bestRoute.polyline,
            source: "mapbox_optimization_open_route",
            waypoints: bestRoute.waypoints,
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
    }

    const optimizationCoordinates = returnToBase
      ? [start, ...deliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
      : [start, ...deliveries];

    const optimizationUrl =
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${optimizationCoordinates.map(toCoordinate).join(";")}` +
      `?geometries=polyline6&overview=full&steps=false&roundtrip=false&source=first&destination=last&access_token=${mapboxToken}`;

    const optimizationResponse = await fetch(optimizationUrl);
    if (!optimizationResponse.ok) {
      const errorText = await optimizationResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `Mapbox Optimization falhou (${optimizationResponse.status}): ${errorText}`,
        }),
        { status: 502, headers: jsonHeaders },
      );
    }

    const optimizationData = await optimizationResponse.json();
    const trip = optimizationData?.trips?.[0];

    if (!trip?.distance || !trip?.duration) {
      return new Response(JSON.stringify({ success: false, error: "Mapbox nao retornou uma rota valida" }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    const optimizedWaypointIndexes = (optimizationData?.waypoints || [])
      .map((waypoint: { waypoint_index?: number }, inputIndex: number) => ({ waypoint, inputIndex }))
      .filter(
        (entry: { waypoint: { waypoint_index?: number }; inputIndex: number }) =>
          entry.inputIndex > 0 &&
          entry.inputIndex <= deliveries.length &&
          typeof entry.waypoint?.waypoint_index === "number",
      )
      .sort(
        (
          a: { waypoint: { waypoint_index?: number } },
          b: { waypoint: { waypoint_index?: number } },
        ) => Number(a.waypoint.waypoint_index) - Number(b.waypoint.waypoint_index),
      )
      .map((entry: { inputIndex: number }) => entry.inputIndex - 1);

    const orderedWaypoints = normalizeOrderedWaypoints(start, deliveries, optimizedWaypointIndexes, returnToBase);

    return new Response(
      JSON.stringify({
        success: true,
        totalDistance: Math.round((Number(trip.distance) / 1000) * 10) / 10,
        totalDuration: Math.round(Number(trip.duration) / 60),
        polyline: typeof trip.geometry === "string" ? trip.geometry : null,
        source: "mapbox_optimization",
        waypoints: orderedWaypoints,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno do servidor",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});

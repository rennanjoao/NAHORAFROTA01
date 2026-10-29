// Route Optimization Service
// Integrates with mapping APIs to calculate optimal delivery sequences

export interface Waypoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface OptimizedRoute {
  waypoints: Waypoint[];
  totalDistance: number; // in km
  totalDuration: number; // in minutes
  polyline?: string; // encoded polyline for map rendering
  coordinates?: Array<[number, number]>; // GeoJSON-style [lng, lat] route line
}

export function decodePolyline(polyline: string, precision = 6): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  const factor = Math.pow(10, precision);
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < polyline.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Nearest Neighbor Algorithm for route optimization
export function optimizeRouteNearestNeighbor(
  start: Waypoint,
  destinations: Waypoint[],
  returnToBase: boolean = false
): OptimizedRoute {
  if (destinations.length === 0) {
    return {
      waypoints: [start],
      totalDistance: 0,
      totalDuration: 0
    };
  }

  const optimizedOrder: Waypoint[] = [start];
  const remaining = [...destinations];
  let current = start;
  let totalDistance = 0;

  // Find nearest neighbor iteratively
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.lat, current.lng,
        remaining[i].lat, remaining[i].lng
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    totalDistance += nearestDistance;
    current = remaining[nearestIndex];
    optimizedOrder.push(current);
    remaining.splice(nearestIndex, 1);
  }

  // Add return to base if requested
  if (returnToBase) {
    const returnDistance = calculateDistance(
      current.lat, current.lng,
      start.lat, start.lng
    );
    totalDistance += returnDistance;
    optimizedOrder.push({ ...start, id: `${start.id}-return`, label: 'Retorno à Base' });
  }

  // Estimate duration (average 30 km/h in urban areas + 5 min per stop)
  const drivingTime = (totalDistance / 30) * 60; // minutes
  const stopTime = (optimizedOrder.length - 1) * 5; // 5 min per delivery
  const totalDuration = drivingTime + stopTime;

  return {
    waypoints: optimizedOrder,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.round(totalDuration)
  };
}

// Geocode an address using a simple mock (in production, use Google Maps or Mapbox API)
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // São Paulo center coordinates as base
  const baseLat = -23.5505;
  const baseLng = -46.6333;
  
  // Generate consistent coordinates based on address hash
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.2; // +/- 0.1 degrees
  const lngOffset = (((hash * 7) % 1000) / 1000 - 0.5) * 0.2;
  
  return {
    lat: baseLat + latOffset,
    lng: baseLng + lngOffset
  };
}

// Format duration for display
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1).replace(".", ",")} km`;
}

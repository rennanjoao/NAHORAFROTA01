// Calculos geograficos usados no app do motorista.

/** Raio (m) em torno do endereco da entrega para considerar "motorista chegou". */
export const ARRIVAL_RADIUS_METERS = 100;

/**
 * Precisao minima (m) do GPS para registrar chegada. Com leitura pior que o
 * raio, nao da para afirmar que o motorista esta a menos de 100 m do endereco.
 */
export const ARRIVAL_MAX_ACCURACY_METERS = 100;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Distancia em metros entre dois pontos (formula de Haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface ArrivalCandidate {
  id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  arrived_at?: string | null;
}

const FINISHED_STATUSES = new Set(["delivered", "returned", "cancelled"]);

/**
 * Entregas pendentes cujo endereco esta dentro do raio da posicao atual,
 * da mais proxima para a mais distante. Ignora leituras de GPS imprecisas.
 */
export function findArrivals<T extends ArrivalCandidate>(
  position: LatLng & { accuracy?: number | null },
  deliveries: T[],
  radius: number = ARRIVAL_RADIUS_METERS,
): Array<{ delivery: T; distance: number }> {
  if (position.accuracy != null && position.accuracy > ARRIVAL_MAX_ACCURACY_METERS) return [];

  return deliveries
    .filter(
      (d) =>
        !d.arrived_at &&
        !FINISHED_STATUSES.has(d.status) &&
        d.latitude != null &&
        d.longitude != null,
    )
    .map((delivery) => ({
      delivery,
      distance: distanceMeters(position, { latitude: Number(delivery.latitude), longitude: Number(delivery.longitude) }),
    }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

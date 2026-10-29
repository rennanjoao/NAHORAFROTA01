import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Car,
  Check,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
  Route,
  Truck,
  Users,
} from "lucide-react";
import Map, { Marker, Source, Layer, type LayerProps } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge } from "@/components/patterns";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { STATUS_HEX } from "@/lib/brandSymbol";
import { DriverAvatar, DriverCombobox, ExtendedDriver } from "./DriverCombobox";
import { ManifestSuccessDialog } from "./ManifestSuccessDialog";
import { WizardSteps } from "./WizardSteps";
import { FREIGHT_TYPE_LABELS, vehicleTypeLabel } from "./status";
import { ManifestRecord, manifestStore } from "@/stores/manifestStore";
import { formatCurrency } from "@/lib/formatCurrency";
import { companyVehicleStore, CompanyVehicle } from "@/stores/companyVehicleStore";
import { useManifestsDB, CreateManifestInput, DBManifest } from "@/hooks/useManifestsDB";
import { decodePolyline, geocodeAddress, optimizeRouteNearestNeighbor, formatDistance, formatDuration, Waypoint } from "@/lib/routeOptimization";
import { useTenantData } from "@/hooks/useTenantData";
import { supabase } from "@/integrations/supabase/client";
import { useDBDrivers } from "@/hooks/useDBDrivers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FreightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedDeliveryIds: number[];
  dbInvoiceIds?: string[]; // Optional: UUIDs from database for DB persistence
  onConfirm: (freightData: FreightData, manifest: ManifestRecord, dbManifest?: DBManifest | null) => void;
  /** Abre a impressao do romaneio recem-criado (botao do dialogo de sucesso). */
  onPrint?: () => void;
}

export interface FreightData {
  type: "fixed" | "lumpsum" | "per_km";
  unitValue?: number;
  totalValue?: number;
  perKmValue?: number;
  estimatedDistance?: number;
  calculatedTotal?: number;
  driver?: ExtendedDriver;
  returnToBase?: boolean;
  optimizedRoute?: {
    waypoints: Waypoint[];
    totalDistance: number;
    totalDuration: number;
  };
  fleetType?: "third_party" | "own_fleet";
  selectedVehicle?: CompanyVehicle;
}

type FleetType = "third_party" | "own_fleet";
type StepType = "fleet_type" | "route" | "freight" | "driver" | "preview";

const routeLineLayer: LayerProps = {
  id: "optimized-route-line",
  type: "line",
  paint: {
    "line-color": STATUS_HEX.ok, // manual: rotas em Verde Na Hora
    "line-width": 4,
    "line-opacity": 0.85,
  },
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
};

function toRouteCoordinate(point: Waypoint) {
  return `${point.lng},${point.lat}`;
}

/** Nome da parada para leitor de tela e lista: "Partida: Base", "Parada 2: Loja X". */
function stopName(point: Waypoint, idx: number) {
  if (idx === 0) return "Partida: base da empresa";
  if (point.id.includes("return")) return "Retorno à base";
  return `Parada ${idx}: ${(point.label || "Entrega").replace(/^\d+\.\s*/, "")}`;
}

/** Distancia com virgula decimal (pt-BR). */

/** Endereco vazio da base (", - /") vira um aviso legivel. */
const readableAddress = (address?: string) =>
  address && address.replace(/[\s,\-/]/g, "") ? address : "Endereço não cadastrado";

/** Letra/numero dentro do marcador: P (partida), R (retorno) ou a ordem. */
const stopMark = (point: Waypoint, idx: number) => (idx === 0 ? "P" : point.id.includes("return") ? "R" : String(idx));

interface LeafletRouteMapProps {
  points: Waypoint[];
  lineCoordinates: Array<[number, number]>;
}

function LeafletRouteMap({ points, lineCoordinates }: LeafletRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || points.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.control.zoom({ zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(mapRef.current);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        className: "nhf-map-dark",
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    const latLngRoute = lineCoordinates.length > 1
      ? lineCoordinates.map(([lng, lat]) => L.latLng(lat, lng))
      : points.map((point) => L.latLng(point.lat, point.lng));

    if (latLngRoute.length > 1) {
      L.polyline(latLngRoute, {
        color: STATUS_HEX.ok, // manual: rotas em Verde Na Hora
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // O retorno cai no mesmo lugar da partida: um marcador so (nao fica um por cima do outro).
    const [start] = points;
    const isReturnOnStart = (point: Waypoint) =>
      point.id.includes("return") && !!start && point.lat === start.lat && point.lng === start.lng;
    const hasReturn = points.some(isReturnOnStart);

    points.forEach((point, idx) => {
      if (isReturnOnStart(point)) return;
      const label = stopMark(point, idx);
      const name = idx === 0 && hasReturn ? "Partida e retorno: base da empresa" : stopName(point, idx);
      const icon = L.divIcon({
        className: "route-marker",
        html: `<div class="route-marker__pin" aria-hidden="true">${label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      // Nome do marcador (dica do mouse). Fora da ordem do Tab: a lista de paradas abaixo do mapa tem o mesmo conteudo.
      L.marker([point.lat, point.lng], { icon, title: name, alt: name, keyboard: false })
        .bindPopup(`<div style="padding:10px 12px;font-size:13px;line-height:1.4"><strong>${name}</strong><br>${point.address}</div>`)
        .addTo(map);
    });

    const boundsPoints = latLngRoute.length > 0 ? latLngRoute : points.map((point) => L.latLng(point.lat, point.lng));
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28], maxZoom: 16 });

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      });
    };
  }, [lineCoordinates, points]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}

export function FreightDialog({ open, onOpenChange, selectedCount, selectedDeliveryIds, dbInvoiceIds, onConfirm, onPrint }: FreightDialogProps) {
  // NEW ORDER: fleet_type → route → freight (skip if own_fleet) → driver → preview
  const [step, setStep] = useState<StepType>("fleet_type");
  const [fleetType, setFleetType] = useState<FleetType | null>(null);
  const [freightType, setFreightType] = useState<"fixed" | "lumpsum" | "per_km">("fixed");
  const [unitValue, setUnitValue] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [perKmValue, setPerKmValue] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<ExtendedDriver | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<CompanyVehicle | null>(null);
  const [returnToBase, setReturnToBase] = useState(true);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successDriverPhone, setSuccessDriverPhone] = useState<string | null>(null);
  const [createdManifest, setCreatedManifest] = useState<DBManifest | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<ReturnType<typeof optimizeRouteNearestNeighbor> | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasCalculatedRoute, setHasCalculatedRoute] = useState(false);
  const [hasAttemptedRouteCalculation, setHasAttemptedRouteCalculation] = useState(false);
  const [routeCalculationError, setRouteCalculationError] = useState<string | null>(null);
  const [routeDistanceSource, setRouteDistanceSource] = useState<"road" | "estimated">("estimated");
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [availableVehicles, setAvailableVehicles] = useState<CompanyVehicle[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Erros de preenchimento mostrados abaixo de cada campo.
  const [errors, setErrors] = useState<Partial<Record<"fleet" | "freight" | "driver" | "vehicle", string>>>({});
  const { drivers } = useDBDrivers();
  
  // Database hook for persisting manifests
  const { createManifest: createManifestDB } = useManifestsDB();
  
  // Use tenant data from DB for base coordinates (replaces localStorage store)
  const { tenant, isLoading: tenantLoading } = useTenantData();
  
  // Use optimized distance from route calculation
  const estimatedDistance = optimizedRoute?.totalDistance || 0;

  const routeMapPoints = useMemo(
    () => optimizedRoute?.waypoints.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) ?? [],
    [optimizedRoute]
  );

  const routeMapView = useMemo(() => {
    if (routeMapPoints.length === 0) {
      return { latitude: -23.5505, longitude: -46.6333, zoom: 11 };
    }

    const bounds = routeMapPoints.reduce(
      (acc, point) => ({
        minLat: Math.min(acc.minLat, point.lat),
        maxLat: Math.max(acc.maxLat, point.lat),
        minLng: Math.min(acc.minLng, point.lng),
        maxLng: Math.max(acc.maxLng, point.lng),
      }),
      {
        minLat: routeMapPoints[0].lat,
        maxLat: routeMapPoints[0].lat,
        minLng: routeMapPoints[0].lng,
        maxLng: routeMapPoints[0].lng,
      }
    );

    const spread = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

    return {
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      zoom: spread > 0.35 ? 9 : spread > 0.18 ? 10 : spread > 0.08 ? 11 : spread > 0.035 ? 12 : 13,
    };
  }, [routeMapPoints]);

  const routeLineCoordinates = useMemo(() => {
    if (optimizedRoute?.coordinates && optimizedRoute.coordinates.length > 1) {
      return optimizedRoute.coordinates;
    }

    if (optimizedRoute?.polyline) {
      try {
        const decodedCoordinates = decodePolyline(optimizedRoute.polyline, 6);
        if (decodedCoordinates.length > 1) {
          return decodedCoordinates;
        }
      } catch (error) {
        console.warn("Failed to decode route polyline:", error);
      }
    }

    return routeMapPoints.map((point) => [point.lng, point.lat] as [number, number]);
  }, [optimizedRoute?.polyline, routeMapPoints]);

  const routeGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeLineCoordinates,
      },
    }),
    [routeLineCoordinates]
  );

  useEffect(() => {
    if (!selectedDriver) return;

    const freshDriver = drivers.find((driver) => driver.id === selectedDriver.id);
    if (!freshDriver) return;

    const hasChanged =
      freshDriver.name !== selectedDriver.name ||
      freshDriver.cpf !== selectedDriver.cpf ||
      freshDriver.vehicle_plate !== selectedDriver.vehicle_plate ||
      freshDriver.vehicle_type !== selectedDriver.vehicle_type ||
      freshDriver.cnh_category !== selectedDriver.cnh_category ||
      freshDriver.updated_at !== selectedDriver.updated_at;

    if (hasChanged) {
      setSelectedDriver(freshDriver);
    }
  }, [drivers, selectedDriver]);

  // Load available vehicles when dialog opens for own fleet
  useEffect(() => {
    if (open && fleetType === "own_fleet") {
      // Sempre do banco: romaneios finalizados liberam veiculos no servidor.
      companyVehicleStore
        .initialize()
        .then(() => setAvailableVehicles(companyVehicleStore.getAvailable()))
        .catch((error) => console.error("Error loading vehicles:", error));
    }
  }, [open, fleetType]);

  useEffect(() => {
    if (!open || mapboxToken) return;

    let isMounted = true;

    const fetchMapboxToken = async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "mapbox_token")
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("Error fetching Mapbox token:", error);
        return;
      }

      if (data?.value) {
        setMapboxToken(data.value);
      }
    };

    fetchMapboxToken();

    return () => {
      isMounted = false;
    };
  }, [open, mapboxToken]);

  const calculatedTotal = useMemo(() => {
    // Own fleet = no freight calculation
    if (fleetType === "own_fleet") return 0;
    
    switch (freightType) {
      case "fixed":
        return unitValue ? parseFloat(unitValue) * selectedCount : 0;
      case "lumpsum":
        return totalValue ? parseFloat(totalValue) : 0;
      case "per_km":
        return perKmValue && estimatedDistance ? estimatedDistance * parseFloat(perKmValue) : 0;
      default:
        return 0;
    }
  }, [fleetType, freightType, unitValue, totalValue, perKmValue, selectedCount, estimatedDistance]);

  const buildInvoiceWaypoint = async (
    invoice: {
      id: string;
      recipient_name: string | null;
      address_full: string | null;
      latitude: number | string | null;
      longitude: number | string | null;
      nfe_number: string | null;
    },
    idx: number,
  ): Promise<Waypoint | null> => {
    if (invoice.latitude && invoice.longitude) {
      return {
        id: invoice.id,
        address: invoice.address_full || `NF ${invoice.nfe_number}`,
        lat: Number(invoice.latitude),
        lng: Number(invoice.longitude),
        label: `${idx + 1}. ${invoice.recipient_name || "Entrega"}`,
      };
    }

    if (!invoice.address_full?.trim()) return null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        const fallbackCoordinates = await geocodeAddress(invoice.address_full);
        if (!fallbackCoordinates) return null;

        return {
          id: invoice.id,
          address: invoice.address_full,
          lat: fallbackCoordinates.lat,
          lng: fallbackCoordinates.lng,
          label: `${idx + 1}. ${invoice.recipient_name || "Entrega"}`,
        };
      }

      const { data, error } = await supabase.functions.invoke("geocode-address", {
        headers: { Authorization: `Bearer ${token}` },
        body: { address: invoice.address_full },
      });

      if (error || !data?.success || !data.latitude || !data.longitude) {
        console.warn("Invoice geocoding failed:", invoice.id, error || data?.error);
        const fallbackCoordinates = await geocodeAddress(invoice.address_full);
        if (!fallbackCoordinates) return null;

        return {
          id: invoice.id,
          address: invoice.address_full,
          lat: fallbackCoordinates.lat,
          lng: fallbackCoordinates.lng,
          label: `${idx + 1}. ${invoice.recipient_name || "Entrega"}`,
        };
      }

      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);

      supabase
        .from("invoices")
        .update({ latitude, longitude })
        .eq("id", invoice.id)
        .then(({ error: updateError }) => {
          if (updateError) {
            console.warn("Failed to persist invoice coordinates:", invoice.id, updateError);
          }
        });

      return {
        id: invoice.id,
        address: invoice.address_full || `NF ${invoice.nfe_number}`,
        lat: latitude,
        lng: longitude,
        label: `${idx + 1}. ${invoice.recipient_name || "Entrega"}`,
      };
    } catch (geocodeError) {
      console.warn("Unexpected invoice geocoding error:", invoice.id, geocodeError);
      return null;
    }
  };

  const getMapboxToken = async () => {
    if (mapboxToken) return mapboxToken;

    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "mapbox_token")
      .maybeSingle();

    if (error || !data?.value) {
      console.warn("Mapbox token unavailable:", error);
      return null;
    }

    setMapboxToken(data.value);
    return data.value as string;
  };

  const calculateMapboxRoadRoute = async (
    start: Waypoint,
    deliveries: Waypoint[],
    shouldReturnToBase: boolean,
  ) => {
    const token = await getMapboxToken();
    if (!token) return null;

    const buildDirectionsRoute = async (orderedDeliveries: Waypoint[]) => {
      const directionsCoordinates = shouldReturnToBase
        ? [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
        : [start, ...orderedDeliveries];

      const directionsResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${directionsCoordinates.map(toRouteCoordinate).join(";")}` +
          `?geometries=polyline6&overview=full&steps=false&access_token=${token}`,
      );

      if (!directionsResponse.ok) {
        console.warn("Mapbox directions route failed:", directionsResponse.status, await directionsResponse.text());
        return null;
      }

      const directionsData = await directionsResponse.json();
      const route = directionsData?.routes?.[0];

      if (!route?.distance || !route?.duration) return null;

      return {
        waypoints: directionsCoordinates,
        totalDistance: Math.round((Number(route.distance) / 1000) * 10) / 10,
        totalDuration: Math.round(Number(route.duration) / 60),
        polyline: typeof route.geometry === "string" ? route.geometry : undefined,
      };
    };

    if (deliveries.length === 1) {
      return buildDirectionsRoute(deliveries);
    }

    const buildOptimizedRoute = async (optimizationDeliveries: Waypoint[], finalDelivery?: Waypoint) => {
      const coordinates = finalDelivery
        ? [start, ...optimizationDeliveries.filter((delivery) => delivery.id !== finalDelivery.id), finalDelivery]
        : [start, ...optimizationDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }];

      const response = await fetch(
        `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates.map(toRouteCoordinate).join(";")}` +
          `?geometries=polyline6&overview=full&steps=false&roundtrip=false&source=first&destination=last&access_token=${token}`,
      );

      if (!response.ok) {
        console.warn("Mapbox optimization route failed:", response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const trip = data?.trips?.[0];

      if (!trip?.distance || !trip?.duration) return null;

      const orderedIndexes = (Array.isArray(data?.waypoints) ? data.waypoints : [])
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
        .map((deliveryIndex) => coordinates[deliveryIndex + 1])
        .filter((waypoint): waypoint is Waypoint => Boolean(waypoint) && !waypoint.id.includes("return"));

      const waypoints = shouldReturnToBase
        ? [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
        : [start, ...orderedDeliveries];

      return {
        waypoints,
        totalDistance: Math.round((Number(trip.distance) / 1000) * 10) / 10,
        totalDuration: Math.round(Number(trip.duration) / 60),
        polyline: typeof trip.geometry === "string" ? trip.geometry : undefined,
      };
    };

    if (!shouldReturnToBase) {
      const candidateRoutes = await Promise.all(
        deliveries.map((finalDelivery) => buildOptimizedRoute(deliveries, finalDelivery))
      );
      const bestRoute = candidateRoutes
        .filter((route): route is NonNullable<typeof route> => Boolean(route))
        .sort((a, b) => a.totalDistance - b.totalDistance)[0];

      if (bestRoute) return bestRoute;

      const estimatedOrder = optimizeRouteNearestNeighbor(start, deliveries, false).waypoints.slice(1);
      return buildDirectionsRoute(estimatedOrder);
    }

    const coordinates = shouldReturnToBase
      ? [start, ...deliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
      : [start, ...deliveries];

    const response = await fetch(
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates.map(toRouteCoordinate).join(";")}` +
        `?geometries=polyline6&overview=full&steps=false&roundtrip=false&source=first&destination=last&access_token=${token}`,
    );

    if (!response.ok) {
      console.warn("Mapbox road route failed:", response.status, await response.text());
      const estimatedOrder = optimizeRouteNearestNeighbor(start, deliveries, false).waypoints.slice(1);
      return buildDirectionsRoute(estimatedOrder);
    }

    const data = await response.json();
    const trip = data?.trips?.[0];

    if (!trip?.distance || !trip?.duration) return null;

    const optimizedDeliveryIndexes = (Array.isArray(data?.waypoints) ? data.waypoints : [])
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

    const orderedDeliveries = optimizedDeliveryIndexes
      .map((deliveryIndex) => deliveries[deliveryIndex])
      .filter(Boolean);

    if (orderedDeliveries.length === 0) {
      const estimatedOrder = optimizeRouteNearestNeighbor(start, deliveries, false).waypoints.slice(1);
      return buildDirectionsRoute(estimatedOrder);
    }

    return {
      waypoints: shouldReturnToBase
        ? [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
        : [start, ...orderedDeliveries],
      totalDistance: Math.round((Number(trip.distance) / 1000) * 10) / 10,
      totalDuration: Math.round(Number(trip.duration) / 60),
      polyline: typeof trip.geometry === "string" ? trip.geometry : undefined,
    };
  };

  const calculateOsrmRoadRoute = async (
    start: Waypoint,
    deliveries: Waypoint[],
    shouldReturnToBase: boolean,
  ) => {
    const orderedDeliveries = optimizeRouteNearestNeighbor(start, deliveries, false).waypoints.slice(1);
    const waypoints = shouldReturnToBase
      ? [start, ...orderedDeliveries, { ...start, id: `${start.id}-return`, label: "Retorno a Base" }]
      : [start, ...orderedDeliveries];

    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypoints.map(toRouteCoordinate).join(";")}` +
        "?overview=full&geometries=geojson&steps=false",
    );

    if (!response.ok) {
      console.warn("OSRM road route failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;

    if (!route?.distance || !route?.duration || !Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    return {
      waypoints,
      totalDistance: Math.round((Number(route.distance) / 1000) * 10) / 10,
      totalDuration: Math.round(Number(route.duration) / 60),
      coordinates: coordinates
        .filter((coordinate: unknown): coordinate is [number, number] =>
          Array.isArray(coordinate) &&
          coordinate.length >= 2 &&
          Number.isFinite(Number(coordinate[0])) &&
          Number.isFinite(Number(coordinate[1])),
        )
        .map((coordinate: [number, number]) => [Number(coordinate[0]), Number(coordinate[1])] as [number, number]),
    };
  };

  const calculateOptimizedRouteWithRoadDistance = async () => {
    setIsOptimizing(true);
    setRouteCalculationError(null);
    try {
      const baseLat = tenant?.latitude || -23.5505;
      const baseLng = tenant?.longitude || -46.6333;
      const baseAddress = tenant
        ? `${tenant.logradouro || ""}, ${tenant.numero || ""} - ${tenant.cidade || ""}/${tenant.uf || ""}`
        : "Base da Empresa";

      const baseWaypoint: Waypoint = {
        id: "base",
        address: baseAddress,
        lat: baseLat,
        lng: baseLng,
        label: "Base (Partida)",
      };

      if (!tenant?.latitude || !tenant?.longitude) {
        toast({
          title: "A base da empresa está sem localização",
          description: "Em Configurações > Empresa, use Obter coordenadas para definir o ponto de partida.",
          variant: "destructive",
        });
      }

      let deliveryWaypoints: Waypoint[] = [];

      if (dbInvoiceIds && dbInvoiceIds.length > 0) {
        const { data: invoices, error } = await supabase
          .from("invoices")
          .select("id, recipient_name, address_full, latitude, longitude, nfe_number")
          .in("id", dbInvoiceIds);

        if (error) {
          console.error("Error fetching invoice coords:", error);
        }

        if (invoices && invoices.length > 0) {
          const waypointResults = await Promise.all(
            invoices.map((inv, idx) => buildInvoiceWaypoint(inv, idx))
          );

          deliveryWaypoints = waypointResults.filter((waypoint): waypoint is Waypoint => Boolean(waypoint));

          const invoicesMissingGps = invoices.filter((inv) => !inv.latitude || !inv.longitude).length;
          const unresolvedCount = invoices.length - deliveryWaypoints.length;
          const geocodedCount = Math.max(0, invoicesMissingGps - unresolvedCount);
          if (geocodedCount > 0) {
            toast({
              title: `${geocodedCount} nota(s) localizada(s) pelo endereço`,
              description: "Usamos o endereço da nota para montar a rota.",
            });
          }
          if (unresolvedCount > 0) {
            toast({
              title: `${unresolvedCount} nota(s) sem local no mapa`,
              description: "Ficaram fora do cálculo porque o endereço não foi encontrado.",
            });
          }
        }
      }

      if (deliveryWaypoints.length === 0) {
        // Sem nenhuma NF localizada no mapa o romaneio ainda pode ser gerado
        // (antes o assistente travava em "Aguarde o cálculo da rota").
        setOptimizedRoute({ waypoints: [], totalDistance: 0, totalDuration: 0 });
        setRouteDistanceSource("estimated");
        setHasCalculatedRoute(true);
        toast({
          title: "Nenhuma nota foi localizada no mapa",
          description: "Dá para gerar o romaneio, mas sem distância (frete por km fica indisponível).",
          variant: "destructive",
        });
        return;
      }

      const estimatedRoute = optimizeRouteNearestNeighbor(baseWaypoint, deliveryWaypoints, returnToBase);
      let finalRoute = estimatedRoute;
      let usedRoadDistance = false;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const { data: routeData, error: routeError } = await supabase.functions.invoke("calculate-route", {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              start: baseWaypoint,
              deliveries: deliveryWaypoints,
              returnToBase,
            },
          });

          if (!routeError && routeData?.success) {
            finalRoute = {
              waypoints: Array.isArray(routeData.waypoints) && routeData.waypoints.length > 0
                ? routeData.waypoints
                : estimatedRoute.waypoints,
              totalDistance: routeData.totalDistance,
              totalDuration: routeData.totalDuration,
              polyline: routeData.polyline,
              coordinates: Array.isArray(routeData.coordinates) ? routeData.coordinates : undefined,
            };
            usedRoadDistance = true;
          } else {
            console.warn("Road route calculation fallback:", routeError || routeData?.error);
          }
        }
      } catch (roadError) {
        console.warn("Edge road route calculation failed:", roadError);
      }

      if (!usedRoadDistance) {
        try {
          const clientRoadRoute = await calculateMapboxRoadRoute(baseWaypoint, deliveryWaypoints, returnToBase);

          if (clientRoadRoute) {
            finalRoute = clientRoadRoute;
            usedRoadDistance = true;
          }
        } catch (clientRoadError) {
          console.warn("Client Mapbox road route calculation failed:", clientRoadError);
        }
      }

      if (!usedRoadDistance) {
        try {
          const osrmRoadRoute = await calculateOsrmRoadRoute(baseWaypoint, deliveryWaypoints, returnToBase);

          if (osrmRoadRoute) {
            finalRoute = osrmRoadRoute;
            usedRoadDistance = true;
          }
        } catch (osrmRoadError) {
          console.warn("OSRM road route calculation failed, using estimated route:", osrmRoadError);
        }
      }

      setRouteDistanceSource(usedRoadDistance ? "road" : "estimated");
      setOptimizedRoute(finalRoute);
      setHasCalculatedRoute(true);
      setRouteCalculationError(null);

      toast({
        title: "Rota calculada",
        description: `${finalRoute.waypoints.length} paradas, ${formatDistance(finalRoute.totalDistance)}, cerca de ${formatDuration(finalRoute.totalDuration)}${usedRoadDistance ? " (pelas ruas)" : " (estimada)"}`,
      });
    } catch (error) {
      console.error("Route optimization error:", error);
      setRouteCalculationError("Não foi possível calcular a rota. Tente recalcular ou siga sem a distância.");
      setOptimizedRoute({ waypoints: [], totalDistance: 0, totalDuration: 0 });
      setHasCalculatedRoute(true);
      toast({
        title: "Não foi possível calcular a rota",
        description: "Dá para seguir sem a distância ou tentar de novo.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Recalculate when return-to-base changes
  const handleReturnToBaseChange = (checked: boolean) => {
    setReturnToBase(checked);
    // Recalculate route with new setting
    setTimeout(() => {
      setRouteCalculationError(null);
      setHasAttemptedRouteCalculation(false);
      setHasCalculatedRoute(false);
    }, 100);
  };

  useEffect(() => {
    if (open && step === "route" && !hasCalculatedRoute && !hasAttemptedRouteCalculation && !isOptimizing && !tenantLoading) {
      setHasAttemptedRouteCalculation(true);
      calculateOptimizedRouteWithRoadDistance();
    }
  }, [hasAttemptedRouteCalculation, hasCalculatedRoute, open, isOptimizing, step, tenantLoading]);

  const handleNextStep = async () => {
    setErrors({});
    if (step === "fleet_type") {
      if (!fleetType) {
        setErrors({ fleet: "Escolha quem vai fazer a rota." });
        return;
      }
      setStep("route");
    } else if (step === "route") {
      if (!optimizedRoute) {
        toast({
          title: routeCalculationError ? "Rota indisponível" : "Aguarde o cálculo da rota",
          description: routeCalculationError || undefined,
          variant: "destructive",
        });
        return;
      }
      // If own fleet, skip freight step (go directly to driver)
      if (fleetType === "own_fleet") {
        setStep("driver");
      } else {
        setStep("freight");
      }
    } else if (step === "freight") {
      // Validate freight data
      if (freightType === "fixed" && !unitValue) {
        setErrors({ freight: "Informe o valor por entrega." });
        return;
      }
      if (freightType === "lumpsum" && !totalValue) {
        setErrors({ freight: "Informe o valor total da rota." });
        return;
      }
      if (freightType === "per_km" && !perKmValue) {
        setErrors({ freight: "Informe o valor por km." });
        return;
      }
      if (freightType === "per_km" && estimatedDistance <= 0) {
        setErrors({ freight: "A rota está sem distância calculada. Use frete fixo ou fechado." });
        return;
      }
      setStep("driver");
    } else if (step === "driver") {
      if (!selectedDriver) {
        setErrors({ driver: "Escolha o motorista da rota." });
        return;
      }
      // If own fleet has vehicles available, require one. If none exists, allow the
      // manifest to continue with only the CLT driver linked.
      if (fleetType === "own_fleet" && availableVehicles.length > 0 && !selectedVehicle) {
        setErrors({ vehicle: "Escolha o veículo da frota." });
        return;
      }
      setStep("preview");
    }
  };

  const handleBack = () => {
    setErrors({});
    if (step === "route") setStep("fleet_type");
    else if (step === "freight") setStep("route");
    else if (step === "driver") {
      // If own fleet, go back to route (skip freight)
      if (fleetType === "own_fleet") {
        setStep("route");
      } else {
        setStep("freight");
      }
    }
    else if (step === "preview") setStep("driver");
  };

  const handleConfirm = async () => {
    if (!selectedDriver || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const freightData: FreightData = {
      type: freightType,
      estimatedDistance,
      driver: selectedDriver,
      calculatedTotal,
      returnToBase,
      fleetType: fleetType || undefined,
      selectedVehicle: selectedVehicle || undefined,
      optimizedRoute: optimizedRoute ? {
        waypoints: optimizedRoute.waypoints,
        totalDistance: optimizedRoute.totalDistance,
        totalDuration: optimizedRoute.totalDuration,
      } : undefined,
    };

    // Only set freight values for third party
    if (fleetType === "third_party") {
      switch (freightType) {
        case "fixed":
          freightData.unitValue = parseFloat(unitValue);
          break;
        case "lumpsum":
          freightData.totalValue = parseFloat(totalValue);
          break;
        case "per_km":
          freightData.perKmValue = parseFloat(perKmValue);
          break;
      }
    }

    // CRITICAL: First persist to database if dbInvoiceIds are provided
    // Only proceed if database confirms success
    let dbManifest = null;
    if (dbInvoiceIds && dbInvoiceIds.length > 0) {
      const dbInput: CreateManifestInput = {
        driver_id: String(selectedDriver.id),
        driver_name: selectedDriver.name,
        driver_cpf: selectedDriver.cpf,
        vehicle_plate: selectedVehicle?.plate || selectedDriver.vehicle_plate,
        vehicle_type: selectedVehicle?.type || selectedDriver.vehicle_type,
        is_own_fleet: fleetType === "own_fleet",
        company_vehicle_id: selectedVehicle?.id,
        freight_type: fleetType === "own_fleet" ? "fixed" : freightType,
        freight_value: calculatedTotal,
        per_km_value: freightData.perKmValue,
        estimated_distance: estimatedDistance,
      };
      
      // Create manifest in database (transactional - all or nothing)
      dbManifest = await createManifestDB(dbInput, dbInvoiceIds);
      
      // VALIDATION: Only proceed if database confirmed success
      if (!dbManifest) {
        // Error toast is already shown by createManifestDB
        // Do NOT proceed - notes were NOT changed
        setIsSubmitting(false);
        return;
      }
      
      // Grava a sequencia de paradas calculada (NFs sem coordenada vao para o fim).
      const routeIds = (optimizedRoute?.waypoints || [])
        .map((waypoint) => String(waypoint.id))
        .filter((id) => dbInvoiceIds.includes(id));
      const orderedIds = [...new Set([...routeIds, ...dbInvoiceIds])];
      const { error: orderError } = await supabase.rpc("set_manifest_route_order", {
        p_manifest_id: dbManifest.id,
        p_invoice_ids: orderedIds,
      });
      if (orderError) console.warn("Nao foi possivel gravar a ordem das paradas:", orderError);

      // Use DB manifest for success dialog
      setCreatedManifest(dbManifest);
    }

    // Create local manifest for backward compatibility with onConfirm callback
    const manifest = manifestStore.add({
      driverId: selectedDriver.id as any,
      driverName: selectedDriver.name,
      driverCpf: selectedDriver.cpf,
      driverPlate: selectedVehicle?.plate || selectedDriver.vehicle_plate,
      vehicleType: selectedVehicle?.type || selectedDriver.vehicle_type as any,
      isOwnVehicle: fleetType === "own_fleet",
      vehicleId: selectedVehicle?.id,
      vehiclePlate: selectedVehicle?.plate,
      freightType: fleetType === "own_fleet" ? "fixed" : freightType,
      unitValue: freightData.unitValue,
      totalValue: freightData.totalValue,
      perKmValue: freightData.perKmValue,
      estimatedDistance,
      calculatedTotal,
      deliveriesCount: selectedCount,
      deliveryIds: selectedDeliveryIds,
    });

    // If own fleet, assign vehicle to driver
    if (fleetType === "own_fleet" && selectedVehicle) {
      companyVehicleStore.assignToDriver(selectedVehicle.id, selectedDriver.id, selectedDriver.name);
    }

    setSuccessDriverPhone(selectedDriver.phone || null);
    setShowSuccessDialog(true);
    onConfirm(freightData, manifest, dbManifest);
  };

  const handleSuccessClose = (isOpen: boolean) => {
    setShowSuccessDialog(isOpen);
    if (!isOpen) {
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setStep("fleet_type");
    setFleetType(null);
    setFreightType("fixed");
    setUnitValue("");
    setTotalValue("");
    setPerKmValue("");
    setSelectedDriver(null);
    setSelectedVehicle(null);
    setReturnToBase(true);
    setCreatedManifest(null);
    setOptimizedRoute(null);
    setHasCalculatedRoute(false);
    setHasAttemptedRouteCalculation(false);
    setRouteCalculationError(null);
    setRouteDistanceSource("estimated");
    setAvailableVehicles([]);
    setIsSubmitting(false);
    setErrors({});
  };

  // Etapas ativas (frota propria pula o frete).
  const activeSteps: StepType[] =
    fleetType === "own_fleet"
      ? ["fleet_type", "route", "driver", "preview"]
      : ["fleet_type", "route", "freight", "driver", "preview"];

  const stepNames: Record<StepType, string> = {
    fleet_type: "Frota",
    route: "Rota",
    freight: "Frete",
    driver: "Motorista",
    preview: "Revisar",
  };

  const notesLabel = selectedCount === 1 ? "1 nota" : `${selectedCount} notas`;
  const isOwnFleet = fleetType === "own_fleet";

  const stepTitles: Record<StepType, string> = {
    fleet_type: "Quem vai fazer a rota?",
    route: "Rota das entregas",
    freight: "Valor do frete",
    driver: isOwnFleet ? "Motorista e veículo" : "Motorista",
    preview: "Revisar e gerar romaneio",
  };

  const stepDescriptions: Record<StepType, string> = {
    fleet_type: `Romaneio com ${notesLabel}. Escolha o tipo de motorista.`,
    route: "Calculamos a ordem das paradas com o menor caminho a partir da base.",
    freight: `Distância da rota: ${formatDistance(estimatedDistance)}. Escolha como o motorista vai receber.`,
    driver: isOwnFleet ? "Escolha o motorista CLT e o veículo da empresa." : "Escolha quem vai fazer as entregas.",
    preview: "Confira os dados. Ao gerar, as entregas aparecem no app do motorista.",
  };

  const fleetOptions: { value: FleetType; title: string; description: string; tags: string[]; icon: typeof Users }[] = [
    {
      value: "third_party",
      title: "Terceiro / Agregado",
      description: "Motorista autônomo ou de outra empresa. Você define o frete e ele entra no acerto.",
      tags: ["Gera acerto", "Com frete"],
      icon: Users,
    },
    {
      value: "own_fleet",
      title: "Frota própria",
      description: "Motorista CLT com veículo da empresa. Não gera acerto financeiro.",
      tags: ["Sem acerto", "Veículo da empresa"],
      icon: Building2,
    },
  ];

  const roadDistance = routeDistanceSource === "road";
  const baseAddress = tenant?.logradouro && tenant?.cidade
    ? `${tenant.logradouro}, ${tenant.numero} - ${tenant.bairro}, ${tenant.cidade}/${tenant.uf}`
    : null;
  const unitTotal = unitValue ? parseFloat(unitValue) * selectedCount : 0;
  const lumpsumPerKm = totalValue && estimatedDistance > 0 ? parseFloat(totalValue) / estimatedDistance : 0;
  const perKmTotal = perKmValue && estimatedDistance > 0 ? estimatedDistance * parseFloat(perKmValue) : 0;

  const freightOptions: { value: "fixed" | "lumpsum" | "per_km"; title: string; description: string; icon: typeof Truck }[] = [
    { value: "fixed", title: "Frete fixo", description: "Um valor para cada entrega feita.", icon: Truck },
    { value: "lumpsum", title: "Frete fechado", description: "Um valor único para a rota inteira.", icon: Route },
    { value: "per_km", title: "Frete por km", description: "Valor calculado pela distância da rota.", icon: MapPin },
  ];

  const renderFreightInput = (value: "fixed" | "lumpsum" | "per_km") => {
    const config = {
      fixed: { id: "unitValue", label: "Valor por entrega (R$)", placeholder: "Ex.: 25", state: unitValue, set: setUnitValue },
      lumpsum: { id: "totalValue", label: "Valor total da rota (R$)", placeholder: "Ex.: 350", state: totalValue, set: setTotalValue },
      per_km: { id: "perKmValue", label: "Valor por km (R$)", placeholder: "Ex.: 2,50", state: perKmValue, set: setPerKmValue },
    }[value];
    const hintId = `${config.id}-hint`;
    const invalid = !!errors.freight;
    let hint: string | null = null;
    if (value === "fixed" && unitValue) hint = `Total estimado: ${formatCurrency(unitTotal)} (${notesLabel})`;
    if (value === "lumpsum" && totalValue && lumpsumPerKm > 0) hint = `Dá cerca de ${formatCurrency(lumpsumPerKm)} por km`;
    if (value === "per_km" && perKmValue && estimatedDistance > 0)
      hint = `${formatDistance(estimatedDistance)} × ${formatCurrency(parseFloat(perKmValue))} = ${formatCurrency(perKmTotal)}`;
    if (value === "per_km" && estimatedDistance <= 0) hint = "A rota está sem distância calculada. Prefira frete fixo ou fechado.";

    return (
      <div className="space-y-1.5 border-t px-4 pb-4 pt-3">
        <Label htmlFor={config.id}>{config.label}</Label>
        <Input
          id={config.id}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder={config.placeholder}
          value={config.state}
          onChange={(e) => {
            config.set(e.target.value);
            if (errors.freight) setErrors({});
          }}
          aria-invalid={invalid || undefined}
          aria-describedby={[hint ? hintId : null, invalid ? "freight-error" : null].filter(Boolean).join(" ") || undefined}
          className="font-data sm:max-w-xs"
        />
        {hint && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {invalid && (
          <p id="freight-error" className="text-sm font-medium text-destructive">
            {errors.freight}
          </p>
        )}
      </div>
    );
  };

  const summaryRows: { label: string; value: ReactNode; emphasis?: boolean }[] = selectedDriver
    ? [
        { label: "Tipo de motorista", value: isOwnFleet ? "Frota própria" : "Terceiro / agregado" },
        { label: "Notas", value: selectedCount },
        ...(!isOwnFleet ? [{ label: "Frete", value: FREIGHT_TYPE_LABELS[freightType] }] : []),
        { label: "Distância", value: formatDistance(estimatedDistance) },
        { label: "Volta à base", value: returnToBase ? "Sim" : "Não" },
        { label: "Motorista", value: selectedDriver.name },
        { label: "Veículo", value: `${vehicleTypeLabel(selectedVehicle?.type || selectedDriver.vehicle_type)} · ${selectedVehicle?.plate || selectedDriver.vehicle_plate || "sem placa"}` },
        {
          label: "Valor do frete",
          value: isOwnFleet ? "Sem acerto (frota própria)" : formatCurrency(calculatedTotal),
          emphasis: !isOwnFleet,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      {/* Com o romaneio gerado, so a janela de sucesso fica na tela. */}
      {!showSuccessDialog && (
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        <WizardSteps steps={activeSteps.map((s) => stepNames[s])} current={activeSteps.indexOf(step)} />

        <div className="min-w-0">
          {/* Etapa 1: tipo de frota */}
          {step === "fleet_type" && (
            <div className="space-y-3">
              <RadioGroup
                value={fleetType ?? ""}
                onValueChange={(value) => {
                  setFleetType(value as FleetType);
                  setErrors({});
                }}
                aria-label="Tipo de motorista"
                aria-describedby={errors.fleet ? "fleet-error" : undefined}
                className="gap-3"
              >
                {fleetOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = fleetType === option.value;
                  return (
                    <Label
                      key={option.value}
                      htmlFor={`fleet-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-colors duration",
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration",
                          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block font-heading text-base font-semibold text-foreground">{option.title}</span>
                        <span className="block text-sm font-normal leading-snug text-muted-foreground">{option.description}</span>
                        <span className="flex flex-wrap gap-1.5 pt-1">
                          {option.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      </span>
                      <RadioGroupItem id={`fleet-${option.value}`} value={option.value} className="mt-1" />
                    </Label>
                  );
                })}
              </RadioGroup>
              {errors.fleet && (
                <p id="fleet-error" className="text-sm font-medium text-destructive">
                  {errors.fleet}
                </p>
              )}
            </div>
          )}

          {/* Etapa 2: rota */}
          {step === "route" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Ponto de partida</p>
                  {baseAddress ? (
                    <p className="break-words text-sm text-muted-foreground">{baseAddress}</p>
                  ) : tenantLoading ? (
                    <Skeleton className="mt-1 h-4 w-48" />
                  ) : (
                    <p className="break-words text-sm text-destructive">
                      Endereço da empresa incompleto. Preencha em Configurações &gt; Empresa.
                    </p>
                  )}
                </div>
                {tenant?.latitude && tenant?.longitude && <StatusBadge tone="success">GPS ok</StatusBadge>}
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="returnToBase">Voltar para a base no fim</Label>
                  <p id="returnToBase-hint" className="text-sm text-muted-foreground">
                    {returnToBase
                      ? "A rota termina de volta no endereço da empresa."
                      : "A rota termina no endereço da última entrega."}
                  </p>
                </div>
                <Switch
                  id="returnToBase"
                  checked={returnToBase}
                  onCheckedChange={(checked) => handleReturnToBaseChange(checked)}
                  aria-describedby="returnToBase-hint"
                />
              </div>

              {isOptimizing ? (
                <div role="status" aria-label="Calculando a rota" className="space-y-3 rounded-lg border p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                  <Skeleton className="h-56 w-full" />
                  <p className="text-center text-sm text-muted-foreground">Calculando a melhor rota…</p>
                </div>
              ) : routeCalculationError ? (
                <Alert variant="destructive">
                  <AlertTriangle aria-hidden="true" />
                  <AlertDescription className="text-foreground">
                    <span className="font-semibold">Não foi possível montar a rota.</span> {routeCalculationError}
                  </AlertDescription>
                </Alert>
              ) : optimizedRoute && (
                <section aria-labelledby="route-summary-title" className="min-w-0 space-y-4 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="route-summary-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Route className="h-4 w-4 text-primary" aria-hidden="true" />
                      Rota sugerida
                    </h3>
                    <StatusBadge tone={roadDistance ? "success" : "neutral"}>
                      {roadDistance ? "Distância pelas ruas" : "Distância estimada"}
                    </StatusBadge>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-lg bg-muted/60 p-3">
                      <dt className="text-xs text-muted-foreground">Paradas</dt>
                      <dd className="whitespace-nowrap font-data text-base font-semibold text-foreground sm:text-lg">{optimizedRoute.waypoints.length}</dd>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <dt className="text-xs text-muted-foreground">Distância</dt>
                      <dd className="whitespace-nowrap font-data text-base font-semibold text-primary sm:text-lg">{formatDistance(optimizedRoute.totalDistance)}</dd>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3">
                      <dt className="text-xs text-muted-foreground">Tempo</dt>
                      <dd className="whitespace-nowrap font-data text-base font-semibold text-foreground sm:text-lg">{formatDuration(optimizedRoute.totalDuration)}</dd>
                    </div>
                  </dl>

                  <div role="region" aria-label="Mapa da rota" className="h-64 w-full overflow-hidden rounded-lg border bg-muted/40">
                    {mapboxToken && routeMapPoints.length > 0 ? (
                      <Map
                        initialViewState={routeMapView}
                        mapStyle="mapbox://styles/mapbox/streets-v12"
                        mapboxAccessToken={mapboxToken}
                        style={{ width: "100%", height: "100%" }}
                        scrollZoom={false}
                        dragRotate={false}
                      >
                        {routeLineCoordinates.length > 1 && (
                          <Source id="optimized-route" type="geojson" data={routeGeoJson}>
                            <Layer {...routeLineLayer} />
                          </Source>
                        )}

                        {routeMapPoints.map((point, idx) => idx > 0 && point.id.includes("return") && point.lat === routeMapPoints[0].lat && point.lng === routeMapPoints[0].lng ? null : (
                          <Marker key={`${point.id}-${idx}`} longitude={point.lng} latitude={point.lat} anchor="center">
                            <div
                              role="img"
                              aria-label={stopName(point, idx)}
                              title={stopName(point, idx)}
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-md"
                            >
                              {stopMark(point, idx)}
                            </div>
                          </Marker>
                        ))}
                      </Map>
                    ) : routeMapPoints.length > 0 ? (
                      <LeafletRouteMap points={routeMapPoints} lineCoordinates={routeLineCoordinates} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                        <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                        <p className="max-w-xs text-sm text-muted-foreground">
                          Nenhuma nota tem endereço localizado no mapa. Dá para gerar o romaneio sem a distância.
                        </p>
                      </div>
                    )}
                  </div>

                  {optimizedRoute.waypoints.length > 0 && (
                    <ol aria-label="Ordem das paradas" className="space-y-1">
                      {optimizedRoute.waypoints.map((waypoint, idx) => {
                        const isEdge = idx === 0 || waypoint.id.includes("return");
                        return (
                          <li key={`${waypoint.id}-${idx}`} className="flex min-w-0 items-start gap-3 rounded-md p-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-data text-xs font-bold",
                                isEdge ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                              )}
                            >
                              {stopMark(waypoint, idx)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium leading-snug text-foreground">{stopName(waypoint, idx)}</p>
                              <p className="break-words text-xs text-muted-foreground">{readableAddress(waypoint.address)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setHasAttemptedRouteCalculation(false);
                  setHasCalculatedRoute(false);
                }}
                disabled={isOptimizing}
                className="w-full"
              >
                <RefreshCw aria-hidden="true" />
                Recalcular rota
              </Button>
            </div>
          )}

          {/* Etapa 3: frete (so terceiro/agregado) */}
          {step === "freight" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Distância da rota</p>
                  <p className="font-data text-xl font-semibold text-primary">{formatDistance(estimatedDistance)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{returnToBase ? "Com volta à base" : "Sem volta à base"}</Badge>
                  <Badge variant="secondary">{roadDistance ? "Pelas ruas" : "Estimada"}</Badge>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium text-foreground">Como pagar o frete</legend>
                <RadioGroup
                  value={freightType}
                  onValueChange={(v) => {
                    setFreightType(v as typeof freightType);
                    setErrors({});
                  }}
                  className="gap-3"
                >
                  {freightOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = freightType === option.value;
                    return (
                      <div
                        key={option.value}
                        className={cn(
                          "rounded-lg border transition-colors duration",
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/20",
                        )}
                      >
                        <Label htmlFor={`freight-${option.value}`} className="flex cursor-pointer items-start gap-3 p-4">
                          <RadioGroupItem id={`freight-${option.value}`} value={option.value} className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 font-semibold text-foreground">
                              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                              {option.title}
                            </span>
                            <span className="mt-0.5 block font-normal text-muted-foreground">{option.description}</span>
                          </span>
                        </Label>
                        {selected && renderFreightInput(option.value)}
                      </div>
                    );
                  })}
                </RadioGroup>
              </fieldset>
            </div>
          )}

          {/* Etapa 4: motorista (e veiculo da frota propria) */}
          {step === "driver" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="freight-driver">{isOwnFleet ? "Motorista CLT" : "Motorista responsável"}</Label>
                <DriverCombobox
                  id="freight-driver"
                  value={selectedDriver}
                  onSelect={(driver) => {
                    setSelectedDriver(driver);
                    setErrors({});
                  }}
                  fleetType={fleetType || undefined}
                  invalid={!!errors.driver}
                  describedBy={errors.driver ? "freight-driver-error" : undefined}
                />
                {errors.driver && (
                  <p id="freight-driver-error" className="text-sm font-medium text-destructive">
                    {errors.driver}
                  </p>
                )}
              </div>

              {isOwnFleet && (
                <div className="space-y-2">
                  <Label htmlFor="freight-vehicle">Veículo da frota</Label>
                  <Select
                    value={selectedVehicle?.id || ""}
                    onValueChange={(value) => {
                      const vehicle = availableVehicles.find(v => v.id === value);
                      setSelectedVehicle(vehicle || null);
                      setErrors({});
                    }}
                  >
                    <SelectTrigger
                      id="freight-vehicle"
                      aria-invalid={!!errors.vehicle || undefined}
                      aria-describedby={errors.vehicle ? "freight-vehicle-error" : availableVehicles.length === 0 ? "freight-vehicle-hint" : undefined}
                      className={cn(errors.vehicle && "border-destructive")}
                    >
                      <SelectValue placeholder="Escolher veículo livre" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          Nenhum veículo livre
                        </div>
                      ) : (
                        availableVehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            <span className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              <span className="font-data font-medium">{vehicle.plate}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>{vehicle.brand} {vehicle.model}</span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableVehicles.length === 0 && (
                    <p id="freight-vehicle-hint" className="text-sm text-muted-foreground">
                      Nenhum veículo livre. Cadastre em Veículos ou siga só com o motorista.
                    </p>
                  )}
                  {errors.vehicle && (
                    <p id="freight-vehicle-error" className="text-sm font-medium text-destructive">
                      {errors.vehicle}
                    </p>
                  )}
                </div>
              )}

              {selectedDriver && (
                <div className="flex min-w-0 items-start gap-4 rounded-lg border bg-muted/40 p-4 animate-fade-in">
                  <DriverAvatar driver={selectedDriver} className="h-12 w-12" textClassName="text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold leading-tight text-foreground">{selectedDriver.name}</p>
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="inline text-muted-foreground">CPF: </dt>
                        <dd className="inline break-all font-data text-foreground">{selectedDriver.cpf || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-muted-foreground">CNH: </dt>
                        <dd className="inline text-foreground">{selectedDriver.cnh_category || "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-muted-foreground">Veículo: </dt>
                        <dd className="inline text-foreground">{vehicleTypeLabel(selectedDriver.vehicle_type)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="inline text-muted-foreground">Placa: </dt>
                        <dd className="inline break-all font-data text-foreground">{selectedVehicle?.plate || selectedDriver.vehicle_plate || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {isOwnFleet && selectedVehicle && (
                <div className="flex min-w-0 items-start gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 animate-fade-in">
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Car className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-foreground">{selectedVehicle.brand} {selectedVehicle.model}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-data font-medium text-foreground">{selectedVehicle.plate}</span>
                      <Badge variant="secondary">{selectedVehicle.type}</Badge>
                      {selectedVehicle.capacity && <span>{selectedVehicle.capacity}</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etapa 5: revisar */}
          {step === "preview" && selectedDriver && (
            <div className="space-y-4">
              <section aria-labelledby="freight-summary-title" className="overflow-hidden rounded-lg border">
                <h3 id="freight-summary-title" className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground">
                  Resumo do romaneio
                </h3>
                <dl className="divide-y">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd
                        className={cn(
                          "min-w-0 break-words text-right text-sm font-medium text-foreground",
                          row.emphasis && "font-data text-lg font-semibold text-primary",
                        )}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {isOwnFleet && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Romaneio de frota própria não gera acerto financeiro.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "fleet_type" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={handleBack}>
              Voltar
            </Button>
          )}
          {step !== "preview" ? (
            <Button type="button" onClick={handleNextStep} disabled={step === "route" && isOptimizing}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Gerando romaneio…
                </>
              ) : (
                <>
                  <Check aria-hidden="true" />
                  Confirmar e gerar romaneio
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      )}

      {/* Success Dialog */}
      <ManifestSuccessDialog
        open={showSuccessDialog}
        onOpenChange={handleSuccessClose}
        manifest={createdManifest}
        driverPhone={successDriverPhone}
        onPrint={
          onPrint
            ? () => {
                handleSuccessClose(false);
                onPrint();
              }
            : undefined
        }
      />
    </Dialog>
  );
}

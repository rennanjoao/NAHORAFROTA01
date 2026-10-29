import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Calculator, Truck, Route, MapPin, User, FileText, Building2, Home, Navigation, Clock, Users, Car } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { DriverCombobox, ExtendedDriver } from "./DriverCombobox";
import { ManifestSuccessDialog } from "./ManifestSuccessDialog";
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

const vehicleTypeLabels: Record<string, string> = {
  truck: "Caminhão",
  van: "VUC/Van",
  moto: "Moto",
  fiorino: "Fiorino",
  vuc: "VUC",
  toco: "Toco",
  carreta: "Carreta",
};

const routeLineLayer: LayerProps = {
  id: "optimized-route-line",
  type: "line",
  paint: {
    "line-color": "#04E8A4", // manual: rotas em Verde Na Hora
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
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

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
        color: "#04E8A4", // manual: rotas em Verde Na Hora
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    points.forEach((point, idx) => {
      const label = idx === 0 ? "P" : point.id.includes("return") ? "R" : String(idx);
      const icon = L.divIcon({
        className: "route-marker",
        html: `<div class="route-marker__pin">${label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker([point.lat, point.lng], { icon })
        .bindPopup(`<strong>${point.label || label}</strong><br>${point.address}`)
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

  // iOS Fix: Bloquear scroll do body quando dialog abre
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.classList.add('dialog-open');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      document.body.classList.remove('dialog-open');
      document.body.style.top = '';
    };
  }, [open]);

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

  // Calculate optimized route using REAL data from tenant + invoices
  const calculateOptimizedRoute = async () => {
    setIsOptimizing(true);
    try {
      // Use tenant coordinates from database
      const baseLat = tenant?.latitude || -23.5505;
      const baseLng = tenant?.longitude || -46.6333;
      const baseAddress = tenant
        ? `${tenant.logradouro || ''}, ${tenant.numero || ''} - ${tenant.cidade || ''}/${tenant.uf || ''}`
        : 'Base da Empresa';
      
      const baseWaypoint: Waypoint = {
        id: 'base',
        address: baseAddress,
        lat: baseLat,
        lng: baseLng,
        label: 'Base (Partida)'
      };

      if (!tenant?.latitude || !tenant?.longitude) {
        toast({
          title: "Coordenadas da Base não definidas",
          description: "Vá em Configurações > Dados da Empresa e clique em 'Obter Coordenadas' para definir o ponto de partida.",
          variant: "destructive",
        });
      }
      
      // Fetch REAL invoice coordinates from database
      let deliveryWaypoints: Waypoint[] = [];
      
      if (dbInvoiceIds && dbInvoiceIds.length > 0) {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('id, recipient_name, address_full, latitude, longitude, nfe_number')
          .in('id', dbInvoiceIds);
        
        if (error) {
          console.error("Error fetching invoice coords:", error);
        }
        
        if (invoices && invoices.length > 0) {
          deliveryWaypoints = invoices
            .filter(inv => inv.latitude && inv.longitude)
            .map((inv, idx) => ({
              id: inv.id,
              address: inv.address_full || `NF ${inv.nfe_number}`,
              lat: Number(inv.latitude),
              lng: Number(inv.longitude),
              label: `${idx + 1}. ${inv.recipient_name || 'Entrega'}`
            }));
          
          const withoutCoords = invoices.filter(inv => !inv.latitude || !inv.longitude);
          if (withoutCoords.length > 0) {
            toast({
              title: `${withoutCoords.length} NF(s) sem coordenadas`,
              description: "Essas notas não foram incluídas no cálculo de distância. Geocodifique-as para maior precisão.",
            });
          }
        }
      }
      
      if (deliveryWaypoints.length === 0) {
        setRouteCalculationError("Nenhuma nota fiscal selecionada possui coordenadas GPS válidas para calcular a rota.");
        toast({
          title: "Sem coordenadas para calcular",
          description: "Nenhuma nota fiscal possui coordenadas GPS. Importe XMLs com endereço válido.",
          variant: "destructive",
        });
        setIsOptimizing(false);
        return;
      }
      
      // Optimize route with REAL coordinates
      const route = optimizeRouteNearestNeighbor(baseWaypoint, deliveryWaypoints, returnToBase);
      setOptimizedRoute(route);
      setHasCalculatedRoute(true);
      
      toast({
        title: "Rota Calculada",
        description: `${route.waypoints.length} paradas, ${formatDistance(route.totalDistance)}, ~${formatDuration(route.totalDuration)}`,
      });
    } catch (error) {
      console.error("Route optimization error:", error);
      setRouteCalculationError("Não foi possível calcular a rota com os dados atuais.");
      toast({
        title: "Erro na Otimização",
        description: "Não foi possível calcular a rota.",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
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
          title: "Base sem coordenadas",
          description: "Vá em Configurações > Dados da Empresa e clique em 'Obter Coordenadas'.",
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
              title: `${geocodedCount} NF(s) geocodificada(s)`,
              description: "Usamos o endereço da nota para montar a rota.",
            });
          }
          if (unresolvedCount > 0) {
            toast({
              title: `${unresolvedCount} NF(s) sem coordenadas`,
              description: "Essas notas ficaram fora do cálculo porque o endereço não pode ser geocodificado.",
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
          title: "Rota sem coordenadas",
          description: "Nenhuma NF pôde ser localizada no mapa. Dá para gerar o romaneio, mas sem distância (frete por KM indisponível).",
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
        title: "Rota Calculada",
        description: `${finalRoute.waypoints.length} paradas, ${formatDistance(finalRoute.totalDistance)}, ~${formatDuration(finalRoute.totalDuration)}${usedRoadDistance ? " (malha viária)" : " (estimativa)"}`,
      });
    } catch (error) {
      console.error("Route optimization error:", error);
      setRouteCalculationError("Não foi possível calcular a rota. Tente recalcular ou siga sem a distância.");
      setOptimizedRoute({ waypoints: [], totalDistance: 0, totalDuration: 0 });
      setHasCalculatedRoute(true);
      toast({
        title: "Erro na roteirização",
        description: "Não foi possível calcular a rota. Dá para seguir sem a distância.",
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
    if (step === "fleet_type") {
      if (!fleetType) {
        toast({ title: "Selecione o tipo de frota", variant: "destructive" });
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
        toast({ title: "Informe o valor unitário", variant: "destructive" });
        return;
      }
      if (freightType === "lumpsum" && !totalValue) {
        toast({ title: "Informe o valor total da rota", variant: "destructive" });
        return;
      }
      if (freightType === "per_km" && !perKmValue) {
        toast({ title: "Informe o valor por KM", variant: "destructive" });
        return;
      }
      if (freightType === "per_km" && estimatedDistance <= 0) {
        toast({
          title: "Distância indisponível",
          description: "A rota não tem distância calculada. Use frete fixo por NF ou valor fechado.",
          variant: "destructive",
        });
        return;
      }
      setStep("driver");
    } else if (step === "driver") {
      if (!selectedDriver) {
        toast({ title: "Selecione um motorista", variant: "destructive" });
        return;
      }
      // If own fleet has vehicles available, require one. If none exists, allow the
      // manifest to continue with only the CLT driver linked.
      if (fleetType === "own_fleet" && availableVehicles.length > 0 && !selectedVehicle) {
        toast({ title: "Selecione um veículo da frota", variant: "destructive" });
        return;
      }
      setStep("preview");
    }
  };

  const handleBack = () => {
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
  };

  const freightTypeLabels = {
    fixed: "Frete Fixo",
    lumpsum: "Frete Fechado",
    per_km: "Frete por KM",
  };

  const stepLabels: Record<StepType, string> = {
    fleet_type: "Tipo de Frota",
    route: "Roteirização",
    freight: "Frete",
    driver: "Motorista",
    preview: "Confirmar"
  };

  // Get steps based on fleet type (skip freight for own_fleet)
  const getActiveSteps = (): StepType[] => {
    if (fleetType === "own_fleet") {
      return ["fleet_type", "route", "driver", "preview"];
    }
    return ["fleet_type", "route", "freight", "driver", "preview"];
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent 
        className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-8 leading-tight">
            {step === "fleet_type" && <Truck className="h-5 w-5 text-primary" />}
            {step === "route" && <Navigation className="h-5 w-5 text-primary" />}
            {step === "freight" && <Calculator className="h-5 w-5 text-primary" />}
            {step === "driver" && <User className="h-5 w-5 text-primary" />}
            {step === "preview" && <FileText className="h-5 w-5 text-primary" />}
            {step === "fleet_type" && "Tipo de Frota"}
            {step === "route" && "Roteirização Inteligente"}
            {step === "freight" && "Definição de Frete"}
            {step === "driver" && (fleetType === "own_fleet" ? "Motorista e Veículo" : "Selecionar Motorista")}
            {step === "preview" && "Confirmar Romaneio"}
          </DialogTitle>
          <DialogDescription>
            {step === "fleet_type" && "Selecione se a rota será realizada por frota própria ou terceirizada."}
            {step === "route" && `Configure a rota otimizada para ${selectedCount} ${selectedCount === 1 ? "entrega" : "entregas"}.`}
            {step === "freight" && `Defina o frete com base na distância calculada: ${formatDistance(estimatedDistance)}`}
            {step === "driver" && (fleetType === "own_fleet" 
              ? "Selecione o motorista CLT e o veículo da frota." 
              : "Escolha o motorista responsável pela rota.")}
            {step === "preview" && "Revise os dados antes de gerar o romaneio."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {getActiveSteps().map((s, idx, arr) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${step === s ? "bg-primary" : "bg-muted"}`} />
              {idx < arr.length - 1 && <div className="w-6 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        <div className="min-w-0 py-4">
          {/* Step 1: Fleet Type Selection (NEW FIRST STEP) */}
          {step === "fleet_type" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Escolha como a rota será executada
              </p>
              
              <div className="grid gap-4">
                {/* Third Party / Agregado Card */}
                <Card 
                  className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                    fleetType === "third_party" 
                      ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-2 border-border"
                  }`}
                  onClick={() => setFleetType("third_party")}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${fleetType === "third_party" ? "bg-primary/10" : "bg-muted"}`}>
                      <Users className={`h-6 w-6 ${fleetType === "third_party" ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">Terceiro / Agregado</h3>
                      <p className="text-sm text-muted-foreground">
                        Motorista autônomo ou de terceiros
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">Gera Acerto</Badge>
                        <Badge variant="outline" className="text-xs">Define Frete</Badge>
                      </div>
                    </div>
                    {fleetType === "third_party" && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Own Fleet / Frota Própria Card */}
                <Card 
                  className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                    fleetType === "own_fleet" 
                      ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-2 border-border"
                  }`}
                  onClick={() => setFleetType("own_fleet")}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${fleetType === "own_fleet" ? "bg-primary/10" : "bg-muted"}`}>
                      <Building2 className={`h-6 w-6 ${fleetType === "own_fleet" ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">Frota Própria</h3>
                      <p className="text-sm text-muted-foreground">
                        Motorista CLT + veículo da empresa
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">Sem Acerto</Badge>
                        <Badge variant="secondary" className="text-xs">Veículo Próprio</Badge>
                      </div>
                    </div>
                    {fleetType === "own_fleet" && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {fleetType === "own_fleet" && (
                <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Frota própria não gera acerto financeiro. Etapa de frete será pulada.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Route Optimization */}
          {step === "route" && (
            <div className="space-y-4">
              {/* Company Base Info */}
              <Card className="min-w-0 p-4 border-2 border-primary bg-primary/5">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 p-2 rounded-lg bg-primary/10">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">PONTO DE PARTIDA (BASE)</p>
                    {tenant?.logradouro && tenant?.cidade ? (
                      <p className="text-xs text-muted-foreground break-words leading-relaxed">
                        {tenant.logradouro}, {tenant.numero} - {tenant.bairro}, {tenant.cidade}/{tenant.uf}
                        {tenant.latitude && tenant.longitude && (
                          <span className="ml-1 inline-block text-success">✓ GPS</span>
                        )}
                      </p>
                    ) : tenantLoading ? (
                      <p className="text-xs text-muted-foreground animate-pulse">
                        Carregando dados da empresa...
                      </p>
                    ) : (
                      <p className="text-xs text-destructive break-words leading-relaxed">
                        Endereço incompleto. Preencha em Configurações → Empresa
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Return to Base Option */}
              <Card className={`min-w-0 p-4 border-2 transition-colors ${returnToBase ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-start gap-4">
                  <Checkbox
                    id="returnToBase"
                    checked={returnToBase}
                    onCheckedChange={(checked) => handleReturnToBaseChange(checked as boolean)}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="returnToBase" className="font-semibold text-sm cursor-pointer">
                      Retornar para a Base
                    </label>
                    <p className="text-xs text-muted-foreground break-words leading-relaxed">
                      {returnToBase 
                        ? "O trajeto incluirá o retorno ao endereço da empresa após a última entrega"
                        : "O trajeto terminará no endereço da última entrega"}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Optimized Route Display */}
              {isOptimizing ? (
                <Card className="p-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    <p className="text-sm text-muted-foreground">Calculando rota otimizada...</p>
                  </div>
                </Card>
              ) : routeCalculationError ? (
                <Card className="p-4 border-destructive/30 bg-destructive/5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Não foi possível montar a rota</p>
                    <p className="text-sm text-muted-foreground">{routeCalculationError}</p>
                  </div>
                </Card>
              ) : optimizedRoute && (
                <Card className="min-w-0 p-4">
                  <h4 className="font-semibold mb-3 flex flex-wrap items-center gap-2">
                    <Route className="h-4 w-4 shrink-0 text-primary" />
                    Rota Otimizada
                    <Badge variant={routeDistanceSource === "road" ? "default" : "outline"} className="shrink-0 text-[10px] sm:ml-auto">
                      {routeDistanceSource === "road" ? "km viário" : "estimativa"}
                    </Badge>
                  </h4>
                  
                  {/* Route Stats - Highlighted for pricing decision */}
                  <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-3">
                    <div className="min-w-0 text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Paradas</p>
                      <p className="font-bold text-primary break-words">{optimizedRoute.waypoints.length}</p>
                    </div>
                    <div className="min-w-0 text-center p-3 rounded-lg bg-primary/10 border-2 border-primary">
                      <p className="text-xs text-muted-foreground">Distância Total</p>
                      <p className="font-bold text-lg text-primary break-words">{formatDistance(optimizedRoute.totalDistance)}</p>
                    </div>
                    <div className="min-w-0 text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Tempo Est.</p>
                      <p className="font-bold text-primary break-words">{formatDuration(optimizedRoute.totalDuration)}</p>
                    </div>
                  </div>

                  <div className="mb-4 overflow-hidden rounded-lg border bg-muted/20">
                    <div className="h-64 w-full">
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

                          {routeMapPoints.map((point, idx) => (
                            <Marker
                              key={`${point.id}-${idx}`}
                              longitude={point.lng}
                              latitude={point.lat}
                              anchor="center"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground shadow-md">
                                {idx === 0 ? "P" : point.id.includes("return") ? "R" : idx}
                              </div>
                            </Marker>
                          ))}
                        </Map>
                      ) : routeMapPoints.length > 0 ? (
                        <LeafletRouteMap points={routeMapPoints} lineCoordinates={routeLineCoordinates} />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted/40 p-4">
                          <div className="flex w-full max-w-md items-center justify-between gap-2">
                            {routeMapPoints.map((point, idx) => (
                              <div key={`${point.id}-fallback-${idx}`} className="flex flex-1 items-center last:flex-none">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                  {idx === 0 ? "P" : point.id.includes("return") ? "R" : idx}
                                </div>
                                {idx < routeMapPoints.length - 1 && (
                                  <div className="h-1 flex-1 bg-primary/60" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Waypoints List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {optimizedRoute.waypoints.map((waypoint, idx) => (
                      <div key={waypoint.id} className="flex min-w-0 items-start gap-3 p-2 rounded-lg bg-muted/30">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? "bg-primary text-primary-foreground" : 
                          waypoint.id.includes('return') ? "bg-primary text-primary-foreground" :
                          "bg-muted-foreground/20 text-muted-foreground"
                        } shrink-0`}>
                          {idx === 0 ? "P" : waypoint.id.includes('return') ? "R" : idx}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words leading-snug">{waypoint.label || `Entrega ${idx}`}</p>
                          <p className="text-xs text-muted-foreground break-words leading-relaxed">{waypoint.address}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recalculate Button */}
              <Button 
                variant="outline" 
                onClick={() => {
                  setHasAttemptedRouteCalculation(false);
                  setHasCalculatedRoute(false);
                }}
                disabled={isOptimizing}
                className="w-full h-auto min-h-10 gap-2 whitespace-normal text-center"
              >
                <Navigation className="h-4 w-4" />
                Recalcular Rota {returnToBase ? "com Retorno" : "sem Retorno"}
              </Button>
            </div>
          )}

          {/* Step 3: Freight Type (ONLY for third_party) */}
          {step === "freight" && (
            <div className="space-y-6">
              {/* Route Info - Now shows REAL calculated distance */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border-2 border-primary">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Distância Calculada da Rota</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-primary">{formatDistance(estimatedDistance)}</p>
                    <Badge variant="outline" className="text-xs">
                      {returnToBase ? "com retorno" : "sem retorno"}
                    </Badge>
                    <Badge variant={routeDistanceSource === "road" ? "default" : "outline"} className="text-xs">
                      {routeDistanceSource === "road" ? "malha viária" : "estimativa"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Freight Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de Frete</Label>
                <RadioGroup value={freightType} onValueChange={(v) => setFreightType(v as typeof freightType)}>
                  <div className="grid gap-3">
                    {/* Option A: Fixed */}
                    <label 
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        freightType === "fixed" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="fixed" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          <span className="font-medium">Frete Fixo</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Valor fixo por entrega realizada
                        </p>
                        {freightType === "fixed" && (
                          <div className="mt-3">
                            <Label htmlFor="unitValue" className="text-xs text-muted-foreground">Valor Unitário (R$)</Label>
                            <Input
                              id="unitValue"
                              type="number"
                              placeholder="Ex: 25.00"
                              value={unitValue}
                              onChange={(e) => setUnitValue(e.target.value)}
                              className="mt-1"
                            />
                            {unitValue && (
                              <p className="text-xs text-primary mt-2">
                                Total estimado: {formatCurrency(parseFloat(unitValue) * selectedCount)} ({selectedCount} entregas)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Option B: Lumpsum */}
                    <label 
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        freightType === "lumpsum" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="lumpsum" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4 text-primary" />
                          <span className="font-medium">Frete Fechado</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Valor único para toda a rota (lump sum)
                        </p>
                        {freightType === "lumpsum" && (
                          <div className="mt-3">
                            <Label htmlFor="totalValue" className="text-xs text-muted-foreground">Valor Total da Rota (R$)</Label>
                            <Input
                              id="totalValue"
                              type="number"
                              placeholder="Ex: 350.00"
                              value={totalValue}
                              onChange={(e) => setTotalValue(e.target.value)}
                              className="mt-1"
                            />
                            {totalValue && (
                              <p className="text-xs text-muted-foreground mt-2">
                                ≈ {formatCurrency(parseFloat(totalValue) / estimatedDistance)}/km
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Option C: Per KM */}
                    <label 
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        freightType === "per_km" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="per_km" className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">Frete por KM</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Valor calculado pela distância percorrida
                        </p>
                        {freightType === "per_km" && (
                          <div className="mt-3 space-y-2">
                            <Label htmlFor="perKmValue" className="text-xs text-muted-foreground">Valor por KM (R$)</Label>
                            <Input
                              id="perKmValue"
                              type="number"
                              placeholder="Ex: 2.50"
                              value={perKmValue}
                              onChange={(e) => setPerKmValue(e.target.value)}
                              className="mt-1"
                            />
                            {perKmValue && estimatedDistance > 0 && (
                              <div className="p-2 rounded bg-primary/10 border border-primary/20 mt-2">
                                <p className="text-xs text-muted-foreground">Cálculo:</p>
                                <p className="text-sm font-medium">
                                  {formatDistance(estimatedDistance)} × {formatCurrency(parseFloat(perKmValue))} = 
                                  <span className="text-primary font-bold ml-1">{formatCurrency(estimatedDistance * parseFloat(perKmValue))}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 4: Driver Selection (and Vehicle for own_fleet) */}
          {step === "driver" && (
            <div className="space-y-4">
              {/* Fleet type badge */}
              <div className="flex justify-center">
                <Badge variant={fleetType === "own_fleet" ? "default" : "outline"} className="text-sm">
                  {fleetType === "own_fleet" ? "Frota Própria" : "Terceiro / Agregado"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>{fleetType === "own_fleet" ? "Motorista CLT" : "Motorista Responsável"}</Label>
                <DriverCombobox 
                  value={selectedDriver} 
                  onSelect={setSelectedDriver}
                  fleetType={fleetType || undefined}
                />
              </div>

              {/* Vehicle Selection (only for own_fleet) */}
              {fleetType === "own_fleet" && (
                <div className="space-y-2">
                  <Label>Veículo da Frota</Label>
                  <Select 
                    value={selectedVehicle?.id || ""} 
                    onValueChange={(value) => {
                      const vehicle = availableVehicles.find(v => v.id === value);
                      setSelectedVehicle(vehicle || null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um veículo disponível..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground text-sm">
                          Nenhum veículo disponível
                        </div>
                      ) : (
                        availableVehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono font-medium">{vehicle.plate}</span>
                              <span className="text-muted-foreground">•</span>
                              <span>{vehicle.brand} {vehicle.model}</span>
                              <Badge variant="outline" className="text-xs ml-2">{vehicle.type}</Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableVehicles.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre veículos em Veículos → Adicionar Veículo
                    </p>
                  )}
                </div>
              )}

              {selectedDriver && (
                <Card className="p-4 bg-muted/30 overflow-hidden">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary-foreground">{selectedDriver.avatar}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold break-words leading-tight">{selectedDriver.name}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-4 mt-2 text-sm text-muted-foreground min-w-0">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">CPF:</span>{" "}
                          <span className="font-mono break-all">{selectedDriver.cpf}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">CNH:</span>{" "}
                          <span className="break-words">{selectedDriver.cnh_category}</span>
                        </div>
                        <span>Veículo: {vehicleTypeLabels[selectedDriver.vehicle_type] || selectedDriver.vehicle_type}</span>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">Placa:</span>{" "}
                          <span className="font-mono break-all">{selectedVehicle?.plate || selectedDriver.vehicle_plate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Selected Vehicle Info (for own_fleet) */}
              {fleetType === "own_fleet" && selectedVehicle && (
                <Card className="p-4 border-2 border-primary bg-primary/5 overflow-hidden">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0 w-fit">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold break-words">{selectedVehicle.brand} {selectedVehicle.model}</p>
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 mt-1 text-sm text-muted-foreground min-w-0">
                        <span className="font-mono font-medium break-all">{selectedVehicle.plate}</span>
                        <Badge variant="outline">{selectedVehicle.type}</Badge>
                        {selectedVehicle.capacity && <span className="break-words">{selectedVehicle.capacity}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 5: Preview */}
          {step === "preview" && selectedDriver && (
            <div className="space-y-4">
              <Card className="p-4 overflow-hidden">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Resumo do Romaneio
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Tipo de Operação</span>
                    <Badge variant={fleetType === "own_fleet" ? "default" : "secondary"}>
                      {fleetType === "own_fleet" ? "Frota Própria" : "Terceiro"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Entregas</span>
                    <span className="font-medium">{selectedCount}</span>
                  </div>
                  {fleetType === "third_party" && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Tipo de Frete</span>
                      <Badge variant="outline">{freightTypeLabels[freightType]}</Badge>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Distância</span>
                    <span className="font-medium">{formatDistance(estimatedDistance)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Retorno à Base</span>
                    <Badge variant={returnToBase ? "default" : "secondary"}>
                      {returnToBase ? "✓ Sim" : "✗ Não"}
                    </Badge>
                  </div>
                  {fleetType === "own_fleet" && selectedVehicle && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Veículo</span>
                      <span className="font-mono font-medium">{selectedVehicle.plate}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Valor Total</span>
                    {fleetType === "own_fleet" ? (
                      <Badge variant="secondary" className="text-sm">Sem Acerto</Badge>
                    ) : (
                      <span className="font-bold text-lg text-primary">{formatCurrency(calculatedTotal)}</span>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Motorista
                </h4>
                
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary-foreground">{selectedDriver.avatar}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-x-4 text-sm min-w-0">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">Nome: </span>
                      <span className="font-medium break-words">{selectedDriver.name}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">CPF: </span>
                      <span className="font-medium font-mono break-all">{selectedDriver.cpf}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">Veículo: </span>
                      <span className="font-medium break-words">{vehicleTypeLabels[selectedDriver.vehicle_type] || selectedDriver.vehicle_type}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">Placa: </span>
                      <span className="font-mono font-medium break-all">{selectedVehicle?.plate || selectedDriver.vehicle_plate}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {fleetType === "own_fleet" && (
                <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    Este romaneio não gerará acerto financeiro (Frota Própria)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0 [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal [&>button]:px-4">
          {step !== "fleet_type" && (
            <Button type="button" variant="outline" onClick={handleBack} style={{ fontSize: '16px' }}>
              Voltar
            </Button>
          )}
          {step === "fleet_type" && (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} style={{ fontSize: '16px' }}>
              Cancelar
            </Button>
          )}
          {step !== "preview" ? (
            <Button 
              type="button" 
              onClick={handleNextStep} 
              className="bg-primary hover:bg-primary/90" 
              style={{ fontSize: '16px' }}
              disabled={step === "route" && isOptimizing}
            >
              Próximo
            </Button>
          ) : (
            <Button 
              type="button" 
              onClick={handleConfirm} 
              className="bg-primary hover:bg-primary/90" 
              style={{ fontSize: '16px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Gerando..." : "Confirmar e Gerar Romaneio"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

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


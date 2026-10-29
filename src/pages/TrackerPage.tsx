import { useEffect, useState, useCallback, useRef } from 'react';
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Navigation, Wifi, WifiOff, Battery, BatteryLow, AlertTriangle, 
  Truck, Home, Wallet, Settings, FileWarning, Package, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { GPSEnforcer } from '@/components/tracker/GPSEnforcer';
import { WalletTab } from '@/components/tracker/WalletTab';
import { SettingsTab } from '@/components/tracker/SettingsTab';
import { OccurrenceModal } from '@/components/tracker/OccurrenceModal';
import { DeliveryProofModal } from '@/components/tracker/DeliveryProofModal';
import { FinishDeliveryModal } from '@/components/tracker/FinishDeliveryModal';
import { DeliveryOccurrenceModal } from '@/components/tracker/DeliveryOccurrenceModal';
import { ManifestCard } from '@/components/tracker/ManifestCard';
import { DeliveryList } from '@/components/tracker/DeliveryList';
import { DriverOccurrencesSheet } from '@/components/tracker/DriverOccurrencesSheet';
import { useDriverManifest, DriverDelivery } from '@/hooks/useDriverManifest';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useDriverPresence } from '@/hooks/useDriverPresence';
import { resolveDriverForUser } from '@/lib/driverIdentity';
import { findArrivals } from '@/lib/geo';

interface GPSPosition {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  accuracy: number;
}

interface DriverInfo {
  id: string;
  name: string;
}

interface LinkedDriver {
  id: string;
  name: string;
  vehicle_plate: string;
  vehicle_type: string;
  photo: string | null;
}

const GPS_TRACKING_PREF_KEY = 'nahorafrota:gps-tracking-pref';
const GPS_HEARTBEAT_INTERVAL_MS = 30000;
// Intervalo minimo entre tentativas de registrar chegada na mesma entrega.
const ARRIVAL_RETRY_MS = 60000;

const readGpsTrackingPreference = () => {
  try {
    return window.localStorage.getItem(GPS_TRACKING_PREF_KEY) !== 'paused';
  } catch {
    return true;
  }
};

const writeGpsTrackingPreference = (value: 'active' | 'paused') => {
  try {
    window.localStorage.setItem(GPS_TRACKING_PREF_KEY, value);
  } catch {
    // Do not block GPS tracking if storage is unavailable.
  }
};

export default function TrackerPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [linkedDriver, setLinkedDriver] = useState<LinkedDriver | null>(null);
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showOccurrencesSheet, setShowOccurrencesSheet] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DriverDelivery | null>(null);
  const [showFinishDeliveryModal, setShowFinishDeliveryModal] = useState(false);
  const [showDeliveryOccurrenceModal, setShowDeliveryOccurrenceModal] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const [gpsShouldStayActive, setGpsShouldStayActive] = useState(readGpsTrackingPreference);
  const watchIdRef = useRef<number | null>(null);
  const isStartingTrackingRef = useRef(false);
  const gpsShouldStayActiveRef = useRef(gpsShouldStayActive);
  const openLocationDriverRef = useRef<string | null>(null);
  const arrivalAttemptsRef = useRef<Map<string, number>>(new Map());
  const previousManifestIdRef = useRef<string | null>(null);
  const wakeLock = useWakeLock();

  useEffect(() => {
    gpsShouldStayActiveRef.current = gpsShouldStayActive;
  }, [gpsShouldStayActive]);

  // Presence: announce this driver is online
  useDriverPresence(driverInfo?.id ?? null, driverInfo?.name ?? null);
  // Fetch manifest and deliveries
  const { 
    manifest, 
    deliveries, 
    isLoading: manifestLoading, 
    refetch: refetchManifest,
    markDelivered,
    markArrived,
  } = useDriverManifest();

  // Fetch linked driver from database (driver with matching user_id)
  useEffect(() => {
    if (!user) return;

    const fetchLinkedDriver = async () => {
      try {
        const linked = await resolveDriverForUser(user);

        if (linked) {
          setLinkedDriver({
            id: linked.id,
            name: linked.name || profile?.name || 'Motorista',
            vehicle_plate: linked.vehicle_plate || '',
            vehicle_type: linked.vehicle_type || '',
            photo: linked.photo || null,
          });
          setDriverInfo({
            id: linked.id,
            name: linked.name || profile?.name || 'Motorista',
          });
          return;
        }

        setLinkedDriver(null);
        setDriverInfo({
          id: user.id,
          name: profile?.name || user.email?.split('@')[0] || 'Motorista',
        });
      } catch (error) {
        console.error('Erro ao resolver motorista vinculado:', error);
        setLinkedDriver(null);
        setDriverInfo({
          id: user.id,
          name: profile?.name || user.email?.split('@')[0] || 'Motorista',
        });
      }
    };

    fetchLinkedDriver();
  }, [user, profile]);

  // Get battery level
  useEffect(() => {
    const updateBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
          
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        } catch (e) {
          console.log('Battery API not supported');
        }
      }
    };

    updateBattery();
  }, []);

  // Send position to Supabase
  const sendPosition = useCallback(async (gpsPosition: GPSPosition) => {
    if (!driverInfo) return;

    try {
      const { error: dbError } = await supabase
        .from('fleet_positions')
        .upsert({
          driver_id: driverInfo.id,
          driver_name: driverInfo.name,
          latitude: gpsPosition.latitude,
          longitude: gpsPosition.longitude,
          speed: Math.max(0, Math.min(gpsPosition.speed, 500)),
          heading: Math.max(0, Math.min(gpsPosition.heading, 360)),
          accuracy: Math.max(0, gpsPosition.accuracy),
          battery_level: Math.max(0, Math.min(batteryLevel, 100)),
          is_active: true,
        }, {
          onConflict: 'driver_id',
        });

      if (dbError) throw dbError;

      setLastUpdate(new Date());
      setGpsError(null);
      setGpsBlocked(false);
    } catch (err: any) {
      console.error('Erro ao enviar posição:', err);
    }
  }, [driverInfo, batteryLevel]);

  // O watchPosition guarda o callback do momento em que foi criado; pelo ref ele
  // sempre usa a versao atual (bateria e motorista atualizados).
  const sendPositionRef = useRef(sendPosition);
  useEffect(() => {
    sendPositionRef.current = sendPosition;
  }, [sendPosition]);

  const clearGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    isStartingTrackingRef.current = false;
  }, []);

  // So a permissao negada bloqueia o app (politica de GPS obrigatorio). Sinal fraco
  // ou demora do GPS so mostram aviso: antes qualquer erro trocava o app inteiro
  // pela tela vermelha e o motorista nao conseguia finalizar entregas.
  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      clearGpsWatch();
      setGpsError('Permissão de localização negada. Libere a localização para o app nas configurações do celular.');
      setGpsBlocked(true);
      return;
    }
    setGpsError(err.code === err.TIMEOUT ? 'Sinal de GPS fraco: tentando de novo...' : 'Localização indisponível no momento.');
  }, [clearGpsWatch]);

  // Ao abrir (ou voltar para) o app, sempre busca a localizacao atual e
  // atualiza o mapa, mesmo que o rastreamento continuo esteja pausado.
  const refreshLocationOnce = useCallback(() => {
    if (!driverInfo || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsPos: GPSPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: (pos.coords.speed || 0) * 3.6,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy,
        };
        setPosition(gpsPos);
        sendPosition(gpsPos);
      },
      (err) => {
        console.warn('Nao foi possivel obter a localizacao ao abrir o app:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [driverInfo, sendPosition]);

  useEffect(() => {
    if (!driverInfo || openLocationDriverRef.current === driverInfo.id) return;
    openLocationDriverRef.current = driverInfo.id;
    refreshLocationOnce();
  }, [driverInfo, refreshLocationOnce]);

  // Motorista a ate 100 m do endereco de uma entrega pendente = "motorista chegou".
  useEffect(() => {
    if (!position || deliveries.length === 0) return;

    const now = Date.now();
    const arrivals = findArrivals(position, deliveries).filter(({ delivery }) => {
      const lastAttempt = arrivalAttemptsRef.current.get(delivery.id);
      return !lastAttempt || now - lastAttempt > ARRIVAL_RETRY_MS;
    });

    arrivals.forEach(({ delivery }) => {
      arrivalAttemptsRef.current.set(delivery.id, now);
      supabase
        .rpc('register_driver_arrival', {
          p_invoice_id: delivery.id,
          p_latitude: position.latitude,
          p_longitude: position.longitude,
        })
        .then(({ data, error }) => {
          if (error) {
            console.warn('Erro ao registrar chegada:', error);
            return;
          }
          const result = (data || {}) as { arrived?: boolean; arrived_at?: string; already?: boolean };
          if (!result.arrived) return;
          markArrived(delivery.id, result.arrived_at || new Date().toISOString());
          if (!result.already) {
            toast.success('Chegada registrada', {
              description: `Você chegou em ${delivery.recipient_name}`,
              duration: 3000,
            });
          }
        });
    });
  }, [position, deliveries, markArrived]);

  // Quando a ultima entrega e concluida sem ocorrencia, o banco finaliza o
  // romaneio sozinho; aqui so avisamos o motorista.
  useEffect(() => {
    if (manifestLoading) return;

    const previousId = previousManifestIdRef.current;
    previousManifestIdRef.current = manifest?.id ?? null;
    if (!previousId || manifest?.id === previousId) return;

    supabase
      .from('manifests')
      .select('status')
      .eq('id', previousId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'completed') {
          toast.success('Romaneio finalizado', {
            description: 'Todas as entregas foram concluídas. Bom trabalho!',
            duration: 4000,
          });
        }
      });
  }, [manifest, manifestLoading]);

  // Start tracking
  const startTracking = useCallback(() => {
    setGpsShouldStayActive(true);
    writeGpsTrackingPreference('active');

    if (!driverInfo) {
      toast.error('Aguardando dados do usuário', {
        duration: 2000,
      });
      return;
    }

    if (!navigator.geolocation) {
      toast.error('GPS não disponível', {
        description: 'Dispositivo não suporta geolocalização',
        duration: 3000,
      });
      return;
    }

    if (isStartingTrackingRef.current || watchIdRef.current !== null) {
      setIsTracking(true);
      return;
    }

    isStartingTrackingRef.current = true;
    setIsTracking(true);
    setGpsError(null);
    setGpsBlocked(false);

    // Acquire screen wake lock to prevent screen sleep
    wakeLock.request();

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsPos: GPSPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: (pos.coords.speed || 0) * 3.6,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy,
        };

        setPosition(gpsPos);
        sendPositionRef.current(gpsPos);
        toast.success('GPS Ativado', {
          description: 'Rastreamento em tempo real',
          duration: 2000,
        });
      },
      handleGeoError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gpsPos: GPSPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: (pos.coords.speed || 0) * 3.6,
          heading: pos.coords.heading || 0,
          accuracy: pos.coords.accuracy,
        };

        setPosition(gpsPos);
        sendPositionRef.current(gpsPos);
        setGpsError(null);
        setGpsBlocked(false);
      },
      handleGeoError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    isStartingTrackingRef.current = false;
  }, [driverInfo, wakeLock, handleGeoError]);

  // Auto-start GPS tracking when driver info is available
  useEffect(() => {
    if (driverInfo && gpsShouldStayActive && !isTracking && !gpsBlocked) {
      const timer = setTimeout(() => {
        console.log('🚀 Auto-iniciando rastreamento GPS...');
        setAutoStarted(true);
        startTracking();
      }, autoStarted ? 500 : 1500);

      return () => clearTimeout(timer);
    }
  }, [driverInfo, gpsShouldStayActive, isTracking, gpsBlocked, autoStarted, startTracking]);

  // Resume tracking when the PWA/tab becomes active again.
  useEffect(() => {
    const resumeTracking = () => {
      if (!driverInfo || !gpsShouldStayActiveRef.current || gpsBlocked) return;

      if (watchIdRef.current === null) {
        startTracking();
        return;
      }

      setIsTracking(true);
      wakeLock.request();

      if (position) {
        sendPosition(position);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshLocationOnce();
        resumeTracking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [driverInfo, gpsBlocked, position, sendPosition, startTracking, wakeLock, refreshLocationOnce]);

  // Keep the dashboard refreshed even if the driver is stopped.
  useEffect(() => {
    if (!driverInfo || !isTracking || !position) return;

    const intervalId = window.setInterval(() => {
      sendPosition(position);
    }, GPS_HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [driverInfo, isTracking, position, sendPosition]);

  // Stop tracking
  const stopTracking = async () => {
    setGpsShouldStayActive(false);
    writeGpsTrackingPreference('paused');

    clearGpsWatch();

    setIsTracking(false);

    // Release screen wake lock
    wakeLock.release();

    if (driverInfo) {
      await supabase
        .from('fleet_positions')
        .update({ is_active: false })
        .eq('driver_id', driverInfo.id);
    }

    toast.info('GPS Pausado', {
      duration: 1500,
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Navigate to delivery using Waze or Google Maps
  const navigateToDelivery = useCallback((delivery: DriverDelivery) => {
    let url: string;

    if (delivery.latitude && delivery.longitude) {
      // Waze with coordinates
      url = `https://waze.com/ul?ll=${delivery.latitude},${delivery.longitude}&navigate=yes`;
    } else if (delivery.address_full) {
      // Google Maps with address
      const encodedAddress = encodeURIComponent(delivery.address_full);
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else {
      toast.error('Endereço não disponível para navegação');
      return;
    }

    window.open(url, '_blank');
  }, []);

  // Handle finish delivery
  const handleFinishDelivery = useCallback((delivery: DriverDelivery) => {
    setSelectedDelivery(delivery);
    setShowFinishDeliveryModal(true);
  }, []);

  // Handle register occurrence for a specific delivery
  const handleRegisterDeliveryOccurrence = useCallback((delivery: DriverDelivery) => {
    setSelectedDelivery(delivery);
    setShowDeliveryOccurrenceModal(true);
  }, []);

  // Calculate delivery stats - always compute even if no user (hooks must be consistent)
  const completedCount = deliveries.filter(d => d.status === 'delivered').length;
  const totalCount = deliveries.length;

  // Early return for no user - AFTER all hooks are defined
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Login Necessário</h2>
          <p className="text-muted-foreground mb-4">
            Faça login para iniciar o rastreamento GPS.
          </p>
          <Button onClick={() => window.location.href = '/login'}>
            Ir para Login
          </Button>
        </Card>
      </div>
    );
  }

  // GPS Enforcer overlay
  if (gpsBlocked && isTracking) {
    return (
      <GPSEnforcer
        error={gpsError || 'Permissão de localização negada'}
        onRetry={() => {
          // Recria o watch: o anterior morreu com a permissao negada.
          clearGpsWatch();
          setGpsBlocked(false);
          setGpsError(null);
          startTracking();
        }}
      />
    );
  }

  // Main render

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 safe-area-top">
        <div className="flex items-center justify-between">
          {/* Logo em linha: faixa estreita (o nome nunca e digitado com fonte). */}
          <BrandLogo arrangement="linha" className="w-[160px]" />
          <div className="flex items-center gap-2">
            {isTracking ? (
              <Wifi className="h-5 w-5 text-green-500 animate-pulse" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
            {batteryLevel > 20 ? (
              <Battery className="h-5 w-5 text-green-500" />
            ) : (
              <BatteryLow className="h-5 w-5 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground">{batteryLevel}%</span>
          </div>
        </div>
        {linkedDriver ? (
          <button 
            onClick={() => setShowOccurrencesSheet(true)}
            className="flex items-center gap-2 mt-2 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors active:scale-[0.98]"
          >
            {linkedDriver.photo && (
              <img 
                src={linkedDriver.photo} 
                alt={linkedDriver.name} 
                className="w-8 h-8 rounded-full object-cover border-2 border-primary"
              />
            )}
            <div className="flex flex-col items-start">
              <Badge variant="outline" className="text-sm">
                {linkedDriver.name}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {linkedDriver.vehicle_plate} • {linkedDriver.vehicle_type}
              </span>
            </div>
            <AlertTriangle className="h-4 w-4 text-yellow-500 ml-auto" />
          </button>
        ) : driverInfo && (
          <button 
            onClick={() => setShowOccurrencesSheet(true)}
            className="mt-2 hover:opacity-80 transition-opacity"
          >
            <Badge variant="outline">
              {driverInfo.name}
            </Badge>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="home" className="mt-0 space-y-4">
            {/* GPS Status Mini Card */}
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isTracking ? 'bg-green-500/20' : 'bg-muted'}`}>
                    <Navigation className={`h-5 w-5 ${isTracking ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {isTracking ? 'GPS Sempre Ativo' : 'GPS Inativo'}
                    </p>
                    {position && (
                      <p className="text-xs text-muted-foreground">
                        {position.speed.toFixed(0)} km/h • ±{position.accuracy.toFixed(0)}m
                      </p>
                    )}
                    {gpsError && !gpsBlocked && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{gpsError}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isTracking ? 'destructive' : 'default'}
                  onClick={isTracking ? stopTracking : startTracking}
                  className="h-9"
                >
                  {isTracking ? 'Pausar' : 'Iniciar'}
                </Button>
              </div>
            </Card>

            {/* Manifest Card */}
            {manifestLoading ? (
              <Card className="p-4 space-y-3">
                <Skeleton className="h-6 w-40" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
                <Skeleton className="h-4 w-full" />
              </Card>
            ) : manifest ? (
              <ManifestCard 
                manifest={manifest} 
                completedCount={completedCount}
                totalCount={totalCount}
              />
            ) : (
              <Card className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold mb-1">Nenhum Romaneio Ativo</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Você não possui romaneio atribuído no momento.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchManifest()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </Card>
            )}

            {/* Delivery List */}
            {manifest && (
              <DeliveryList
                deliveries={deliveries}
                onNavigate={navigateToDelivery}
                onFinishDelivery={handleFinishDelivery}
                onRegisterOccurrence={handleRegisterDeliveryOccurrence}
                onForceSync={refetchManifest}
              />
            )}
          </TabsContent>

          <TabsContent value="wallet" className="mt-0">
            {driverInfo && <WalletTab driverId={driverInfo.id} />}
          </TabsContent>

          <TabsContent value="report" className="mt-0">
            <Card className="p-6 text-center">
              <FileWarning className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-semibold mb-2">Registrar Ocorrência</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Reporte acidentes, atrasos ou problemas mecânicos
              </p>
              <Button
                onClick={() => setShowOccurrenceModal(true)}
                size="lg"
                className="gap-2"
              >
                <AlertTriangle className="h-5 w-5" />
                Registrar Ocorrência
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsTab driverName={driverInfo?.name || 'Motorista'} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom">
        <div className="grid w-full grid-cols-4 h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
              activeTab === 'home' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Início</span>
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
              activeTab === 'wallet' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs">Carteira</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
              activeTab === 'report' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileWarning className="h-5 w-5" />
            <span className="text-xs">Reportar</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
              activeTab === 'settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs">Config</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {driverInfo && (
        <>
          {/* General Occurrence Modal (Report tab) */}
          <OccurrenceModal
            open={showOccurrenceModal}
            onClose={() => setShowOccurrenceModal(false)}
            driverId={driverInfo.id}
            latitude={position?.latitude}
            longitude={position?.longitude}
            onSuccess={() => {}}
          />

          {/* Finish Delivery Modal */}
          {selectedDelivery && (
            <FinishDeliveryModal
              open={showFinishDeliveryModal}
              onClose={() => {
                setShowFinishDeliveryModal(false);
                setSelectedDelivery(null);
              }}
              invoiceId={selectedDelivery.id}
              nfeNumber={selectedDelivery.nfe_number}
              recipientName={selectedDelivery.recipient_name}
              driverId={driverInfo.id}
              latitude={position?.latitude}
              longitude={position?.longitude}
              onSuccess={() => {
                setSelectedDelivery(null);
                refetchManifest();
              }}
            />
          )}

          {/* Delivery Occurrence Modal */}
          {selectedDelivery && (
            <DeliveryOccurrenceModal
              open={showDeliveryOccurrenceModal}
              onClose={() => {
                setShowDeliveryOccurrenceModal(false);
                setSelectedDelivery(null);
              }}
              invoiceId={selectedDelivery.id}
              nfeNumber={selectedDelivery.nfe_number}
              recipientName={selectedDelivery.recipient_name}
              driverId={driverInfo.id}
              latitude={position?.latitude}
              longitude={position?.longitude}
              onSuccess={() => {
                setSelectedDelivery(null);
                refetchManifest();
              }}
            />
          )}

          {/* Legacy DeliveryProofModal - kept for backward compatibility */}
          {selectedDelivery && showDeliveryModal && (
            <DeliveryProofModal
              open={showDeliveryModal}
              onClose={() => {
                setShowDeliveryModal(false);
                setSelectedDelivery(null);
              }}
              invoiceId={selectedDelivery.id}
              driverId={driverInfo.id}
              latitude={position?.latitude}
              longitude={position?.longitude}
              onSuccess={() => {
                markDelivered(selectedDelivery.id);
                setSelectedDelivery(null);
                refetchManifest();
              }}
            />
          )}

          <DriverOccurrencesSheet
            open={showOccurrencesSheet}
            onOpenChange={setShowOccurrencesSheet}
            driverId={driverInfo.id}
            driverName={driverInfo.name}
          />
        </>
      )}
    </div>
  );
}

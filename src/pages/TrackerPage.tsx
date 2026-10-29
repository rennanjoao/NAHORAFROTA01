import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { EmptyState } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { DriverTopBar, type GpsState } from '@/components/tracker/DriverTopBar';
import { DriverBottomNav, type DriverTab } from '@/components/tracker/DriverBottomNav';
import { GPSEnforcer } from '@/components/tracker/GPSEnforcer';
import { HomeTab } from '@/components/tracker/HomeTab';
import { WalletTab } from '@/components/tracker/WalletTab';
import { ReportTab } from '@/components/tracker/ReportTab';
import { SettingsTab } from '@/components/tracker/SettingsTab';
import { OccurrenceModal } from '@/components/tracker/OccurrenceModal';
import { FinishDeliveryModal } from '@/components/tracker/FinishDeliveryModal';
import { DeliveryOccurrenceModal } from '@/components/tracker/DeliveryOccurrenceModal';
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

// Titulo da aba do navegador por tela do app (o leitor de tela anuncia a troca).
const TAB_TITLES: Record<DriverTab, string> = {
  home: 'Entregas de hoje',
  wallet: 'Carteira',
  report: 'Reportar problema',
  settings: 'Configurações',
};

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
  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [linkedDriver, setLinkedDriver] = useState<LinkedDriver | null>(null);
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [occurrenceType, setOccurrenceType] = useState<string | undefined>();
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
    error: manifestError,
    refetch: refetchManifest,
    markArrived,
  } = useDriverManifest();

  // Falha ao atualizar com a lista antiga na tela: avisa (sem lista, a aba Inicio mostra o erro).
  useEffect(() => {
    if (!manifestError || !manifest) return;
    toast.error('Não foi possível atualizar as entregas', {
      description: 'Confira a internet. A lista na tela pode estar desatualizada.',
      duration: 4000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so quando surge um erro novo
  }, [manifestError]);

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
          const battery = await (navigator as Navigator & {
            getBattery: () => Promise<{ level: number; addEventListener: (type: string, listener: () => void) => void }>;
          }).getBattery();
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
    } catch (err) {
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
      setGpsError('O celular não deixou o app usar a localização.');
      setGpsBlocked(true);
      return;
    }
    setGpsError(err.code === err.TIMEOUT ? 'Sinal fraco. Tentando de novo.' : 'Localização indisponível agora. Tentando de novo.');
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
              description: `Você chegou em ${delivery.recipient_name}.`,
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
            description: 'Todas as entregas foram concluídas. Bom trabalho.',
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
      toast.error('Carregando seus dados. Tente de novo em instantes.', {
        duration: 2000,
      });
      return;
    }

    if (!navigator.geolocation) {
      toast.error('GPS indisponível', {
        description: 'Este celular não informa a localização.',
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
        toast.success('GPS ligado', {
          description: 'A base já vê onde você está.',
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
        console.log('Auto-iniciando rastreamento GPS');
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

    toast.info('GPS pausado', {
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
      toast.error('Esta entrega está sem endereço. Fale com a base.');
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

  // Abre o formulario geral (aba Reportar) ja com o tipo escolhido.
  const handleReportOccurrence = useCallback((type: string) => {
    setOccurrenceType(type);
    setShowOccurrenceModal(true);
  }, []);

  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab]} · Na Hora Frota`;
  }, [activeTab]);

  // Topo fixo (4rem) e barra inferior (4.5rem): ao navegar com Tab, o botao em foco
  // rola para fora delas em vez de ficar escondido (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement;
    root.style.scrollPaddingTop = 'calc(4rem + env(safe-area-inset-top) + 0.75rem)';
    root.style.scrollPaddingBottom = 'calc(4.5rem + env(safe-area-inset-bottom) + 0.75rem)';
    return () => {
      root.style.scrollPaddingTop = '';
      root.style.scrollPaddingBottom = '';
    };
  }, []);

  // Depois de finalizar/reportar, o cartao usado sai da lista e o foco cairia no body:
  // leva para "Proxima entrega" (ou "Todas as paradas foram feitas").
  const afterDeliveryChange = useCallback(async () => {
    setSelectedDelivery(null);
    await refetchManifest();
    window.setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      (document.getElementById('proxima-titulo') || document.getElementById('tudo-entregue-titulo'))?.focus();
    }, 400);
  }, [refetchManifest]);

  const changeTab = useCallback((tab: DriverTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, []);

  // Early return for no user - AFTER all hooks are defined
  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <h1 className="sr-only">App do motorista</h1>
        <EmptyState
          icon={LogIn}
          title="Entre para usar o app"
          description="Faça login com o e-mail e a senha que a base passou para você."
          action={
            <Button asChild size="lg">
              <Link to="/login">Entrar</Link>
            </Button>
          }
          className="w-full max-w-sm bg-card"
        />
      </main>
    );
  }

  // GPS Enforcer overlay
  if (gpsBlocked && isTracking) {
    return (
      <GPSEnforcer
        error={gpsError || 'O celular não deixou o app usar a localização.'}
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

  const gpsState: GpsState = !isTracking ? 'paused' : gpsError ? 'weak' : 'on';
  const vehicle = [linkedDriver?.vehicle_plate, linkedDriver?.vehicle_type].filter(Boolean).join(' · ');

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DriverTopBar
        name={driverInfo?.name || 'Motorista'}
        plate={linkedDriver?.vehicle_plate}
        vehicleType={linkedDriver?.vehicle_type}
        photo={linkedDriver?.photo}
        gps={gpsState}
        batteryLevel={batteryLevel}
      />

      <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom)+2rem)] pt-5">
        {/* key: cada aba entra com animacao e o titulo recebe o foco. */}
        <div key={activeTab} className="page-enter">
          {activeTab === 'home' && (
            <HomeTab
              manifest={manifest}
              deliveries={deliveries}
              loading={manifestLoading}
              error={manifestError}
              onRefresh={refetchManifest}
              onNavigate={navigateToDelivery}
              onFinishDelivery={handleFinishDelivery}
              onRegisterOccurrence={handleRegisterDeliveryOccurrence}
              gps={{
                isTracking,
                speed: position?.speed,
                accuracy: position?.accuracy,
                warning: gpsBlocked ? null : gpsError,
                onStart: startTracking,
                onStop: stopTracking,
              }}
            />
          )}

          {activeTab === 'wallet' && driverInfo && <WalletTab driverId={driverInfo.id} />}

          {activeTab === 'report' && (
            <ReportTab
              onReport={handleReportOccurrence}
              onShowHistory={() => setShowOccurrencesSheet(true)}
              onGoHome={() => changeTab('home')}
            />
          )}

          {activeTab === 'settings' && <SettingsTab driverName={driverInfo?.name || 'Motorista'} vehicle={vehicle} />}
        </div>
      </main>

      <DriverBottomNav active={activeTab} onChange={changeTab} />

      {driverInfo && (
        <>
          {/* Problema geral (aba Reportar) */}
          <OccurrenceModal
            open={showOccurrenceModal}
            onClose={() => {
              setShowOccurrenceModal(false);
              setOccurrenceType(undefined);
            }}
            driverId={driverInfo.id}
            latitude={position?.latitude}
            longitude={position?.longitude}
            defaultType={occurrenceType}
            onSuccess={() => {}}
          />

          {/* Finalizar entrega */}
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
              onSuccess={afterDeliveryChange}
            />
          )}

          {/* Problema numa entrega */}
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
              onSuccess={afterDeliveryChange}
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

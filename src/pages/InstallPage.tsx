import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/auth/AuthLayout';
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  Check,
  CircleCheck,
  Download,
  EllipsisVertical,
  MapPin,
  Share,
  Smartphone,
  SquarePlus,
  WifiOff,
} from 'lucide-react';
import { trackFunnelEvent } from '@/lib/funnel';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const installedHeadingRef = useRef<HTMLHeadingElement>(null);

  // "Instalar agora" some ao instalar: o foco vai para o titulo da tela nova (nao cai no body).
  useEffect(() => {
    if (isInstalled) installedHeadingRef.current?.focus();
  }, [isInstalled]);

  useEffect(() => {
    trackFunnelEvent('page_view');
  }, []);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);
    
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  const features = [
    { icon: MapPin, title: 'GPS da entrega', description: 'A base acompanha a rota em tempo real' },
    { icon: WifiOff, title: 'Abre sem internet', description: 'O app carrega mesmo com sinal fraco' },
    { icon: Bell, title: 'Avisos', description: 'Novidades do romaneio na hora' },
    { icon: BatteryCharging, title: 'Leve', description: 'Gasta pouca bateria e espaço' },
  ];

  const steps = isIOS
    ? [
        { icon: Share, title: 'Toque em Compartilhar', text: 'No Safari, é o quadrado com a seta para cima, embaixo da tela.' },
        { icon: SquarePlus, title: 'Toque em "Adicionar à Tela de Início"', text: 'Role a lista para baixo até encontrar.' },
        { icon: Check, title: 'Toque em "Adicionar"', text: 'O ícone do Na Hora Frota aparece na tela do celular.' },
      ]
    : [
        { icon: EllipsisVertical, title: 'Abra o menu do navegador', text: 'No Chrome, são os três pontinhos no canto de cima.' },
        { icon: Download, title: 'Toque em "Instalar app"', text: 'Pode aparecer como "Adicionar à tela inicial".' },
        { icon: Check, title: 'Confirme', text: 'O ícone do Na Hora Frota aparece na tela do celular.' },
      ];

  if (isStandalone || isInstalled) {
    return (
      <AuthLayout variant="centered" pageTitle="App instalado">
        <div className="space-y-4 text-center">
          <span aria-hidden="true" className="mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-success text-success-foreground">
            <CircleCheck className="h-8 w-8" />
          </span>
          <h1 ref={installedHeadingRef} tabIndex={-1} className="text-[1.75rem] font-semibold leading-tight tracking-tight outline-none">
            App instalado
          </h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            O Na Hora Frota já está no seu celular. Abra pelo ícone na tela inicial.
          </p>
          <Button asChild size="lg" className="mt-2 w-full">
            <Link to="/dashboard">
              Abrir o app
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout variant="centered" width="md" pageTitle="Instalar o app">
      <div className="space-y-8">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            App para celular
          </span>
          <h1 className="pt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">Instale o Na Hora Frota no celular</h1>
          <p className="text-[0.9375rem] text-muted-foreground">
            Fica na tela inicial, como qualquer app, sem precisar baixar da loja.
          </p>
        </div>

        <ul className="stagger grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="rounded-xl border bg-card p-4 shadow-xs">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>

        {deferredPrompt ? (
          <Button onClick={handleInstall} size="lg" className="h-14 w-full text-base [&_svg]:size-5">
            <Download aria-hidden="true" />
            Instalar agora
          </Button>
        ) : (
          <section aria-labelledby="como-instalar" className="space-y-4">
            <h2 id="como-instalar" className="text-lg font-semibold">
              {isIOS ? 'Como instalar no iPhone' : 'Como instalar'}
            </h2>
            <ol className="space-y-3">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-data text-sm font-semibold text-primary"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[0.9375rem] font-medium text-foreground">
                      {title}
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/dashboard">
            Continuar no navegador
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

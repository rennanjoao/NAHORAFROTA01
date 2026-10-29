import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Smartphone, 
  Check, 
  Share, 
  Plus,
  ArrowRight,
  Truck,
  MapPin,
  Wifi,
  Battery,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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
    { icon: MapPin, title: 'Rastreamento GPS', description: 'Acompanhe sua frota em tempo real' },
    { icon: Wifi, title: 'Funciona Offline', description: 'Acesse dados mesmo sem internet' },
    { icon: Bell, title: 'Notificações', description: 'Receba alertas importantes' },
    { icon: Battery, title: 'Otimizado', description: 'Baixo consumo de bateria' },
  ];

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-success/20 flex items-center justify-center mb-6">
          <Check className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-2">App Instalado!</h1>
        <p className="text-muted-foreground mb-6">
          O Na Hora Frota está instalado no seu dispositivo.
        </p>
        <Button onClick={() => window.location.href = '/'} className="gap-2">
          Abrir App
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <Logo variant="linha" className="h-8 w-auto" />
        </div>
        <Badge variant="outline" className="mb-2">
          App do motorista
        </Badge>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-6 flex flex-col">
        <Card className="flex-1 p-6 flex flex-col">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Instale o App</h1>
            <p className="text-muted-foreground">
              Acesse rapidamente direto da sua tela inicial
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {features.map((feature, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-muted/50 text-center">
                <feature.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Install Instructions */}
          <div className="flex-1 flex flex-col justify-end">
            {isIOS ? (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground mb-4">
                  Para instalar no iPhone/iPad:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Share className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">1. Toque em Compartilhar</p>
                      <p className="text-xs text-muted-foreground">No Safari, toque no ícone de compartilhamento</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">2. Adicionar à Tela de Início</p>
                      <p className="text-xs text-muted-foreground">Role e toque em "Adicionar à Tela de Início"</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">3. Confirme</p>
                      <p className="text-xs text-muted-foreground">Toque em "Adicionar" para confirmar</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <Button 
                onClick={handleInstall} 
                size="lg" 
                className="w-full h-14 text-lg gap-2"
              >
                <Download className="h-5 w-5" />
                Instalar Agora
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Para instalar, abra o menu do navegador e selecione "Instalar app" ou "Adicionar à tela inicial"
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                  className="gap-2"
                >
                  Continuar no Navegador
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center">
        <p className="text-xs text-muted-foreground">
          © 2025 Na Hora Frota • Gestão de Frota Inteligente
        </p>
      </footer>
    </div>
  );
}

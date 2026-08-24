
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Camera, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Globe, 
  ArrowRight, 
  Heart, 
  Lock,
  Smartphone,
  Trophy,
  MapPin,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('ps_active_session');
    if (sessionData) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] selection:bg-primary/30 text-white font-body">
      {/* Cabecera Minimalista */}
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <Link className="flex items-center gap-2.5 group" href="/">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-[0_0_20px_rgba(115,115,240,0.4)] group-hover:scale-110 transition-all duration-300">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight font-headline">PixelSphere</span>
        </Link>
        <nav className="flex gap-8 items-center">
          <Link className="text-sm font-medium text-muted-foreground hover:text-white transition-colors hidden lg:block" href="#beneficios">Beneficios</Link>
          <Link className="text-sm font-medium text-muted-foreground hover:text-white transition-colors hidden lg:block" href="/login?mode=login">Entrar</Link>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8 h-11 font-bold shadow-lg shadow-primary/20">
            <Link href="/login?mode=register">Crear mi Espacio</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero: El Gran Impacto */}
        <section className="w-full py-20 lg:py-40 flex items-center justify-center overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[800px] bg-primary/10 blur-[150px] rounded-full pointer-events-none -z-10" />
          <div className="absolute top-40 right-[10%] w-80 h-80 bg-accent/10 blur-[120px] rounded-full animate-float pointer-events-none -z-10" />
          
          <div className="container px-4 md:px-6 relative text-center">
            <div className="flex flex-col items-center space-y-12">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-6 py-2 text-xs font-black text-accent shadow-inner animate-zoom-in tracking-widest uppercase">
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Tus recuerdos, más inteligentes que nunca</span>
              </div>
              
              <h1 className="text-5xl font-extrabold tracking-tighter sm:text-7xl md:text-8xl max-w-5xl font-headline leading-[1.05] animate-slide-up">
                Todo tu mundo visual <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7373F0] via-[#66E0FF] to-[#7373F0] animate-gradient">en un solo lugar</span>
              </h1>
              
              <p className="mx-auto max-w-[800px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed animate-slide-up delay-200">
                Guarda, organiza y protege tus fotos y videos en una plataforma ultra rápida que entiende lo que hay en tus imágenes y las mantiene seguras de verdad.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-5 pt-4 animate-slide-up delay-300">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl shadow-primary/30 border-t border-white/20 transition-all hover:scale-105 active:scale-95">
                  <Link href="/login?mode=register">Empezar ahora gratis <ArrowRight className="ml-2 h-6 w-6" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full border-white/10 hover:bg-white/5 px-12 h-16 text-xl font-bold backdrop-blur-md transition-all hover:scale-105 active:scale-95">
                  <Link href="/login?mode=login">Ver cómo funciona</Link>
                </Button>
              </div>

              {/* Estadísticas de Impacto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pt-20 w-full max-w-4xl animate-fade-in delay-500 opacity-60">
                <div className="space-y-1">
                  <p className="text-3xl font-black font-headline">26GB</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Regalo Inicial</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black font-headline">Instantáneo</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Sin Esperas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black font-headline">Mágico</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Editor con IA</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black font-headline">Privado</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">100% Seguro</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Beneficios: Por qué PixelSphere */}
        <section id="beneficios" className="w-full py-32 bg-white/[0.02] relative">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-24 space-y-4 animate-slide-up">
              <h2 className="text-4xl md:text-6xl font-bold font-headline">Hecho para tus mejores momentos</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl">
                Hemos diseñado una experiencia líquida donde tus archivos no son solo datos, son historias vivas.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              <FeatureCard 
                icon={<Lock className="h-10 w-10 text-primary" />}
                title="Tu propia caja fuerte digital"
                description="Guarda tus fotos más privadas bajo una contraseña adicional. Nadie podrá verlas sin tu huella o clave secreta."
                delay="delay-100"
              />
              <FeatureCard 
                icon={<Sparkles className="h-10 w-10 text-accent" />}
                title="Edición mágica con IA"
                description="¿Quieres cambiar el fondo o mejorar una foto? Solo pídelo con palabras y nuestra IA lo hará por ti al instante."
                delay="delay-200"
              />
              <FeatureCard 
                icon={<Zap className="h-10 w-10 text-primary" />}
                title="Subidas a la velocidad de la luz"
                description="No pierdas tiempo esperando. Sube videos enormes de hasta 26GB mientras sigues navegando por tu galería."
                delay="delay-300"
              />
              <FeatureCard 
                icon={<LayoutGrid className="h-10 w-10 text-accent" />}
                title="Se organiza solo"
                description="Nuestra inteligencia reconoce qué hay en tus fotos. Busca 'playa' o 'perro' y aparecerán sin que hayas puesto etiquetas."
                delay="delay-400"
              />
              <FeatureCard 
                icon={<MapPin className="h-10 w-10 text-primary" />}
                title="Tus viajes en un mapa"
                description="Explora tus recuerdos visualmente en un mapa interactivo. Mira exactamente dónde tomaste cada foto en el mundo."
                delay="delay-500"
              />
              <FeatureCard 
                icon={<Clock className="h-10 w-10 text-accent" />}
                title="Toda tu vida en orden"
                description="Navega por una línea de tiempo perfecta. Revive lo que hiciste hace años con un solo gesto."
                delay="delay-700"
              />
            </div>
          </div>
        </section>

        {/* Experiencia Real: Sincronización */}
        <section className="w-full py-32 overflow-hidden">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-20">
              <div className="lg:w-1/2 space-y-10 animate-slide-up">
                <h2 className="text-4xl md:text-6xl font-bold font-headline leading-tight">
                  Tus fotos en todos <br /> <span className="text-primary">tus dispositivos</span>
                </h2>
                <div className="space-y-10">
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 text-primary group-hover:scale-110 transition-transform">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold mb-2">Todo en tiempo real</h4>
                      <p className="text-muted-foreground text-lg">Si borras una foto en tu PC, desaparece al instante en tu móvil. Sin refrescar, sin esperas. Es como magia.</p>
                    </div>
                  </div>
                  <div className="flex gap-6 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0 border border-accent/20 text-accent group-hover:scale-110 transition-transform">
                      <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold mb-2">Instálalo como una App</h4>
                      <p className="text-muted-foreground text-lg">Puedes añadir PixelSphere a tu pantalla de inicio y usarlo como una aplicación nativa. Rápido, fluido y siempre listo.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 relative group animate-zoom-in delay-300">
                <div className="absolute -inset-10 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-all duration-700" />
                <div className="relative aspect-video rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-card/40 backdrop-blur-xl flex items-center justify-center">
                  <div className="text-center space-y-6 p-12">
                    <div className="relative inline-block">
                      <Zap className="h-20 w-20 text-accent mx-auto animate-pulse" />
                      <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
                    </div>
                    <p className="text-2xl font-bold font-headline tracking-widest uppercase">Nexo Sincronizado</p>
                    <div className="flex gap-2 justify-center">
                      {[1,2,3].map(i => <div key={i} className="w-12 h-1.5 bg-primary/40 rounded-full animate-pulse" style={{ animationDelay: `${i*200}ms` }} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cierre con Impacto */}
        <section className="w-full py-40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-primary/10 -z-10" />
          <div className="container px-4 md:px-6 mx-auto text-center">
            <div className="max-w-4xl mx-auto space-y-12 animate-slide-up">
              <div className="w-24 h-24 rounded-[2.5rem] bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-8 animate-bounce">
                <Trophy className="h-12 w-12 text-accent" />
              </div>
              <h2 className="text-5xl md:text-7xl font-bold font-headline tracking-tight leading-none">Únete a la nueva era visual</h2>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
                Empieza hoy mismo a organizar tus fotos y videos en el lugar más avanzado y seguro del mundo.
              </p>
              <div className="pt-6">
                <Button asChild size="lg" className="bg-white text-black hover:bg-white/90 rounded-full px-16 h-20 text-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
                  <Link href="/login?mode=register">Empezar ahora — Gratis</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de Página */}
      <footer className="w-full py-20 border-t border-white/5 bg-black/60 backdrop-blur-2xl">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="space-y-6 text-center md:text-left">
              <Link className="flex items-center justify-center md:justify-start gap-3 group" href="/">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <span className="text-2xl font-bold font-headline">PixelSphere</span>
              </Link>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Diseñando el futuro de tus recuerdos digitales con inteligencia y seguridad total.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-12 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">Seguridad</Link>
              <Link href="#" className="hover:text-primary transition-colors">Privacidad</Link>
              <Link href="#" className="hover:text-primary transition-colors">Términos</Link>
            </div>
          </div>
          
          <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
            <p className="text-xs font-medium">
              © 2026 PixelSphere Inc. — Hecho con ❤️ para tus recuerdos.
            </p>
            <div className="flex gap-8">
              <Globe className="h-5 w-5" />
              <Smartphone className="h-5 w-5" />
              <Heart className="h-5 w-5" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
  return (
    <div className={`group p-10 rounded-[3rem] border border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-primary/20 transition-all duration-700 hover:-translate-y-4 animate-slide-up ${delay}`}>
      <div className="mb-10 p-5 rounded-[1.5rem] bg-[#0a0a0c] w-fit shadow-2xl border border-white/5 group-hover:scale-110 group-hover:shadow-primary/20 transition-all duration-500">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors font-headline">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-lg">{description}</p>
    </div>
  );
}

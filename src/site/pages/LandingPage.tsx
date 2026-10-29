import { useEffect } from "react";
import { SiteLayout } from "../SiteLayout";
import { Hero } from "../sections/Hero";
import { Stats } from "../sections/Stats";
import { Problem } from "../sections/Problem";
import { HowItWorks } from "../sections/HowItWorks";
import { DaySimulator } from "../sections/DaySimulator";
import { Product } from "../sections/Product";
import { Platform } from "../sections/Platform";
import { Features } from "../sections/Features";
import { Audience } from "../sections/Audience";
import { DriverApp } from "../sections/DriverApp";
import { Onboarding } from "../sections/Onboarding";
import { Pricing } from "../sections/Pricing";
import { Security } from "../sections/Security";
import { FAQ } from "../sections/FAQ";
import { FinalCTA } from "../sections/FinalCTA";

export default function LandingPage() {
  useEffect(() => {
    document.title = "Na Hora Frota — Sua frota no mapa, suas entregas na hora";
  }, []);
  return (
    <SiteLayout>
      <Hero />
      <Stats />
      <Problem />
      <HowItWorks />
      <DaySimulator />
      <Product />
      <Platform />
      <Features />
      <Audience />
      <DriverApp />
      <Onboarding />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
    </SiteLayout>
  );
}

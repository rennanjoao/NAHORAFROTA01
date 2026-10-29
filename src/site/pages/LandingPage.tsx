import { useEffect } from "react";
import { SiteLayout } from "../SiteLayout";
import { Hero } from "../sections/Hero";
import { Platforms } from "../sections/Platforms";
import { Numbers } from "../sections/Numbers";
import { Problem } from "../sections/Problem";
import { HowItWorks } from "../sections/HowItWorks";
import { Product } from "../sections/Product";
import { Comparison } from "../sections/Comparison";
import { Audience } from "../sections/Audience";
import { DriverApp } from "../sections/DriverApp";
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
      <Platforms />
      <Numbers />
      <Problem />
      <HowItWorks />
      <Product />
      <Comparison />
      <Audience />
      <DriverApp />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
    </SiteLayout>
  );
}

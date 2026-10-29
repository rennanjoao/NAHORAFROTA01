import { useEffect } from "react";
import { SiteLayout } from "../SiteLayout";
import { Hero } from "../sections/Hero";
import { Ticker } from "../components/Ticker";
import { Problem } from "../sections/Problem";
import { Product } from "../sections/Product";
import { HowItWorks } from "../sections/HowItWorks";
import { DriverApp } from "../sections/DriverApp";
import { Comparison } from "../sections/Comparison";
import { Audience } from "../sections/Audience";
import { Pricing } from "../sections/Pricing";
import { Security } from "../sections/Security";
import { FAQ } from "../sections/FAQ";
import { FinalCTA } from "../sections/FinalCTA";

export default function LandingPage() {
  useEffect(() => {
    document.title = "Na Hora Frota — Sua frota em tempo real";
  }, []);
  return (
    <SiteLayout>
      <Hero />
      <Ticker />
      <Problem />
      <Product />
      <HowItWorks />
      <DriverApp />
      <Comparison />
      <Audience />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
    </SiteLayout>
  );
}

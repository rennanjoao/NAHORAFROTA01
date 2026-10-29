import { useEffect } from "react";
import { SiteLayout } from "../SiteLayout";
import { Hero } from "../sections/Hero";
import { HeroDock } from "../sections/HeroDock";
import { SmoothScroll } from "../motion/SmoothScroll";
import { Grain } from "../motion/Grain";
import { Ticker } from "../components/Ticker";
import { Problem } from "../sections/Problem";
import { Product } from "../sections/Product";
import { HowItWorks } from "../sections/HowItWorks";
import { DriverApp } from "../sections/DriverApp";
import { Numbers } from "../sections/Numbers";
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
    <SmoothScroll>
      <Grain />
      <SiteLayout>
        <Hero />
        <HeroDock />
        <Ticker />
      <Problem />
      <Product />
      <HowItWorks />
      <DriverApp />
      <Numbers />
      <Comparison />
      <Audience />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
      </SiteLayout>
    </SmoothScroll>
  );
}

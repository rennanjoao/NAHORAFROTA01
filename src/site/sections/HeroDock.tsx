import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, useSpring } from "framer-motion";
import { DashboardMockup } from "../components/mockups/DashboardMockup";
import { PhoneMockup } from "../components/mockups/PhoneMockup";

/**
 * O painel "encaixa" na tela conforme a pagina rola: chega deitado em
 * perspectiva e se ergue ate ficar de frente, em tamanho grande.
 */
export function HeroDock() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 95%", "start 25%"] });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const rotateX = useTransform(p, [0, 1], [26, 0]);
  const scale = useTransform(p, [0, 1], [0.9, 1]);
  const y = useTransform(p, [0, 1], [60, 0]);
  const phoneY = useTransform(p, [0, 1], [140, -20]);
  const phoneRotate = useTransform(p, [0, 1], [10, -6]);
  const glow = useTransform(p, [0, 1], [0, 1]);

  return (
    <section className="relative -mt-24 pb-12 lg:-mt-32 lg:pb-24" aria-label="Painel do gestor em destaque">
      <div className="container">
        <div ref={ref} className="perspective-1600 relative mx-auto max-w-[1060px]">
          <motion.div
            style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 100%" }}
            className="relative will-change-transform"
          >
            <motion.div aria-hidden="true" style={reduce ? undefined : { opacity: glow }} className="absolute -inset-x-10 -bottom-16 -top-6 -z-10 rounded-[40px] bg-brand/10 blur-3xl" />
            <DashboardMockup className="shadow-[0_40px_120px_-30px_rgba(0,0,0,0.75)]" />
          </motion.div>
          <motion.div
            className="absolute bottom-[-96px] right-[-56px] hidden w-[190px] lg:block xl:right-[-128px] xl:w-[214px]"
            style={reduce ? undefined : { y: phoneY, rotate: phoneRotate }}
          >
            <PhoneMockup className="w-full shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

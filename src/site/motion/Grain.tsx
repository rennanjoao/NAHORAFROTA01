/** Grao de filme bem sutil sobre a pagina inteira (so textura; sem interacao). */
export function Grain() {
  return (
    <svg aria-hidden="true" className="grain pointer-events-none fixed inset-0 z-[60] h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <filter id="nhf-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#nhf-grain)" />
    </svg>
  );
}

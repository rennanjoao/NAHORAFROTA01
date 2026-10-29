import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Manual da marca: Inter (texto/interface), Space Grotesk (titulos e dados).
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        heading: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        data: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        // Verde vivo da marca para detalhes decorativos (nunca texto em fundo claro).
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          // Site: verde como texto (escuro no claro) e fundo suave.
          text: "hsl(var(--brand-text))",
          soft: "hsl(var(--brand-soft))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        overlay: "hsl(var(--overlay) / var(--overlay-opacity))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        idle: {
          DEFAULT: "hsl(var(--idle))",
          foreground: "hsl(var(--idle-foreground))",
        },
        // Paleta da marca (brand/tokens/tailwind.colors.js)
        nhf: {
          green: "#04E8A4",
          "green-deep": "#0B6B4F",
          "green-tint": "#0F3D30",
          "green-dark": "#00B37E",
          ink: "#080808",
          graphite: "#141617",
          lead: "#2A2D30",
          signal: "#8A9199",
          mist: "#F2F4F5",
          alert: "#FFC53D",
          late: "#FF4D4F",
          info: "#3B9CFF",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      // Raio 2026: cartoes 12px, controles 10px, chips 8px. Um token so (--radius).
      borderRadius: {
        "3xl": "calc(var(--radius) + 12px)",
        "2xl": "calc(var(--radius) + 8px)",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm), var(--highlight)",
        DEFAULT: "var(--shadow-sm), var(--highlight)",
        md: "var(--shadow-md), var(--highlight)",
        lg: "var(--shadow-lg), var(--highlight)",
        xl: "var(--shadow-xl), var(--highlight)",
        "2xl": "var(--shadow-xl), var(--highlight)",
        // Site: mockups "levantados".
        lift: "0 24px 60px -24px rgb(0 0 0 / 0.5)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        DEFAULT: "var(--duration)",
        slow: "var(--duration-slow)",
      },
      spacing: {
        topbar: "var(--topbar-height)",
        "bottom-nav": "var(--bottom-nav-height)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.25s var(--ease-out)",
        "accordion-up": "accordion-up 0.2s var(--ease-out)",
        "collapsible-down": "collapsible-down 0.25s var(--ease-out)",
        "collapsible-up": "collapsible-up 0.2s var(--ease-out)",
        "fade-in": "fade-in 0.36s var(--ease-out) backwards",
        "slide-in-left": "slide-in-left 0.36s var(--ease-out) backwards",
        "scale-in": "scale-in 0.24s var(--ease-out) backwards",
        "pop-in": "pop-in 0.32s var(--ease-spring) both",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

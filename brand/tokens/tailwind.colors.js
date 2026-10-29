// Na Hora Frota — bloco de cores para tailwind.config.ts (theme.extend.colors)
// e variáveis HSL para o src/index.css (padrão shadcn/ui).
//
// 1) No tailwind.config.ts, dentro de theme.extend.colors:
export const nhfColors = {
  nhf: {
    green: '#04E8A4',
    'green-deep': '#0B6B4F',
    'green-tint': '#0F3D30',
    'green-dark': '#00B37E',
    ink: '#080808',
    graphite: '#141617',
    lead: '#2A2D30',
    signal: '#8A9199',
    mist: '#F2F4F5',
    alert: '#FFC53D',
    late: '#FF4D4F',
    info: '#3B9CFF',
  },
};

// 2) No src/index.css, substitua os valores das variáveis do tema (modo escuro = padrão da marca):
export const nhfCssVarsDark = `
  --background: 0 0% 3%;            /* #080808 */
  --foreground: 0 0% 100%;
  --card: 200 7% 8%;                /* #141617 */
  --card-foreground: 0 0% 100%;
  --primary: 162 97% 46%;           /* #04E8A4 Verde Na Hora */
  --primary-foreground: 0 0% 3%;
  --secondary: 210 7% 18%;          /* #2A2D30 */
  --secondary-foreground: 0 0% 100%;
  --muted: 210 7% 18%;
  --muted-foreground: 212 7% 57%;   /* #8A9199 */
  --accent: 162 97% 46%;
  --accent-foreground: 0 0% 3%;
  --destructive: 359 100% 65%;      /* #FF4D4F */
  --destructive-foreground: 0 0% 100%;
  --success: 162 97% 46%;
  --warning: 42 100% 62%;           /* #FFC53D */
  --info: 217 100% 62%;             /* #3B9CFF */
  --border: 210 7% 18%;
  --input: 210 7% 18%;
  --ring: 162 97% 46%;
  --radius: 0.25rem;
`;

// 3) Modo claro (documentos, relatórios):
export const nhfCssVarsLight = `
  --background: 0 0% 100%;
  --foreground: 0 0% 3%;
  --card: 0 0% 100%;
  --primary: 162 97% 46%;
  --primary-foreground: 0 0% 3%;
  --secondary: 200 13% 95%;         /* #F2F4F5 */
  --secondary-foreground: 0 0% 3%;
  --muted: 200 13% 95%;
  --muted-foreground: 210 7% 38%;
  --accent: 162 81% 23%;            /* #0B6B4F verde como texto */
  --accent-foreground: 0 0% 100%;
  --border: 200 8% 90%;
  --ring: 162 81% 23%;
`;

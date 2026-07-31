export const theme = {
  colors: {
    bg: '#0B0E13',
    surface: '#141922',
    surfaceAlt: '#1C2430',
    border: '#2A3441',
    text: '#E6EDF3',
    textDim: '#8B98A9',
    // MLB-ish palette
    accent: '#0A5BA0', // deep baseball blue
    yes: '#2E9E5B', // green
    no: '#D8534F', // red
    warn: '#E0A030',
    danger: '#D8534F',
  },
  radius: { sm: 8, md: 12, lg: 16 },
  space: (n: number) => n * 4,
} as const;

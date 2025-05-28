import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        earth: {
          50: "#f6f4f1",
          100: "#e9e5df",
          200: "#d5cdc0",
          300: "#bfb19e",
          400: "#a89379",
          500: "#97816a",
          600: "#7d6a58",
          700: "#65564a",
          800: "#52473e",
          900: "#433c35",
          950: "#272320",
        },
        sage: {
          50: "#f4f6f1",
          100: "#e5e9df",
          200: "#cdd5c0",
          300: "#b1bf9e",
          400: "#93a879",
          500: "#7d9265",
          600: "#667a52",
          700: "#526544",
          800: "#43523a",
          900: "#394332",
          950: "#1e241a",
        },
        clay: {
          50: "#fbf7f5",
          100: "#f5ebe6",
          200: "#ead6cc",
          300: "#ddb9a7",
          400: "#cc9579",
          500: "#c07c5b",
          600: "#b06548",
          700: "#92503c",
          800: "#774335",
          900: "#633a30",
          950: "#351c17",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
} satisfies Config;

export default config;

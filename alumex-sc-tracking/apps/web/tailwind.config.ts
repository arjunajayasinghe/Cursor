import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172b42",
        sub: "#566980",
        muted: "#65758a",
        blue: {
          DEFAULT: "#065db8",
          primary: "#0767c7",
          hover: "#0056a9",
          soft: "#e8f2ff",
          pale: "#eaf3ff",
        },
        line: "#dce5ef",
        page: "#f3f6fa",
        amber: {
          soft: "#fff3d9",
          ink: "#83550e",
        },
        green: {
          soft: "#e5f6eb",
          ink: "#17613e",
        },
        red: {
          soft: "#fbe9e8",
          ink: "#a53231",
        },
      },
      boxShadow: {
        panel: "0 2px 3px #193f6610",
        drawer: "-9px 0 40px #112d4a29",
      },
      borderRadius: {
        panel: "11px",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex)", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

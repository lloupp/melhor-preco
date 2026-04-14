import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f5f1e8",
        paper: "#fffaf0",
        ink: "#1d2a2f",
        accent: "#0d7a67",
        danger: "#c4552d",
        warning: "#d08a11",
        success: "#2d7e3f",
        line: "#d7cec1",
      },
      boxShadow: {
        card: "0 18px 45px rgba(39, 52, 59, 0.08)",
      },
      fontFamily: {
        display: ["Trebuchet MS", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

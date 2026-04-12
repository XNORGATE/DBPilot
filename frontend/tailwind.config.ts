import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page:     "var(--bg-page)",
        card:     "var(--bg-card)",
        surface:  "var(--bg-surface)",
        input:    "var(--bg-input)",
        accent:   "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-subtle": "var(--accent-subtle)",
        success:  "var(--success)",
        "success-subtle": "var(--success-subtle)",
        "success-text": "var(--success-text)",
        warning:  "var(--warning)",
        "warning-subtle": "var(--warning-subtle)",
        "warning-text": "var(--warning-text)",
        high:     "var(--high)",
        "high-subtle": "var(--high-subtle)",
        "high-text": "var(--high-text)",
        danger:   "var(--danger)",
        "danger-subtle": "var(--danger-subtle)",
        "danger-text": "var(--danger-text)",
        t1: "var(--text-primary)",
        t2: "var(--text-secondary)",
        t3: "var(--text-tertiary)",
        t4: "var(--text-disabled)",
        "border-s": "var(--border-subtle)",
        "border-d": "var(--border-default)",
      },
      borderWidth: {
        "0.5": "0.5px",
      },
    },
  },
  plugins: [],
};
export default config;

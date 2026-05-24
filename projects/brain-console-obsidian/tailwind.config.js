/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        // Brain Console dark cockpit palette
        // Primary backgrounds
        "bc-bg": {
          primary: "#0a0e27",      // Deep navy
          surface: "#1a1f3a",      // Navy surface
          secondary: "#2a2f4a",    // Navy-gray
          muted: "#0f1320",        // Darkest
          DEFAULT: "#0a0e27",
        },
        // Text colors
        "bc-text": {
          primary: "#e5e7eb",      // Light gray
          secondary: "#9ca3af",    // Medium gray
          muted: "#6b7280",        // Muted gray
          DEFAULT: "#e5e7eb",
        },
        // Status colors
        "bc-status": {
          ok: "#4ade80",           // Green
          warning: "#facc15",      // Amber
          error: "#ef4444",        // Red
          review: "#f59e0b",       // Orange (maintenance/review)
          preview: "#ff6b3d",      // Orange (preview-only)
          disabled: "#9ca3af",     // Gray
        },
        // Accent - warm orange for actions & alerts
        "bc-accent": {
          DEFAULT: "#ff6b3d",      // Primary accent
          hover: "#e55a2c",        // Darker on hover
          faded: "rgba(255, 107, 61, 0.2)",  // 20% opacity
          DEFAULT: "#ff6b3d",
        },
        // Borders
        "bc-border": {
          default: "#2d3354",      // Standard border
          hover: "#4a4a4a",        // Hover state
          strong: "#3d4558",       // Strong emphasis
          DEFAULT: "#2d3354",
        },
      },
      spacing: {
        // Brain Console spacing scale (4px base unit)
        xs: "4px",      // 1x
        sm: "8px",      // 2x
        md: "12px",     // 3x
        lg: "16px",     // 4x
        xl: "20px",     // 5x
        "2xl": "24px",  // 6x
      },
      borderRadius: {
        // Brain Console dark cockpit aesthetic (subtle, not rounded)
        DEFAULT: "4px",
        sm: "2px",
        md: "4px",
        lg: "6px",
      },
      fontSize: {
        // Typography scale from design spec
        "cmd-bar": ["0.95rem", { lineHeight: "1.4", fontWeight: "700" }],
        "section-header": ["0.75rem", { lineHeight: "1.2", fontFamily: "monospace" }],
        "card-title": ["0.9rem", { lineHeight: "1.4", fontWeight: "600" }],
        "card-body": ["0.85rem", { lineHeight: "1.5" }],
        "system-data": ["0.85rem", { lineHeight: "1.4", fontFamily: "monospace" }],
        "label": ["0.72rem", { lineHeight: "1.2", fontFamily: "monospace" }],
        "pill": ["0.75rem", { lineHeight: "1.2", fontFamily: "monospace" }],
        "activity": ["0.75rem", { lineHeight: "1.4", fontFamily: "monospace" }],
      },
      boxShadow: {
        // Card shadow from spec
        "card": "0 2px 8px rgba(0, 0, 0, 0.3)",
        DEFAULT: "0 2px 8px rgba(0, 0, 0, 0.3)",
      },
      transitionDuration: {
        "100": "100ms",
        "150": "150ms",
        "200": "200ms",
      },
    },
  },
  plugins: [
    require("tailwindcss/plugin")(function ({ addUtilities }) {
      addUtilities({
        // Brain Console semantic utilities
        ".bc-card": {
          backgroundColor: "#1a1f3a",
          borderColor: "#2d3354",
          borderWidth: "1px",
          borderRadius: "4px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        },
        ".bc-card-hover": {
          backgroundColor: "rgba(26, 31, 58, 0.8)",
          borderColor: "#3d4558",
          transition: "all 150ms",
        },
        ".bc-text": {
          color: "#e5e7eb",
        },
        ".bc-text-secondary": {
          color: "#9ca3af",
        },
      });
    }),
  ],
};

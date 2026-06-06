// ─────────────────────────────────────────────
// SmartProgress — Design System / Theme
// Modern Dark Gym Aesthetic
// ─────────────────────────────────────────────

export const colors = {
    // Backgrounds
    background: "#0D0D0D",
    surface: "#1A1A1A",
    surfaceLight: "#252525",
    surfaceElevated: "#2E2E2E",

    // Accent
    accent: "#3B82F6",
    accentDark: "#2563EB",
    accentMuted: "rgba(59, 130, 246, 0.15)",
    accentFill: "rgba(59, 130, 246, 0.05)",
    accentSubtle: "rgba(59, 130, 246, 0.08)",
    accentBorder: "rgba(59, 130, 246, 0.20)",

    // Text
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",

    // Status
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    errorSubtle: "rgba(239, 68, 68, 0.08)",
    errorBorder: "rgba(239, 68, 68, 0.20)",
    info: "#3B82F6",

    // Border
    border: "#2A2A2A",
    borderLight: "#3A3A3A",

    // Tab Bar
    tabBarBg: "#111111",
    tabBarInactive: "#6B7280",
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
} as const;

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
} as const;

export const fontSize = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    display: 30,
    xxxl: 32,
    hero: 40,
} as const;

export const fontWeight = {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
};

export const lineHeight = {
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
} as const;

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors as baseColors } from "../constants/theme";

const THEME_STORAGE_KEY = "@smartprogress_theme_accent";
const THEME_MODE_STORAGE_KEY = "@smartprogress_theme_mode";

const DEFAULT_ACCENT = "#3B82F6";
export type ThemeMode = "dark" | "light";

type ColorPalette = Record<keyof typeof baseColors, string>;

const lightBaseColors: ColorPalette = {
    ...baseColors,
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceLight: "#F1F5F9",
    surfaceElevated: "#E2E8F0",
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    border: "#E2E8F0",
    borderLight: "#CBD5E1",
    tabBarBg: "#FFFFFF",
    tabBarInactive: "#94A3B8",
};

// Helper to adjust hex color brightness or opacity
const hexToRgb = (hex: string) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const hexFull = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexFull);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

// Helper to darken a hex color by a percentage (0-1)
const darkenHex = (hex: string, amount: number) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    
    const r = Math.max(0, Math.floor(rgb.r * (1 - amount)));
    const g = Math.max(0, Math.floor(rgb.g * (1 - amount)));
    const b = Math.max(0, Math.floor(rgb.b * (1 - amount)));
    
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
};

export const generateColors = (accentHex: string, mode: ThemeMode = "dark") => {
    const rgb = hexToRgb(accentHex);
    const palette = mode === "light" ? lightBaseColors : baseColors;
    let accentMuted = "rgba(59, 130, 246, 0.15)";
    
    if (rgb) {
        accentMuted = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
    }
    
    const accentDark = darkenHex(accentHex, 0.2); // 20% darker
    
    return {
        ...palette,
        accent: accentHex,
        accentDark,
        accentMuted,
    };
};

type ThemeContextType = {
    colors: ReturnType<typeof generateColors>;
    themeMode: ThemeMode;
    setAccentColor: (color: string) => Promise<void>;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT);
    const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");

    useEffect(() => {
        const loadTheme = async () => {
            try {
                const storedAccent = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (storedAccent) {
                    setAccentColorState(storedAccent);
                }
                const storedMode = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
                if (storedMode === "light" || storedMode === "dark") {
                    setThemeModeState(storedMode);
                }
            } catch (error) {
                console.error("Failed to load theme color from storage", error);
            }
        };
        loadTheme();
    }, []);

    const setAccentColor = async (color: string) => {
        setAccentColorState(color);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, color);
        } catch (error) {
            console.error("Failed to save theme color to storage", error);
        }
    };

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
        } catch (error) {
            console.error("Failed to save theme mode to storage", error);
        }
    };

    const currentColors = generateColors(accentColor, themeMode);

    return (
        <ThemeContext.Provider value={{ colors: currentColors, themeMode, setAccentColor, setThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        // Provide a fallback so it doesn't crash if used outside provider by mistake during dev
        return { colors: generateColors(DEFAULT_ACCENT), themeMode: "dark" as ThemeMode, setAccentColor: async () => {}, setThemeMode: async () => {} };
    }
    return context;
};

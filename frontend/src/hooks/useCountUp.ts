// ─────────────────────────────────────────────
// useCountUp — Sayı sayma animasyonu
// 0'dan target değere setInterval ile sayar
// useFocusEffect ile her focus'ta sıfırlanır
// ─────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

interface CountUpOptions {
    /** Hedefe ulaşma süresi ms cinsinden */
    duration?: number;
    /** Küçük sayılarda daha az adım, büyüklerde daha fazla */
    steps?: number;
}

export function useCountUp(target: number, options: CountUpOptions = {}) {
    const { duration = 800, steps = 20 } = options;
    const [value, setValue] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useFocusEffect(
        useCallback(() => {
            setValue(0);

            if (target <= 0) {
                setValue(0);
                return;
            }

            const interval = duration / steps;
            const increment = target / steps;
            let current = 0;

            timerRef.current = setInterval(() => {
                current += increment;
                if (current >= target) {
                    setValue(target);
                    if (timerRef.current) clearInterval(timerRef.current);
                } else {
                    setValue(Math.round(current));
                }
            }, interval);

            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
            };
        }, [target, duration, steps])
    );

    return value;
}

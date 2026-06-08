import { useEffect, useRef, useState } from "react";

interface CountUpOptions {
    duration?: number;
    steps?: number;
}

export function useCountUp(target: number, options: CountUpOptions = {}) {
    const { duration = 800, steps = 20 } = options;
    const [value, setValue] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setValue(0);

        if (target <= 0) {
            setValue(0);
            return undefined;
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
    }, [target, duration, steps]);

    return value;
}

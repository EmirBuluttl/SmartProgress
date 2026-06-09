// ─────────────────────────────────────────────────────────────────────────────
// useStaleDataGuard — Tab ekranları için TTL + cache sürüm tabanlı yeniden
// yükleme engeli.
//
// Problem: Bu uygulama custom ScrollView tab navigator kullanıyor. React
// Navigation useFocusEffect'i tab bazında değil, stack seviyesinde tetikliyor.
// Kullanıcı herhangi bir stack ekranından (ProgramDetail, WorkoutDetail vb.)
// geri döndüğünde, mount edilmiş tüm tab ekranlarının useFocusEffect'i
// EŞ ZAMANLI tetikleniyor → HomeScreen + MyProgressScreen + ProfileScreen
// aynı anda 10+ API çağrısı ve 15+ setState → JS thread çöküyor.
//
// Çözüm: Her ekran için shouldReload() + markLoaded() çifti.
// shouldReload() → true yalnızca şu durumlarda:
//   1. Hiç yüklenmemişse (ilk açılış)
//   2. TTL süresi dolmuşsa
//   3. Workout cache sürümü değişmişse (yeni antrenman kaydedildi)
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from "react";
import { getWorkoutCacheVersion } from "../services/workoutCacheService";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 dakika

export function useStaleDataGuard(ttlMs = DEFAULT_TTL_MS) {
    const lastLoadAtRef = useRef<number>(0);
    const lastVersionRef = useRef<number>(-1); // -1 = hiç yüklenmedi

    /**
     * Ekranın verisinin yeniden yüklenmesi gerekip gerekmediğini kontrol eder.
     * Bu fonksiyon stabil referanslı ref'ler kullanır, her render'da yeniden
     * oluşmaz.
     */
    function shouldReload(): boolean {
        const now = Date.now();
        const currentVersion = getWorkoutCacheVersion();

        // Hiç yüklenmemiş
        if (lastLoadAtRef.current === 0) return true;

        // Yeni antrenman kaydedildi (cache invalidate edildi)
        if (currentVersion !== lastVersionRef.current) return true;

        // TTL doldu
        if (now - lastLoadAtRef.current > ttlMs) return true;

        return false;
    }

    /**
     * Yükleme tamamlandığında çağır. Sonraki shouldReload() çağrısında
     * bu yüklemeyi referans alır.
     */
    function markLoaded(): void {
        lastLoadAtRef.current = Date.now();
        lastVersionRef.current = getWorkoutCacheVersion();
    }

    return { shouldReload, markLoaded };
}

// ─────────────────────────────────────────────
// SmartProgress — Dummy Data
// Test verileri — API bağlantısından önce kullanılır
// ─────────────────────────────────────────────

export const dummyUser = {
    id: "usr-001",
    firstName: "Emir",
    lastName: "Bulut",
    email: "emir@smartprogress.app",
    role: "ATHLETE",
    avatarUrl: null,
    settings: {
        is_auto_suggest_enabled: false,
    },
};

export const dummyStats = {
    totalWorkouts: 47,
    currentStreak: 5,
    totalPRs: 12,
    thisWeekWorkouts: 3,
};

export const dummyRecentWorkouts = [
    {
        id: "wl-001",
        title: "Upper Body Power",
        sportName: "Fitness",
        logDate: "2026-03-02",
        data: {
            exercises: [
                { name: "Bench Press", sets: [{ reps: 8, weight: 100, unit: "kg" }] },
                { name: "Overhead Press", sets: [{ reps: 10, weight: 60, unit: "kg" }] },
            ],
            totalDuration: 4500,
        },
    },
    {
        id: "wl-002",
        title: "Leg Day",
        sportName: "Fitness",
        logDate: "2026-03-01",
        data: {
            exercises: [
                { name: "Squat", sets: [{ reps: 6, weight: 140, unit: "kg" }] },
                { name: "Romanian Deadlift", sets: [{ reps: 10, weight: 100, unit: "kg" }] },
            ],
            totalDuration: 3600,
        },
    },
    {
        id: "wl-003",
        title: "Morning Run",
        sportName: "Koşu",
        logDate: "2026-02-28",
        data: {
            distance: 8.5,
            distanceUnit: "km",
            duration: 2550,
            avgPace: "5:00",
        },
    },
];

export const dummyPRs = [
    { exercise: "Bench Press", weight: 120, unit: "kg", date: "2026-02-25" },
    { exercise: "Squat", weight: 160, unit: "kg", date: "2026-02-20" },
    { exercise: "Deadlift", weight: 200, unit: "kg", date: "2026-02-15" },
    { exercise: "Overhead Press", weight: 75, unit: "kg", date: "2026-02-10" },
];

export const dummyWeeklyVolume = {
    labels: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
    datasets: [
        {
            data: [4200, 0, 5800, 3100, 0, 6500, 2200],
        },
    ],
};

export const dummyPublicPrograms = [
    {
        id: "prog-001",
        name: "PPL Hypertrophy",
        description: "Push/Pull/Legs split for maximum muscle growth",
        isPublic: true,
        user: { firstName: "Ali", lastName: "Yılmaz" },
    },
    {
        id: "prog-002",
        name: "5x5 Strength",
        description: "Classic strength program with compound lifts",
        isPublic: true,
        user: { firstName: "Deniz", lastName: "Kara" },
    },
    {
        id: "prog-003",
        name: "HIIT Fat Burner",
        description: "High intensity interval training for cutting",
        isPublic: true,
        user: { firstName: "Selin", lastName: "Aydın" },
    },
];

export const dummyMyPrograms = [
    {
        id: "prog-010",
        name: "My Custom PPL",
        description: "Kendi push/pull/legs programım",
        isPublic: false,
    },
    {
        id: "prog-011",
        name: "Summer Cut 2026",
        description: "Yaz kesimi için 8 haftalık program",
        isPublic: true,
    },
];

export const dummySuggestion = {
    exerciseName: "Bench Press",
    lastWeight: 100,
    lastReps: 12,
    suggestedWeight: 102.5,
    unit: "kg",
    reasoning:
        "Son sette 12 tekrar yapıldı (hedef: 12). Ağırlık artırılması önerilir.",
};

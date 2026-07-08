import { queryClient } from "./queryClient";
import { updateProgramDayInCache } from "./programCacheService";

function setDayIndex(program: any, programId: string, currentDayIndex: number) {
    if (!program || program.id !== programId) return program;
    return { ...program, currentDayIndex };
}

export function applyProgramDayIndex(programId: string, currentDayIndex: number) {
    updateProgramDayInCache(programId, currentDayIndex);

    queryClient.setQueryData(["programs", "mine"], (programs: any[] | undefined) => {
        if (!Array.isArray(programs)) return programs;
        return programs.map((program) => setDayIndex(program, programId, currentDayIndex));
    });

    queryClient.setQueryData(["programs", "detail", programId], (program: any) =>
        setDayIndex(program, programId, currentDayIndex)
    );
}

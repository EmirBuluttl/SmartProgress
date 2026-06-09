// ─────────────────────────────────────────────
// SmartProgress — usePrograms Hooks (TanStack Query)
// Hooks for managing user and public programs with automatic cache invalidation
// ─────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { programApi } from "../services/api";

export function useMyProgramsQuery() {
    return useQuery({
        queryKey: ["programs", "mine"],
        queryFn: async () => {
            const res = await programApi.listMine();
            return res.data.programs || [];
        },
    });
}

export function useProgramDetailQuery(programId: string | undefined) {
    return useQuery({
        queryKey: ["programs", "detail", programId],
        queryFn: async () => {
            if (!programId) throw new Error("Program ID is required");
            const res = await programApi.getById(programId);
            return res.data;
        },
        enabled: !!programId,
    });
}

export function useCopyToLibraryMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (programId: string) => {
            const res = await programApi.copyToLibrary(programId);
            return res.data;
        },
        onSuccess: () => {
            // Invalidate the entire programs queries space (lists and details)
            queryClient.invalidateQueries({ queryKey: ["programs"] });
        },
    });
}

export function useCreateProgramMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            name: string;
            description?: string;
            isPublic?: boolean;
            frequency?: number;
            data?: any;
        }) => {
            const res = await programApi.create(data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["programs"] });
        },
    });
}

export function useUpdateProgramMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            data,
        }: {
            id: string;
            data: {
                name?: string;
                description?: string;
                isPublic?: boolean;
                frequency?: number;
                data?: any;
            };
        }) => {
            const res = await programApi.update(id, data);
            return res.data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["programs", "mine"] });
            queryClient.invalidateQueries({ queryKey: ["programs", "detail", variables.id] });
        },
    });
}

export function useDeleteProgramMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (programId: string) => {
            const res = await programApi.deleteProgram(programId);
            return res.data;
        },
        onSuccess: (data, programId) => {
            queryClient.invalidateQueries({ queryKey: ["programs", "mine"] });
            queryClient.invalidateQueries({ queryKey: ["programs", "detail", programId] });
        },
    });
}

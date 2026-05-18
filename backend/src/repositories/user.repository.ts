// ─────────────────────────────────────────────
// User Repository
// ─────────────────────────────────────────────
import { Prisma, User } from "@prisma/client";
import prisma from "../config/prisma";

export class UserRepository {
    /**
     * Find a user by email address.
     */
    async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    /**
     * Find a user by ID.
     */
    async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    async findByPasswordResetTokenHash(tokenHash: string): Promise<User | null> {
        return prisma.user.findFirst({
            where: { passwordResetTokenHash: tokenHash },
        });
    }

    /**
     * Create a new user with optional settings.
     */
    async create(data: Prisma.UserCreateInput): Promise<User> {
        return prisma.user.create({
            data,
        });
    }

    /**
     * Update user by ID.
     */
    async updateById(
        id: string,
        data: Prisma.UserUpdateInput,
    ): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        });
    }
}

export const userRepository = new UserRepository();

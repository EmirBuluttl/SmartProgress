import crypto from "crypto";
import { env } from "../config/env";
import { UnauthorizedError, ValidationError } from "../utils/errors";

type JwtHeader = {
    alg?: string;
    kid?: string;
    typ?: string;
};

type Jwk = {
    kty?: string;
    kid?: string;
    alg?: string;
    use?: string;
    n?: string;
    e?: string;
};

type JwksCache = {
    expiresAt: number;
    keys: Jwk[];
};

export type SocialProvider = "google" | "apple";

export type VerifiedSocialIdentity = {
    provider: SocialProvider;
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
};

const jwksCache = new Map<string, JwksCache>();

function decodeBase64Url(input: string): Buffer {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, "=");
    return Buffer.from(padded, "base64");
}

function decodeJwtPart<T>(part: string): T {
    try {
        return JSON.parse(decodeBase64Url(part).toString("utf8")) as T;
    } catch {
        throw new UnauthorizedError("Invalid social login token.");
    }
}

function normalizeAudience(aud: unknown): string[] {
    if (Array.isArray(aud)) return aud.map(String);
    if (typeof aud === "string") return [aud];
    return [];
}

function readBooleanClaim(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return false;
}

async function fetchJwks(url: string): Promise<Jwk[]> {
    const cached = jwksCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.keys;

    const response = await fetch(url);
    if (!response.ok) {
        throw new UnauthorizedError("Social login keys could not be fetched.");
    }

    const payload = await response.json() as { keys?: Jwk[] };
    const cacheControl = response.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
    const keys = Array.isArray(payload.keys) ? payload.keys : [];

    jwksCache.set(url, {
        keys,
        expiresAt: Date.now() + Math.max(5 * 60 * 1000, maxAgeMs),
    });

    return keys;
}

async function verifySignedJwt(
    token: string,
    jwksUrl: string,
    allowedIssuers: string[],
    allowedAudiences: string[],
): Promise<Record<string, any>> {
    const parts = token.split(".");
    if (parts.length !== 3) {
        throw new UnauthorizedError("Invalid social login token.");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = decodeJwtPart<JwtHeader>(encodedHeader);
    const payload = decodeJwtPart<Record<string, any>>(encodedPayload);

    if (header.alg !== "RS256" || !header.kid) {
        throw new UnauthorizedError("Unsupported social login token.");
    }

    const keys = await fetchJwks(jwksUrl);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
        jwksCache.delete(jwksUrl);
        throw new UnauthorizedError("Social login key was not found.");
    }

    const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const valid = verifier.verify(publicKey, decodeBase64Url(encodedSignature));
    if (!valid) {
        throw new UnauthorizedError("Invalid social login signature.");
    }

    const now = Math.floor(Date.now() / 1000);
    if (!allowedIssuers.includes(String(payload.iss || ""))) {
        throw new UnauthorizedError("Invalid social login issuer.");
    }

    const audiences = normalizeAudience(payload.aud);
    if (!audiences.some((aud) => allowedAudiences.includes(aud))) {
        throw new UnauthorizedError("Invalid social login audience.");
    }

    if (typeof payload.exp !== "number" || payload.exp < now) {
        throw new UnauthorizedError("Social login token has expired.");
    }

    if (typeof payload.iat === "number" && payload.iat > now + 300) {
        throw new UnauthorizedError("Invalid social login token time.");
    }

    if (!payload.sub) {
        throw new UnauthorizedError("Social login token is missing subject.");
    }

    return payload;
}

function getGoogleAudiences() {
    return [
        env.GOOGLE_ANDROID_CLIENT_ID,
        env.GOOGLE_IOS_CLIENT_ID,
        env.GOOGLE_WEB_CLIENT_ID,
    ].filter(Boolean);
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedSocialIdentity> {
    const allowedAudiences = getGoogleAudiences();
    if (!allowedAudiences.length) {
        throw new ValidationError("Google login is not configured.");
    }

    const payload = await verifySignedJwt(
        idToken,
        "https://www.googleapis.com/oauth2/v3/certs",
        ["https://accounts.google.com", "accounts.google.com"],
        allowedAudiences,
    );

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    const emailVerified = readBooleanClaim(payload.email_verified);

    return {
        provider: "google",
        providerUserId: String(payload.sub),
        email,
        emailVerified,
        firstName: typeof payload.given_name === "string" ? payload.given_name : null,
        lastName: typeof payload.family_name === "string" ? payload.family_name : null,
        fullName: typeof payload.name === "string" ? payload.name : null,
    };
}

export async function verifyAppleIdentityToken(idToken: string): Promise<VerifiedSocialIdentity> {
    if (!env.APPLE_BUNDLE_ID) {
        throw new ValidationError("Apple login is not configured.");
    }

    const payload = await verifySignedJwt(
        idToken,
        "https://appleid.apple.com/auth/keys",
        ["https://appleid.apple.com"],
        [env.APPLE_BUNDLE_ID],
    );

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    const emailVerified = readBooleanClaim(payload.email_verified) || !!email;

    return {
        provider: "apple",
        providerUserId: String(payload.sub),
        email,
        emailVerified,
    };
}

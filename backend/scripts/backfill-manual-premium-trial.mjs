import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TRIAL_DAYS = 60;

function buildTrialSettings(settings) {
  const current = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings
    : {};
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);
  return {
    ...current,
    pro_trial_started_at: current.pro_trial_started_at || startedAt.toISOString(),
    pro_trial_expires_at: expiresAt.toISOString(),
    pro_trial_source: current.pro_trial_source || "manual_existing_user_promo",
  };
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      subscriptionTier: "FREE",
      subscriptionStatus: "INACTIVE",
    },
    select: {
      id: true,
      email: true,
      settings: true,
    },
  });

  console.log(`[manual-trial-backfill] candidates=${users.length} apply=${APPLY}`);
  users.slice(0, 20).forEach((user) => console.log(`- ${user.email} (${user.id})`));
  if (users.length > 20) console.log(`...and ${users.length - 20} more`);

  if (!APPLY) {
    console.log("[manual-trial-backfill] dry run only. Re-run with --apply to update eligible users.");
    return;
  }

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: "PRO",
        subscriptionStatus: "TRIAL",
        settings: buildTrialSettings(user.settings),
      },
    });
  }

  console.log(`[manual-trial-backfill] updated=${users.length}`);
}

main()
  .catch((error) => {
    console.error("[manual-trial-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

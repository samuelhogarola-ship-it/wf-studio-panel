function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isAuthorizedCronRequest({
  configuredSecret,
  authorization,
  headerSecret,
}) {
  if (!configuredSecret) return false;
  return (
    authorization === `Bearer ${configuredSecret}` ||
    headerSecret === configuredSecret
  );
}

export async function processPendingReminders({
  items,
  claimReminder,
  sendReminder,
  persistReminder,
  releaseClaim,
  now = new Date(),
}) {
  const result = {
    processed: items.length,
    sent: 0,
    skipped: 0,
    failed: [],
  };

  for (const item of items) {
    const client = Array.isArray(item.clients) ? item.clients[0] : item.clients;
    if (!client?.email || !item.reminder_interval_days) {
      result.skipped += 1;
      continue;
    }

    const nextReminder = new Date(
      now.getTime() + item.reminder_interval_days * 24 * 60 * 60 * 1000,
    );
    const nextReminderAt = nextReminder.toISOString().slice(0, 10);

    let claimToken;
    try {
      claimToken = await claimReminder(item.id, {
        expectedNextReminderAt: item.next_reminder_at,
        claimedAt: now.toISOString(),
      });
    } catch (error) {
      result.failed.push({
        id: item.id,
        stage: "claim",
        message: errorMessage(error),
      });
      continue;
    }

    try {
      await sendReminder({ item, client });
    } catch (error) {
      result.failed.push({
        id: item.id,
        stage: "send",
        message: errorMessage(error),
      });
      try {
        await releaseClaim(item.id, {
          claimToken,
        });
      } catch (releaseError) {
        result.failed.push({
          id: item.id,
          stage: "release",
          message: errorMessage(releaseError),
        });
      }
      continue;
    }

    try {
      await persistReminder(item.id, {
        lastReminderSentAt: now.toISOString(),
        nextReminderAt,
        claimToken,
      });
      result.sent += 1;
    } catch (error) {
      result.failed.push({
        id: item.id,
        stage: "persist",
        message: errorMessage(error),
      });
      try {
        await releaseClaim(item.id, {
          claimToken,
        });
      } catch (releaseError) {
        result.failed.push({
          id: item.id,
          stage: "release",
          message: errorMessage(releaseError),
        });
      }
    }
  }

  return result;
}

function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

export function createMonthlyStatReportRepository(database) {
  return {
    async save({ monthKey, label, markdown, siteReports, generatedAt, complete = false }) {
      const result = await database.rpc("save_monthly_stat_report_snapshot", {
        p_month_key: monthKey,
        p_label: label,
        p_markdown: markdown,
        p_site_reports: siteReports,
        p_generated_at: generatedAt,
        p_is_complete: complete,
      });
      const status = checked(result, "Save monthly stat report");
      return {
        storageRef: `supabase:monthly_stat_reports/${monthKey}`,
        preserved: status !== "saved",
        alreadySent: status === "sent",
      };
    },

    async list() {
      const result = await database
        .from("monthly_stat_reports")
        .select("month_key, label, markdown, generated_at")
        .order("month_key", { ascending: false });

      return checked(result, "List monthly stat reports") || [];
    },

    async claimDelivery({ monthKey, claimToken, emailTo }) {
      const result = await database.rpc("claim_monthly_stat_report_delivery_snapshot", {
        p_month_key: monthKey,
        p_claim_token: claimToken,
        p_email_to: emailTo,
      });
      return checked(result, "Claim monthly stat report delivery");
    },

    async completeDelivery({ monthKey, claimToken, sentAt, messageId }) {
      const result = await database.rpc("complete_monthly_stat_report_delivery", {
        p_month_key: monthKey,
        p_claim_token: claimToken,
        p_sent_at: sentAt,
        p_message_id: messageId,
      });
      if (!checked(result, "Complete monthly stat report delivery")) {
        throw new Error("Complete monthly stat report delivery: claim mismatch");
      }
    },

    async releaseDelivery({ monthKey, claimToken, error }) {
      const result = await database.rpc("release_monthly_stat_report_delivery", {
        p_month_key: monthKey,
        p_claim_token: claimToken,
        p_error: error,
      });
      if (!checked(result, "Release monthly stat report delivery")) {
        throw new Error("Release monthly stat report delivery: claim mismatch");
      }
    },
  };
}

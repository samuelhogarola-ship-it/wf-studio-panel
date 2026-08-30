export function metricValue(metric) {
  if (typeof metric === "number" && Number.isFinite(metric)) return metric;
  if (metric && typeof metric.value === "number" && Number.isFinite(metric.value)) {
    return metric.value;
  }
  return 0;
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function aggregateRows(reports, key, limit = 8) {
  const totals = new Map();
  for (const report of reports) {
    for (const row of report[key] || []) {
      const label = String(row.x || "(sin dato)");
      totals.set(label, (totals.get(label) || 0) + metricValue(row.y));
    }
  }
  return [...totals.entries()]
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => b.y - a.y)
    .slice(0, limit);
}

function aggregateSeries(reports) {
  const totals = new Map();
  for (const report of reports) {
    for (const point of report.series?.pageviews || []) {
      const label = String(point.x);
      totals.set(label, (totals.get(label) || 0) + metricValue(point.y));
    }
  }
  return [...totals.entries()]
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => a.x.localeCompare(b.x));
}

function aggregateStats(reports, key) {
  const stats = reports.reduce(
    (total, report) => {
      const source = report[key] || {};
      total.visitors += metricValue(source.visitors);
      total.visits += metricValue(source.visits);
      total.pageviews += metricValue(source.pageviews);
      total.bounces += metricValue(source.bounces);
      total.totalTime += metricValue(source.totaltime);
      return total;
    },
    { visitors: 0, visits: 0, pageviews: 0, bounces: 0, totalTime: 0 },
  );

  return {
    visitors: stats.visitors,
    visits: stats.visits,
    pageviews: stats.pageviews,
    bounceRate: stats.visits > 0 ? (stats.bounces / stats.visits) * 100 : 0,
    averageDuration: stats.visits > 0 ? stats.totalTime / stats.visits : 0,
  };
}

export function buildUmamiAnalyticsView(reports) {
  const healthyReports = reports.filter((report) => report.status === "ok");
  const unavailableSites = reports
    .filter((report) => report.status !== "ok")
    .map((report) => ({ site: report.site, status: report.status, message: report.message }));

  if (healthyReports.length === 0) {
    return {
      status: "unavailable",
      availableSites: 0,
      unavailableSites,
    };
  }

  const current = aggregateStats(healthyReports, "stats");
  const previous = aggregateStats(healthyReports, "previousStats");

  return {
    status: "ok",
    availableSites: healthyReports.length,
    unavailableSites,
    current,
    previous,
    comparisons: {
      visitors: percentChange(current.visitors, previous.visitors),
      visits: percentChange(current.visits, previous.visits),
      pageviews: percentChange(current.pageviews, previous.pageviews),
      bounceRate: percentChange(current.bounceRate, previous.bounceRate),
      averageDuration: percentChange(current.averageDuration, previous.averageDuration),
    },
    series: aggregateSeries(healthyReports),
    topPages: aggregateRows(healthyReports, "topPages"),
    topReferrers: aggregateRows(healthyReports, "topReferrers"),
  };
}

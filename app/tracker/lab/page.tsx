import { parseTrackerDateKey, toTrackerDateKey } from "@/lib/trackerPlanDomain";
import TrackerLabClient from "./TrackerLabClient";
import "./trackerLab.css";

export default async function TrackerLabPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedDate = typeof params.date === "string" ? params.date : null;
  const initialDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    toTrackerDateKey(parseTrackerDateKey(requestedDate)) === requestedDate
    ? requestedDate
    : null;
  return <TrackerLabClient key={initialDate || "today"} initialDate={initialDate} initialNow={new Date().toISOString()} />;
}

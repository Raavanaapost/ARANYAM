import { getViewer } from "@/lib/auth/dal";
import { exportUserData } from "@/lib/services/export";

/** "Download my data": everything the member shared, as a JSON file. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Please log in first.", { status: 401 });
  const data = await exportUserData(viewer.id);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aranyam-my-data-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { getAdminClient, getAuthenticatedUser } from "@/lib/supabaseAdmin";
import { trackerDefaultCategories } from "@/lib/trackerCategories";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminSupabase = getAdminClient();

  if (!adminSupabase) {
    return Response.json(
      { error: "Не настроен серверный ключ Supabase" },
      { status: 500 }
    );
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) return Response.json({ error: "Не выполнен вход" }, { status: 401 });

  const { error: upsertError } = await adminSupabase
    .from("tracker_categories")
    .upsert(trackerDefaultCategories, { onConflict: "slug" });

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 400 });
  }

  const { data: categories, error: selectError } = await adminSupabase
    .from("tracker_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (selectError) {
    return Response.json({ error: selectError.message }, { status: 400 });
  }

  return Response.json({ categories: categories || [] });
}

import { sendPushToUser } from "@/lib/pushServer";
import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function getUserFromRequest(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  request: Request
) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const {
    data: { user },
  } = await adminSupabase.auth.getUser(token);

  return user;
}

export async function POST(request: Request) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin is not configured" }, { status: 500 });
  }

  const user = await getUserFromRequest(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendPushToUser(user.id, {
    title: "Couple Space",
    body: "Тестовое push-уведомление",
    href: "/notifications",
    tag: "push-test",
  });

  return Response.json({ ok: true, ...result });
}

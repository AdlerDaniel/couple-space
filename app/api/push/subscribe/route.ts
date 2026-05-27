import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BrowserPushSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

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

  const subscription = (await request.json()) as BrowserPushSubscription;
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const expirationTime = subscription.expirationTime
    ? new Date(subscription.expirationTime).toISOString()
    : null;

  const { error } = await adminSupabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        expiration_time: expirationTime,
        user_agent: request.headers.get("user-agent"),
        disabled_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json({ error: "Supabase admin is not configured" }, { status: 500 });
  }

  const user = await getUserFromRequest(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) {
    return Response.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

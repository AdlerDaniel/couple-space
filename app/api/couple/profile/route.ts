import {
  getAdminClient,
  getAuthenticatedUser,
  getAuthorizedCouple,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

function getDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const login = user.user_metadata?.login;
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof login === "string" && login.trim()) return login.trim();
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  if (user.email) return user.email.split("@")[0];

  return "Партнёр";
}

async function getUserName(
  adminSupabase: NonNullable<ReturnType<typeof getAdminClient>>,
  userId: string | null
) {
  if (!userId) return "Партнёр";

  const { data } = await adminSupabase.auth.admin.getUserById(userId);
  if (!data.user) return "Партнёр";

  return getDisplayName({
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  });
}

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

  const body = (await request.json()) as { coupleId?: string };

  if (!body.coupleId) {
    return Response.json({ error: "Не передана пара" }, { status: 400 });
  }

  const authorization = await getAuthorizedCouple(adminSupabase, body.coupleId, user.id);
  if (!authorization.couple) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const couple: Couple = authorization.couple;

  const existing = await adminSupabase
    .from("couple_profiles")
    .select("*")
    .eq("couple_id", couple.id)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return Response.json({ error: existing.error.message }, { status: 400 });
  }

  if (existing.data) {
    return Response.json({ profile: existing.data });
  }

  const partnerOne = await getUserName(adminSupabase, couple.partner_one_id);
  const partnerTwo = await getUserName(adminSupabase, couple.partner_two_id);

  const { data: createdProfile, error: profileError } = await adminSupabase
    .from("couple_profiles")
    .upsert(
      {
        couple_id: couple.id,
        partner_one: partnerOne,
        partner_two: partnerTwo,
        start_date: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "couple_id", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 });
  }

  if (createdProfile) return Response.json({ profile: createdProfile });

  const { data: concurrentProfile, error: concurrentError } = await adminSupabase
    .from("couple_profiles")
    .select("*")
    .eq("couple_id", couple.id)
    .single();

  if (concurrentError || !concurrentProfile) {
    return Response.json(
      { error: concurrentError?.message || "Не удалось создать профиль пары" },
      { status: 400 },
    );
  }

  return Response.json({ profile: concurrentProfile });
}

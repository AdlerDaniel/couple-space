import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Couple = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace("Bearer ", "");

  if (!token) {
    return Response.json({ error: "Не выполнен вход" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await adminSupabase.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: "Не удалось проверить пользователя" }, { status: 401 });
  }

  const body = (await request.json()) as { coupleId?: string };

  if (!body.coupleId) {
    return Response.json({ error: "Не передана пара" }, { status: 400 });
  }

  const { data: couple, error: coupleError } = await adminSupabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .eq("id", body.coupleId)
    .single<Couple>();

  if (coupleError || !couple) {
    return Response.json({ error: "Пара не найдена" }, { status: 404 });
  }

  const isMember =
    couple.partner_one_id === user.id || couple.partner_two_id === user.id;

  if (!isMember) {
    return Response.json({ error: "Нет доступа к этой паре" }, { status: 403 });
  }

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

  const { data: profile, error: profileError } = await adminSupabase
    .from("couple_profiles")
    .insert([
      {
        couple_id: couple.id,
        partner_one: partnerOne,
        partner_two: partnerTwo,
        start_date: new Date().toISOString().slice(0, 10),
      },
    ])
    .select()
    .single();

  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 400 });
  }

  return Response.json({ profile });
}

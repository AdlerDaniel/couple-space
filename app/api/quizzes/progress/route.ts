import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const adminSupabase = getAdminClient();

  if (!adminSupabase) {
    return Response.json(
      { error: "Не настроен серверный ключ Supabase" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const coupleId = url.searchParams.get("coupleId");
  const quizId = url.searchParams.get("quizId");

  if (!coupleId) {
    return Response.json({ error: "Не передана пара" }, { status: 400 });
  }

  let query = adminSupabase
    .from("quiz_answers")
    .select("quiz_id, user_id, answers")
    .eq("couple_id", coupleId);

  if (quizId) {
    query = query.eq("quiz_id", quizId);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ answers: data || [] });
}

export async function POST(request: Request) {
  const adminSupabase = getAdminClient();

  if (!adminSupabase) {
    return Response.json(
      { error: "Не настроен серверный ключ Supabase" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    quizId?: string;
    coupleId?: string;
    userId?: string;
    answers?: Record<string, string>;
  };

  if (!body.quizId || !body.coupleId || !body.userId || !body.answers) {
    return Response.json(
      { error: "Не хватает данных для сохранения викторины" },
      { status: 400 }
    );
  }

  const existing = await adminSupabase
    .from("quiz_answers")
    .select("id")
    .eq("quiz_id", body.quizId)
    .eq("couple_id", body.coupleId)
    .eq("user_id", body.userId)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return Response.json({ error: existing.error.message }, { status: 400 });
  }

  const payload = {
    quiz_id: body.quizId,
    couple_id: body.coupleId,
    user_id: body.userId,
    answers: body.answers,
    updated_at: new Date().toISOString(),
  };

  const result = existing.data
    ? await adminSupabase
        .from("quiz_answers")
        .update(payload)
        .eq("id", existing.data.id)
    : await adminSupabase.from("quiz_answers").insert([payload]);

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}

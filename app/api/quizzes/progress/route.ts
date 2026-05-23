import {
  getAdminClient,
  getAuthenticatedUser,
  getAuthorizedCouple,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Не выполнен вход" }, { status: 401 });
  }

  const authorization = await getAuthorizedCouple(adminSupabase, coupleId, user.id);
  if (!authorization.couple) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  let query = adminSupabase
    .from("quiz_answers")
    .select(quizId ? "quiz_id, user_id, answers" : "quiz_id, user_id")
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
    answers?: Record<string, string>;
  };

  if (!body.quizId || !body.coupleId || !body.answers) {
    return Response.json(
      { error: "Не хватает данных для сохранения викторины" },
      { status: 400 }
    );
  }

  const user = await getAuthenticatedUser(adminSupabase, request);
  if (!user) {
    return Response.json({ error: "Не выполнен вход" }, { status: 401 });
  }

  const authorization = await getAuthorizedCouple(adminSupabase, body.coupleId, user.id);
  if (!authorization.couple) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  const existing = await adminSupabase
    .from("quiz_answers")
    .select("id")
    .eq("quiz_id", body.quizId)
    .eq("couple_id", body.coupleId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return Response.json({ error: existing.error.message }, { status: 400 });
  }

  const payload = {
    quiz_id: body.quizId,
    couple_id: body.coupleId,
    user_id: user.id,
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

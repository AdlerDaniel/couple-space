import { enforceRateLimit, isSameOriginRequest, readJsonObject } from "@/lib/apiSecurity";
import { loginToEmail, validateLoginCredentials } from "@/lib/loginAuth";
import { getAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Недопустимый источник запроса" }, { status: 403 });
  }

  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    return Response.json(
      { error: "Регистрация временно недоступна" },
      { status: 500 }
    );
  }

  const rateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "login-signup-ip",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await readJsonObject(request, 4 * 1024);
  if (parsed.error) return parsed.error;

  const login = typeof parsed.data.login === "string" ? parsed.data.login.trim() : "";
  const password = typeof parsed.data.password === "string" ? parsed.data.password : "";
  const validationError = validateLoginCredentials(login, password);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const loginRateLimitResponse = await enforceRateLimit(adminSupabase, request, {
    route: "login-signup-account",
    identity: login.toLowerCase(),
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (loginRateLimitResponse) return loginRateLimitResponse;

  const { error } = await adminSupabase.auth.admin.createUser({
    email: loginToEmail(login),
    password,
    email_confirm: true,
    user_metadata: {
      login,
      auth_type: "login_password",
    },
  });

  if (error) {
    return Response.json(
      { error: "Не удалось создать аккаунт. Проверьте логин и пароль." },
      { status: 400 }
    );
  }

  return Response.json({ ok: true });
}

import { createClient } from "@supabase/supabase-js";
import { loginToEmail, validateLoginCredentials } from "@/lib/loginAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        error:
          "Для регистрации по логину добавьте SUPABASE_SERVICE_ROLE_KEY в .env.local и перезапустите сервер.",
      },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    login?: string;
    password?: string;
  };

  const login = body.login?.trim() || "";
  const password = body.password || "";
  const validationError = validateLoginCredentials(login, password);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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
    const errorMessage = error.message.toLowerCase();
    const alreadyExists =
      errorMessage.includes("already") || errorMessage.includes("registered");

    return Response.json(
      {
        error: alreadyExists ? "Такой логин уже занят" : error.message,
      },
      { status: alreadyExists ? 409 : 400 }
    );
  }

  return Response.json({ ok: true });
}

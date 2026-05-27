import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type CoupleMembership = {
  id: string;
  partner_one_id: string | null;
  partner_two_id: string | null;
};

let cachedAdminClient: SupabaseClient | null = null;

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}

export function requireAdminClient() {
  const adminSupabase = getAdminClient();
  if (!adminSupabase) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return adminSupabase;
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getAuthenticatedUser(
  adminSupabase: SupabaseClient,
  request: Request
): Promise<User | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await adminSupabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function getAuthorizedCouple(
  adminSupabase: SupabaseClient,
  coupleId: string,
  userId: string
) {
  const { data: couple, error } = await adminSupabase
    .from("couples")
    .select("id, partner_one_id, partner_two_id")
    .eq("id", coupleId)
    .single<CoupleMembership>();

  if (error || !couple) return { couple: null, error: "Пара не найдена", status: 404 };

  const isMember = couple.partner_one_id === userId || couple.partner_two_id === userId;
  if (!isMember) return { couple: null, error: "Нет доступа к этой паре", status: 403 };

  return { couple, error: null, status: 200 };
}

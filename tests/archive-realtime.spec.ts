import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { getDailyQuestionHistory } from "../lib/dailyQuestions.ts";
import { createVirtualQuestionArchiveId } from "../lib/questionArchive.ts";
import { getSupabaseAuthStorageKey } from "../lib/supabaseUrls.ts";

const coupleTimeZone = "Europe/Moscow";

type CleanupState = {
  coupleId: string | null;
  userIds: string[];
};

function getRequiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}`);
  return value;
}

async function createTemporaryUser(
  admin: SupabaseClient,
  email: string,
  password: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) throw error || new Error("Supabase did not create an E2E user");
  return data.user.id;
}

async function signInTemporaryUser(
  supabaseUrl: string,
  publishableKey: string,
  email: string,
  password: string,
) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) throw error || new Error("Supabase did not return an E2E session");
  return { client, session: data.session };
}

async function addSessionToContext(
  context: BrowserContext,
  storageKey: string,
  session: Session,
) {
  await context.addInitScript(
    ({ authStorageKey, authSession }) => {
      window.localStorage.setItem(authStorageKey, JSON.stringify(authSession));
      window.localStorage.setItem("couple-space:remember-me", "true");
    },
    { authStorageKey: storageKey, authSession: session },
  );
}

async function cleanupTemporaryData(admin: SupabaseClient, state: CleanupState) {
  const cleanupErrors: string[] = [];

  if (state.coupleId) {
    for (const table of [
      "question_comments",
      "couple_notifications",
      "question_answers",
      "couple_profiles",
    ]) {
      const { error } = await admin.from(table).delete().eq("couple_id", state.coupleId);
      if (error) cleanupErrors.push(`${table}: ${error.message}`);
    }

    const { error } = await admin.from("couples").delete().eq("id", state.coupleId);
    if (error) cleanupErrors.push(`couples: ${error.message}`);
  }

  for (const userId of state.userIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(`auth.users: ${error.message}`);
  }

  if (cleanupErrors.length > 0) {
    throw new Error(`E2E cleanup failed: ${cleanupErrors.join("; ")}`);
  }
}

test("a late archive answer reveals the partner answer through Realtime", async ({
  browser,
  baseURL,
}) => {
  const supabaseUrl = getRequiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = getRequiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseURL) throw new Error("Playwright baseURL is not configured");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const cleanupState: CleanupState = { coupleId: null, userIds: [] };
  const contexts: BrowserContext[] = [];
  const authClients: SupabaseClient[] = [];
  const suffix = randomBytes(6).toString("hex");
  const password = `E2E-${randomBytes(18).toString("base64url")}aA1!`;
  const partnerOneEmail = `codex-archive-one-${suffix}@example.com`;
  const partnerTwoEmail = `codex-archive-two-${suffix}@example.com`;
  const partnerOneAnswer = `Первый E2E-ответ ${suffix}`;
  const partnerTwoAnswer = `Второй E2E-ответ ${suffix}`;

  try {
    const partnerOneId = await createTemporaryUser(admin, partnerOneEmail, password);
    cleanupState.userIds.push(partnerOneId);
    const partnerTwoId = await createTemporaryUser(admin, partnerTwoEmail, password);
    cleanupState.userIds.push(partnerTwoId);

    const coupleCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { data: couple, error: coupleError } = await admin
      .from("couples")
      .insert({
        created_at: coupleCreatedAt.toISOString(),
        invite_code: `E2E${suffix.slice(0, 8)}`.toUpperCase(),
        partner_one_id: partnerOneId,
        partner_two_id: partnerTwoId,
      })
      .select("id")
      .single<{ id: string }>();

    if (coupleError || !couple) {
      throw coupleError || new Error("Supabase did not create an E2E couple");
    }
    cleanupState.coupleId = couple.id;

    const { error: profileError } = await admin.from("couple_profiles").insert({
      couple_id: couple.id,
      partner_one: "E2E Первый",
      partner_two: "E2E Второй",
      start_date: coupleCreatedAt.toISOString().slice(0, 10),
      time_zone: coupleTimeZone,
    });
    if (profileError) throw profileError;

    const history = getDailyQuestionHistory(coupleCreatedAt, new Date(), coupleTimeZone);
    const targetQuestion = history.at(-2);
    if (!targetQuestion) throw new Error("E2E history did not include a missed day");
    const archivePath = `/questions/archive/${createVirtualQuestionArchiveId(targetQuestion.dateKey)}`;

    const [partnerOneAuth, partnerTwoAuth] = await Promise.all([
      signInTemporaryUser(supabaseUrl, publishableKey, partnerOneEmail, password),
      signInTemporaryUser(supabaseUrl, publishableKey, partnerTwoEmail, password),
    ]);
    authClients.push(partnerOneAuth.client, partnerTwoAuth.client);

    const partnerOneContext = await browser.newContext({ baseURL });
    const partnerTwoContext = await browser.newContext({ baseURL });
    contexts.push(partnerOneContext, partnerTwoContext);

    const storageKey = getSupabaseAuthStorageKey();
    await Promise.all([
      addSessionToContext(partnerOneContext, storageKey, partnerOneAuth.session),
      addSessionToContext(partnerTwoContext, storageKey, partnerTwoAuth.session),
    ]);

    const partnerOnePage = await partnerOneContext.newPage();
    const partnerTwoPage = await partnerTwoContext.newPage();
    const browserErrors: string[] = [];

    for (const page of [partnerOnePage, partnerTwoPage]) {
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
    }

    await Promise.all([partnerOnePage.goto(archivePath), partnerTwoPage.goto(archivePath)]);
    await Promise.all([
      expect(partnerOnePage.getByRole("heading", { name: targetQuestion.question })).toBeVisible(),
      expect(partnerTwoPage.getByRole("heading", { name: targetQuestion.question })).toBeVisible(),
    ]);
    await expect(partnerTwoPage.getByText("Ответ партнёра скрыт")).toBeVisible();

    await partnerTwoPage.getByLabel("Добавьте ответ сейчас").fill(partnerTwoAnswer);
    await partnerTwoPage.getByRole("button", { name: "Сохранить ответ" }).click();
    await expect(partnerTwoPage.getByText(partnerTwoAnswer, { exact: true })).toBeVisible();
    await expect(partnerTwoPage.getByText("Партнёр не отвечал на этот вопрос.")).toBeVisible();

    await partnerOnePage.getByLabel("Добавьте ответ сейчас").fill(partnerOneAnswer);
    await partnerOnePage.getByRole("button", { name: "Сохранить ответ" }).click();
    await expect(partnerOnePage.getByText(partnerTwoAnswer, { exact: true })).toBeVisible();

    await expect(partnerTwoPage.getByText(partnerOneAnswer, { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const { data: storedAnswer, error: answerError } = await admin
      .from("question_answers")
      .select("answer_one, answer_two")
      .eq("couple_id", couple.id)
      .eq("date", targetQuestion.date)
      .eq("question", targetQuestion.question)
      .single<{ answer_one: string | null; answer_two: string | null }>();

    if (answerError) throw answerError;
    expect(storedAnswer).toMatchObject({
      answer_one: partnerOneAnswer,
      answer_two: partnerTwoAnswer,
    });
    expect(browserErrors).toEqual([]);

  } finally {
    await Promise.allSettled(authClients.map((client) => client.auth.signOut({ scope: "global" })));
    await Promise.allSettled(contexts.map((context) => context.close()));
    await cleanupTemporaryData(admin, cleanupState);
  }
});

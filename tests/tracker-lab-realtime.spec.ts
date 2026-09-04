import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthStorageKey } from "../lib/supabaseUrls.ts";
import { decodeMemoryMedia } from "../lib/memoryMedia.ts";

const fixtureDate = "2026-09-07";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing local E2E variable: " + name);
  return value;
}

function localUrl(value: string, supabase = false) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || (supabase && url.port !== "54321")) {
    throw new Error("Tracker E2E may run only on localhost with the disposable Supabase stack at port 54321");
  }
  return value;
}

type PairFixture = {
  admin: SupabaseClient;
  clients: SupabaseClient[];
  pages: Page[];
  contexts: BrowserContext[];
  coupleId: string;
  userIds: string[];
};

async function removeLocalObjects(admin: SupabaseClient, bucket: string, prefix: string) {
  const paths: string[] = [];
  async function collect(folder: string, depth: number) {
    if (depth > 5) throw new Error("Unexpected fixture storage nesting");
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) throw error;
    for (const item of data || []) {
      const path = folder + "/" + item.name;
      if (item.id) paths.push(path);
      else await collect(path, depth + 1);
    }
  }
  await collect(prefix, 0);
  if (paths.length) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}

async function withPair(browser: Browser, baseURL: string | undefined, run: (fixture: PairFixture) => Promise<void>) {
  const url = localUrl(required("NEXT_PUBLIC_SUPABASE_URL"), true);
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  localUrl(baseURL);
  const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const key = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const suffix = randomBytes(6).toString("hex");
  const password = "TrackerE2E-" + randomBytes(20).toString("base64url") + "aA1!";
  const userIds: string[] = [];
  const contexts: BrowserContext[] = [];
  const clients: SupabaseClient[] = [];
  const pages: Page[] = [];
  let coupleId: string | null = null;
  try {
    for (const name of ["one", "two"]) {
      const email = "tracker-" + name + "-" + suffix + "@example.com";
      const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (user.error || !user.data.user) throw user.error || new Error("Fixture user missing");
      userIds.push(user.data.user.id);
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      clients.push(client);
      const auth = await client.auth.signInWithPassword({ email, password });
      if (auth.error || !auth.data.session) throw auth.error || new Error("Fixture session missing");
      const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, timezoneId: "Europe/Moscow" });
      contexts.push(context);
      await context.addInitScript(({ storageKey, session }) => {
        localStorage.setItem(storageKey, JSON.stringify(session));
        localStorage.setItem("couple-space:remember-me", "true");
      }, { storageKey: getSupabaseAuthStorageKey(), session: auth.data.session });
      pages.push(await context.newPage());
    }
    const couple = await admin.from("couples").insert({
      partner_one_id: userIds[0], partner_two_id: userIds[1], invite_code: "T" + suffix.toUpperCase(),
    }).select("id").single<{ id: string }>();
    if (couple.error || !couple.data) throw couple.error || new Error("Fixture couple missing");
    coupleId = couple.data.id;
    const profile = await admin.from("couple_profiles").insert({
      couple_id: coupleId, partner_one: "Synthetic One", partner_two: "Synthetic Two", time_zone: "Europe/Moscow",
    });
    if (profile.error) throw profile.error;
    await run({ admin, clients, pages, contexts, coupleId, userIds });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await Promise.allSettled(clients.map((client) => client.auth.signOut()));
    if (coupleId) {
      await removeLocalObjects(admin, "tracker-media", coupleId);
      await removeLocalObjects(admin, "memory-images", coupleId);
      for (const table of ["tracker_plan_memory_links", "tracker_plan_activity", "tracker_plan_attachments", "tracker_plan_comments", "tracker_plan_reminders", "tracker_plan_occurrence_overrides", "tracker_plan_participants", "tracker_plans", "tracker_checkins", "tracker_category_preferences", "tracker_goals", "tracker_events", "memory_comments", "memories", "couple_notifications", "couple_profiles"]) {
        const { error } = await admin.from(table).delete().eq("couple_id", coupleId);
        if (error) throw new Error("Fixture cleanup failed for " + table + ": " + error.message);
      }
      const { error } = await admin.from("couples").delete().eq("id", coupleId);
      if (error) throw error;
    }
    for (const id of userIds.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  }
}

async function openTracker(page: Page) {
  await page.goto("/tracker/lab?date=" + fixtureDate);
  await expect(page.getByRole("heading", { name: "Наш ритм", exact: true })).toBeVisible();
  await expect(page.locator(".tracker-lab-counter").first()).toBeVisible();
}

async function openPlanComposer(page: Page) {
  await page.getByRole("button", { name: "Добавить запись", exact: true }).click();
  await page.getByRole("button", { name: /Событие или план/ }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("heading", { name: "Добавить в календарь", exact: true })).toBeVisible();
  return dialog;
}

function silentWav() {
  const bytes = Buffer.alloc(44 + 1600);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write("data", 36);
  bytes.writeUInt32LE(1600, 40);
  return bytes;
}

test("tracker lab two-user lifecycle, Realtime, privacy and media", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  await withPair(browser, baseURL, async ({ admin, clients, pages, coupleId, userIds }) => {
    const [one, two] = pages;
    const errors: string[] = [];
    pages.forEach((page) => page.on("pageerror", (error) => errors.push(error.message)));
    await Promise.all(pages.map(openTracker));
    const title = "Synthetic shared evening";
    const composer = await openPlanComposer(one);
    await composer.getByLabel("Название", { exact: true }).fill(title);
    await composer.getByLabel("Дата", { exact: true }).fill(fixtureDate);
    await composer.getByLabel("Начало", { exact: true }).fill("19:00");
    await composer.getByLabel("Конец", { exact: true }).fill("20:00");
    await composer.getByLabel("Описание", { exact: true }).fill("Fictional fixture, no user content");
    await composer.getByRole("button", { name: "Добавить в календарь", exact: true }).click();
    await expect(composer).toHaveCount(0);
    const cardTwo = two.locator("[data-plan-card]").filter({ hasText: title });
    await expect(cardTwo).toBeVisible({ timeout: 25_000 });
    await cardTwo.locator(".tracker-lab-plan-main").click();
    await two.getByRole("button", { name: "Принять", exact: true }).click();
    await expect(two.getByText("Вас пригласили в этот план")).toHaveCount(0);
    const planResult = await admin.from("tracker_plans").select("id").eq("couple_id", coupleId).eq("title", title).single<{ id: string }>();
    if (planResult.error || !planResult.data) throw planResult.error || new Error("Plan missing");
    const planId = planResult.data.id;
    await expect.poll(async () => {
      const result = await admin.from("tracker_plan_participants").select("response").eq("plan_id", planId).eq("user_id", userIds[1]).single();
      return result.data?.response;
    }).toBe("accepted");

    await one.getByRole("dialog").getByRole("button", { name: "Закрыть", exact: true }).click();
    await one.getByRole("button", { name: "Отметить состояние", exact: true }).click();
    const checkin = one.getByRole("dialog").last();
    const privateNote = "PRIVATE SYNTHETIC CHECKIN";
    await checkin.getByPlaceholder("Личная заметка о дне").fill(privateNote);
    await checkin.getByRole("button", { name: "Только мне", exact: true }).click();
    await checkin.getByRole("button", { name: "Сохранить состояние", exact: true }).click();
    await expect.poll(async () => {
      const result = await admin.from("tracker_checkins").select("note").eq("couple_id", coupleId).eq("user_id", userIds[0]).eq("date", fixtureDate).single();
      return result.data?.note;
    }).toBe(privateNote);
    const partnerCheckins = await clients[1].rpc("get_tracker_checkins", { p_couple_id: coupleId, p_from: fixtureDate, p_to: fixtureDate });
    expect(partnerCheckins.error).toBeNull();
    expect(JSON.stringify(partnerCheckins.data)).not.toContain(privateNote);
    await expect(two.getByText(privateNote, { exact: true })).toHaveCount(0);

    await one.locator("[data-plan-card]").filter({ hasText: title }).locator(".tracker-lab-plan-main").click();
    const note = "Synthetic comment delivered by Realtime";
    await one.getByPlaceholder("Напишите или вставьте файл через Ctrl+V…").fill(note);
    await one.locator(".tracker-lab-comment-composer .is-send").click();
    await expect(two.getByText(note, { exact: true })).toBeVisible({ timeout: 25_000 });

    const fixtures = [
      { name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6x2sAAAAASUVORK5CYII=", "base64"), type: "image" },
      { name: "fixture.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic attachment"), type: "file" },
      { name: "fixture.wav", mimeType: "audio/wav", buffer: silentWav(), type: "audio" },
    ];
    for (const fixture of fixtures) {
      if (fixture.type === "image") {
        const pasted = await one.getByPlaceholder("Напишите или вставьте файл через Ctrl+V…").evaluate((element, file) => {
          const clipboard = new DataTransfer();
          clipboard.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.mimeType }));
          const event = new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true });
          element.dispatchEvent(event);
          return event.defaultPrevented;
        }, { name: fixture.name, mimeType: fixture.mimeType, bytes: Array.from(fixture.buffer) });
        expect(pasted).toBe(true);
      } else {
        await one.locator(".tracker-lab-comment-composer input[type=file]").setInputFiles(fixture);
      }
      await expect(one.locator(".tracker-lab-pending-file")).toContainText(fixture.name);
      await one.locator(".tracker-lab-comment-composer .is-send").click();
      await expect.poll(async () => {
        const result = await admin.from("tracker_plan_comments").select("id").eq("plan_id", planId).eq("attachment_name", fixture.name);
        return result.data?.length || 0;
      }).toBe(1);
      await expect(one.locator(".tracker-lab-pending-file")).toHaveCount(0);
    }
    await expect(two.locator(".tracker-lab-comment-list img").last()).toBeVisible();
    await expect(two.getByRole("link", { name: "fixture.txt" })).toBeVisible();
    await expect(two.locator(".tracker-lab-comment-list audio")).toHaveCount(1);

    // Exercise the actual file-paste handler without modifying the host clipboard.
    const textPastePrevented = await one.getByPlaceholder("Напишите или вставьте файл через Ctrl+V…").evaluate((element) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", "Synthetic ordinary text");
      const event = new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(textPastePrevented).toBe(false);

    for (const width of [375, 390, 768, 1280, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        await two.setViewportSize({ width, height: 850 });
        await two.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await two.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
        const discussion = two.locator(".tracker-lab-comments");
        await discussion.scrollIntoViewIfNeeded();
        await expect.poll(() => discussion.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const audio = two.locator(".tracker-lab-comment-list audio");
        await expect(audio).toHaveAttribute("src", /tracker-media/);
        await expect(two.getByRole("link", { name: "fixture.txt" })).toBeVisible();
        await expect.poll(() => two.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
    }

    // A synthetic silent stream keeps the test local and never opens a real microphone.
    await one.evaluate(() => {
      const context = new AudioContext();
      const destination = context.createMediaStreamDestination();
      const track = destination.stream.getAudioTracks()[0];
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => destination.stream });
      (window as Window & { trackerFixtureRecording?: { context: AudioContext; track: MediaStreamTrack; restore: () => void } }).trackerFixtureRecording = {
        context, track, restore: () => Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: original }),
      };
    });
    await one.getByPlaceholder("Напишите или вставьте файл через Ctrl+V…").fill("Unsaved synthetic draft");
    await one.getByRole("button", { name: "Записать голос", exact: true }).click();
    await expect(one.getByRole("button", { name: "Остановить запись", exact: true })).toBeVisible();
    await one.getByRole("dialog").getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect.poll(() => one.evaluate(() =>
      (window as Window & { trackerFixtureRecording?: { track: MediaStreamTrack } }).trackerFixtureRecording?.track.readyState
    )).toBe("ended");
    await one.locator("[data-plan-card]").filter({ hasText: title }).locator(".tracker-lab-plan-main").click();
    await expect(one.getByPlaceholder("Напишите или вставьте файл через Ctrl+V…")).toHaveValue("");
    await expect(one.locator(".tracker-lab-pending-file")).toHaveCount(0);
    await expect(one.getByRole("button", { name: "Записать голос", exact: true })).toBeVisible();
    await one.evaluate(async () => {
      const fixture = (window as Window & { trackerFixtureRecording?: { context: AudioContext; restore: () => void } }).trackerFixtureRecording;
      fixture?.restore();
      await fixture?.context.close();
    });

    await one.getByRole("dialog").getByRole("button", { name: /^Завершить/ }).click();
    await expect(one.getByRole("button", { name: "Сделать воспоминанием", exact: true })).toBeVisible();
    await one.getByRole("button", { name: "Сделать воспоминанием", exact: true }).click();
    const memory = one.getByRole("dialog").last();
    await memory.getByLabel("Название", { exact: true }).fill("Synthetic memory");
    await memory.getByLabel("Описание", { exact: true }).fill("Copied fixture media");
    await memory.getByRole("button", { name: "Создать воспоминание", exact: true }).click();
    await expect(one).toHaveURL(/\/memories\/[0-9a-f-]+$/);
    const storedMemory = await admin.from("memories").select("event_date,image").eq("couple_id", coupleId).eq("title", "Synthetic memory").single();
    expect(storedMemory.error).toBeNull();
    expect(storedMemory.data?.event_date).toBe(fixtureDate);
    const memoryMedia = decodeMemoryMedia(storedMemory.data?.image);
    expect(memoryMedia.photoUrl).toMatch(/memory-images\/[^?]+\.png$/);
    expect(memoryMedia.voiceUrl).toMatch(/memory-images\/[^?]+\.wav$/);
    expect(memoryMedia.attachments).toEqual([expect.objectContaining({ name: "fixture.txt", type: "file" })]);
    const memoryUrls = [memoryMedia.photoUrl, memoryMedia.voiceUrl, ...(memoryMedia.attachments || []).map((item) => item.url)];
    for (const url of memoryUrls) {
      expect(url).not.toBeNull();
      const path = url!.split("/object/public/memory-images/")[1];
      expect(path).toMatch(new RegExp("^" + coupleId + "/"));
      const publicResponse = await fetch(
        required("NEXT_PUBLIC_SUPABASE_URL") + "/storage/v1/object/public/memory-images/" + path,
      );
      expect(publicResponse.ok).toBe(false);
      const download = await clients[1].storage.from("memory-images").download(path);
      expect(download.error).toBeNull();
      expect(download.data?.size).toBeGreaterThan(0);
    }

    await openTracker(one);
    await one.locator("[data-plan-card]").filter({ hasText: title }).locator(".tracker-lab-plan-main").click();
    one.once("dialog", (dialog) => dialog.accept());
    await one.getByRole("dialog").getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(one.locator("[data-plan-card]").filter({ hasText: title })).toHaveCount(0);
    await expect.poll(async () => {
      const result = await admin.from("tracker_plans").select("id").eq("id", planId);
      return result.data?.length;
    }).toBe(0);
    expect(errors).toEqual([]);
  });
});

test("tracker lab mobile and desktop layouts in both themes and reduced motion", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  await withPair(browser, baseURL, async ({ pages }) => {
    const page = pages[0];
    await openTracker(page);

    // Keep the complete width/theme matrix cheap: the richer interactions
    // below exercise representative mobile, tablet and desktop breakpoints.
    for (const width of [375, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
        await expect(page.getByRole("heading", { name: "Наш ритм", exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
    }

    await page.setViewportSize({ width: 390, height: 850 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    for (const tab of ["Сегодня", "Календарь", "Активность"]) {
      await page.locator(".tracker-lab-local-nav").getByRole("button", { name: tab, exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }

    await page.setViewportSize({ width: 768, height: 850 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.locator(".tracker-lab-local-nav").getByRole("button", { name: "Сегодня", exact: true }).click();
    await page.getByRole("button", { name: "Сводка дня", exact: true }).click();
    await expect(page.locator("#tracker-lab-insights")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#tracker-lab-insights")).toBeHidden();

    for (const scenario of [{ width: 390, theme: "dark" }, { width: 1440, theme: "light" }] as const) {
      await page.setViewportSize({ width: scenario.width, height: 850 });
      await page.emulateMedia({ colorScheme: scenario.theme, reducedMotion: "reduce" });
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), scenario.theme === "dark");
      const composer = await openPlanComposer(page);
      await composer.getByLabel("Название", { exact: true }).fill("Длинное синтетическое название ".repeat(4).slice(0, 120));
      await composer.getByLabel("Описание", { exact: true }).fill("Синтетический текст ".repeat(60));
      await composer.locator("summary").filter({ hasText: "Дополнительные параметры" }).click();
      const bounds = await composer.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width + 1);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

      if (scenario.width === 390) {
        await page.setViewportSize({ width: scenario.width, height: 500 });
        await composer.getByLabel("Описание", { exact: true }).focus();
        await composer.getByRole("button", { name: "Добавить в календарь", exact: true }).scrollIntoViewIfNeeded();
        await expect(composer.getByRole("button", { name: "Добавить в календарь", exact: true })).toBeInViewport();
        await composer.getByRole("button", { name: "Закрыть", exact: true }).focus();
        await page.keyboard.press("Shift+Tab");
        await expect(composer.getByRole("button", { name: "Добавить в календарь", exact: true })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(composer.getByRole("button", { name: "Закрыть", exact: true })).toBeFocused();
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Добавить запись", exact: true })).toBeFocused();
    }

    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  });
});

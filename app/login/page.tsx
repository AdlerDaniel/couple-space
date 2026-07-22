"use client";

import { setAuthPersistencePreference, supabase } from "@/lib/supabaseClient";
import { loginToEmail, validateLoginCredentials } from "@/lib/loginAuth";
import { useRouter } from "next/navigation";
import type { RefObject, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type AuthMode = "login" | "register";
type AuthMethod = "login" | "email";

const authMethods: Array<{ key: AuthMethod; label: string; hint: string }> = [
  { key: "login", label: "Логин и пароль", hint: "Без почты" },
  { key: "email", label: "Email и пароль", hint: "Классический вход" },
];

function AuthInput({
  value,
  onChange,
  placeholder,
  label,
  name,
  autoComplete,
  type = "text",
  autoFocus,
  inputRef,
  right,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  name: string;
  autoComplete: string;
  type?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  right?: ReactNode;
}) {
  return (
    <div className="group relative">
      <label htmlFor={`auth-${name}`} className="sr-only">
        {label}
      </label>
      <input
        id={`auth-${name}`}
        name={name}
        autoComplete={autoComplete}
        ref={inputRef}
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[1.35rem] border border-white/45 bg-white/65 px-5 pr-16 text-base font-bold text-[#3b0710] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_18px_45px_rgba(127,29,29,0.08)] backdrop-blur transition placeholder:text-[#9f1239]/45 focus:border-[#fb7185]/70 focus:bg-white/85 focus:shadow-[0_0_0_5px_rgba(251,113,133,0.16),0_22px_55px_rgba(190,18,60,0.16)] dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/35 dark:focus:bg-white/15"
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [method, setMethod] = useState<AuthMethod>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [mode, method]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRememberMe(localStorage.getItem("couple-space:remember-me") !== "false");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function finishAuth(message: string) {
    setSuccessMessage(message);
    setErrorMessage("");
    window.setTimeout(() => router.push("/dashboard"), 850);
  }

  function showError(message: string) {
    setErrorMessage(message);
    setSuccessMessage("");
  }

  async function handleEmailAuth() {
    if (!email.trim() || !password) {
      showError("Введите email и пароль");
      return;
    }

    setIsLoading(true);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      setIsLoading(false);

      if (error) {
        showError(error.message);
        return;
      }

      if (data.session) {
        finishAuth("Аккаунт создан");
      } else {
        setSuccessMessage("Регистрация успешна. Проверьте email");
      }

      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (error) {
      showError(error.message);
      return;
    }

    finishAuth("Вход выполнен");
  }

  async function handleLoginAuth() {
    const trimmedLogin = login.trim();

    if (mode === "register") {
      const validationError = validateLoginCredentials(trimmedLogin, loginPassword);

      if (validationError) {
        showError(validationError);
        return;
      }

      setIsLoading(true);

      const response = await fetch("/api/auth/login-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: trimmedLogin,
          password: loginPassword,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setIsLoading(false);
        showError(result.error || "Не удалось создать аккаунт по логину");
        return;
      }
    } else if (!trimmedLogin || !loginPassword) {
      showError("Введите логин и пароль");
      return;
    } else {
      setIsLoading(true);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(trimmedLogin),
      password: loginPassword,
    });

    setIsLoading(false);

    if (error) {
      showError(
        mode === "register"
          ? "Аккаунт создан. Попробуйте войти по логину и паролю"
          : error.message
      );
      return;
    }

    finishAuth(mode === "register" ? "Аккаунт создан" : "Вход выполнен");
  }

  async function signInWithGoogle() {
    setAuthPersistencePreference(rememberMe);
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setIsLoading(false);
      showError(error.message);
    }
  }

  async function submitAuth() {
    if (isLoading) return;

    setAuthPersistencePreference(rememberMe);

    if (method === "email") {
      await handleEmailAuth();
    } else {
      await handleLoginAuth();
    }
  }

  const passwordValue = method === "email" ? password : loginPassword;
  const setPasswordValue = method === "email" ? setPassword : setLoginPassword;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff1f4] px-4 py-8 text-[#3b0710] transition-colors dark:bg-[#090205] dark:text-white sm:px-6 sm:py-12 lg:px-10 lg:py-24">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center opacity-35 blur-sm dark:opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(76,5,25,0.36), rgba(255,228,235,0.22)), url('https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1800&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(251,113,133,0.45),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(244,114,182,0.34),transparent_30%),linear-gradient(135deg,rgba(255,241,244,0.92),rgba(255,255,255,0.72)_46%,rgba(255,228,235,0.9))] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(190,18,60,0.34),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(136,19,55,0.28),transparent_30%),linear-gradient(135deg,rgba(9,2,5,0.94),rgba(43,8,18,0.82)_48%,rgba(12,3,8,0.96))]" />
      <div className="pointer-events-none absolute inset-0 auth-grain opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(76,5,25,0.22))] dark:bg-[radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.62))]" />

      <div className="auth-blob absolute left-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-[#fb7185]/35 blur-3xl" />
      <div className="auth-blob auth-blob-delay absolute bottom-[-9rem] right-[-8rem] h-96 w-96 rounded-full bg-[#f472b6]/30 blur-3xl" />
      <div className="auth-heart left-[8%] top-[18%]">❤️</div>
      <div className="auth-heart auth-heart-delay right-[12%] top-[16%]">♡</div>
      <div className="auth-heart auth-heart-slow bottom-[14%] left-[18%]">✦</div>

      <section className="relative z-10 grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
        <div className="auth-reveal hidden lg:block">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-white/55 text-5xl shadow-[0_24px_70px_rgba(127,29,29,0.22)] ring-1 ring-white/60 backdrop-blur dark:bg-white/10 dark:ring-white/10">
              ❤️
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#be123c]/70 dark:text-white/55">
                Couple Space
              </p>
              <h1 className="mt-2 text-6xl font-black tracking-tight text-[#3b0710] dark:text-white">
                Ваше пространство для двоих
              </h1>
            </div>
          </div>

          <div className="auth-float relative hidden overflow-hidden rounded-[2rem] border border-white/45 bg-white/35 p-5 shadow-[0_36px_110px_rgba(127,29,29,0.2)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-white/45 via-transparent to-[#fb7185]/18 dark:from-white/10" />
            <div className="relative grid gap-4">
              <div className="rounded-[1.5rem] bg-white/60 p-5 shadow-inner dark:bg-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-[#be123c]/65 dark:text-white/60">
                      Пример интерфейса
                    </p>
                    <p className="mt-1 text-4xl font-black">547 дней вместе</p>
                  </div>
                  <div className="flex -space-x-3">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#fb7185] to-[#fecdd3] ring-4 ring-white dark:ring-[#2a0710]" />
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#f9a8d4] to-[#ffe4e6] ring-4 ring-white dark:ring-[#2a0710]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  ["💌", "Вопрос дня", "Что тебе запомнилось?"],
                  ["📸", "Воспоминания", "Фото и истории пары"],
                  ["🏆", "Достижения", "Общие маленькие победы"],
                  ["🕰️", "Таймлайн", "Следующая цель"],
                ].map(([icon, title, text]) => (
                  <div
                    key={title}
                    className="rounded-[1.35rem] bg-white/50 p-4 shadow-[0_18px_42px_rgba(127,29,29,0.12)] transition hover:-translate-y-1 hover:scale-[1.02] dark:bg-white/10"
                  >
                    <p className="text-2xl">{icon}</p>
                    <p className="mt-3 font-black">{title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#be123c]/60 dark:text-white/55">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="auth-reveal auth-reveal-delay mx-auto w-full max-w-md">
          <div className="mb-4 text-center lg:hidden">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white/55 text-4xl shadow-2xl ring-1 ring-white/60 backdrop-blur dark:bg-white/10 dark:ring-white/10 sm:h-20 sm:w-20 sm:text-5xl">
              ❤️
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:mt-5 sm:text-4xl">
              Ваше пространство для двоих
            </h1>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/45 p-3 shadow-[0_32px_110px_rgba(127,29,29,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8 sm:p-4">
            <form
              className="rounded-[1.7rem] bg-white/55 p-4 shadow-inner dark:bg-black/20 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submitAuth();
              }}
            >
              <div className="mb-3 grid grid-cols-2 rounded-full bg-[#fff1f4]/80 p-1 shadow-inner dark:bg-white/10">
                {(["login", "register"] as AuthMode[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => {
                      setMode(item);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className={`rounded-full px-5 py-3 text-sm font-black transition ${
                      mode === item
                        ? "bg-white text-[#be123c] shadow-lg dark:bg-white/15 dark:text-white"
                        : "text-[#be123c]/55 hover:bg-rose-50/80 dark:text-white/55 dark:hover:bg-rose-500/15"
                    }`}
                  >
                    {item === "login" ? "Вход" : "Регистрация"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="group mb-3 flex h-12 w-full items-center justify-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/75 font-black text-[#3b0710] shadow-lg transition hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-rose-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-rose-500/15"
              >
                <span className="text-xl">G</span>
                Google
              </button>

              <div className="mb-3 grid gap-1.5">
                {authMethods.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => {
                      setMethod(item.key);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className={`rounded-[1.2rem] border px-4 py-2 text-left transition hover:-translate-y-0.5 ${
                      method === item.key
                        ? "border-[#fb7185]/60 bg-[#fff1f4] shadow-[0_12px_34px_rgba(190,18,60,0.12)] dark:border-white/20 dark:bg-white/15"
                        : "border-white/40 bg-white/35 hover:bg-rose-50/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-rose-500/15"
                    }`}
                  >
                    <span className="block font-black">{item.label}</span>
                    <span className={`text-xs font-bold ${themeTextMuted()}`}>
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>

              <div key={`${mode}-${method}`} className="auth-form-switch space-y-2">
                {method === "email" ? (
                  <AuthInput
                    value={email}
                    onChange={setEmail}
                    placeholder="Электронная почта"
                    label="Электронная почта"
                    name="email"
                    autoComplete="email"
                    type="email"
                    inputRef={firstInputRef}
                    autoFocus
                  />
                ) : (
                  <AuthInput
                    value={login}
                    onChange={setLogin}
                    placeholder="Логин"
                    label="Логин"
                    name="username"
                    autoComplete="username"
                    inputRef={firstInputRef}
                    autoFocus
                  />
                )}

                <AuthInput
                  value={passwordValue}
                  onChange={setPasswordValue}
                  placeholder="Пароль"
                  label="Пароль"
                  name="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  type={showPassword ? "text" : "password"}
                  right={
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="rounded-full bg-[#fff1f4] px-3 py-2 text-xs font-black text-[#be123c] shadow-inner transition hover:bg-rose-100 dark:bg-white/10 dark:text-white dark:hover:bg-rose-500/15"
                    >
                      {showPassword ? "Скрыть" : "Показать"}
                    </button>
                  }
                />
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-bold text-[#be123c]/75 dark:text-white/65">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="peer sr-only"
                />
                <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#fb7185]/40 bg-white/60 shadow-inner transition peer-checked:border-[#fb7185] peer-checked:bg-[#fb7185] peer-checked:text-white dark:bg-white/10">
                  {rememberMe ? "✓" : ""}
                </span>
                Запомнить меня
              </label>

              {(errorMessage || successMessage) && (
                <div
                  className={`mt-3 rounded-[1.25rem] p-3 text-sm font-bold shadow-inner ${
                    successMessage
                      ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                      : "bg-rose-100/80 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                  }`}
                >
                  {successMessage || errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="auth-gradient-button mt-3 flex h-14 w-full items-center justify-center rounded-[1.35rem] px-6 text-base font-black text-white shadow-[0_18px_50px_rgba(220,38,38,0.34)] transition hover:-translate-y-1 hover:scale-[1.015] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <span className="flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {mode === "login" ? "Входим..." : "Создаём..."}
                  </span>
                ) : successMessage ? (
                  "Готово"
                ) : mode === "login" ? (
                  "Войти"
                ) : (
                  "Создать аккаунт"
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function themeTextMuted() {
  return "text-[#be123c]/55 dark:text-white/45";
}

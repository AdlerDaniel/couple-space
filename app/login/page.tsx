"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { loginToEmail, validateLoginCredentials } from "@/lib/loginAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, setLogin] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Регистрация успешна. Проверь email ❤️");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Вход выполнен ❤️");
  }

  async function signUpWithLogin() {
    const trimmedLogin = login.trim();
    const validationError = validateLoginCredentials(trimmedLogin, loginPassword);

    if (validationError) {
      alert(validationError);
      return;
    }

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
      alert(result.error || "Не удалось создать аккаунт по логину");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(trimmedLogin),
      password: loginPassword,
    });

    if (error) {
      alert("Аккаунт создан, теперь войдите по логину и паролю");
      return;
    }

    alert("Аккаунт по логину создан ❤️");
  }

  async function signInWithLogin() {
    const trimmedLogin = login.trim();

    if (!trimmedLogin || !loginPassword) {
      alert("Введите логин и пароль");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(trimmedLogin),
      password: loginPassword,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Вход по логину выполнен ❤️");
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 px-6 pb-28 pt-28 text-black transition-colors dark:from-black dark:to-neutral-950 dark:text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-2xl shadow-black/10 transition-colors dark:border-white/10 dark:bg-neutral-950 dark:shadow-black/60">
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">♡</div>

          <h1 className="text-4xl font-bold text-black dark:text-white">
            Вход
          </h1>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Войдите в ваше общее пространство
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-black/10 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-900">
            <p className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Через email
            </p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3 w-full rounded-2xl border border-black/10 bg-white p-4 text-black outline-none transition placeholder:text-gray-400 focus:border-black dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-white"
            />

            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-3 w-full rounded-2xl border border-black/10 bg-white p-4 text-black outline-none transition placeholder:text-gray-400 focus:border-black dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-white"
            />

            <button
              onClick={signIn}
              className="w-full rounded-full bg-black px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Войти по email
            </button>

            <button
              onClick={signUp}
              className="mt-3 w-full rounded-full border border-black/10 bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-100 dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800"
            >
              Зарегистрироваться по email
            </button>
          </div>

          <div className="rounded-3xl border border-black/10 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-900">
            <p className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Через логин
            </p>

            <input
              type="text"
              placeholder="Логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mb-3 w-full rounded-2xl border border-black/10 bg-white p-4 text-black outline-none transition placeholder:text-gray-400 focus:border-black dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-white"
            />

            <input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="mb-3 w-full rounded-2xl border border-black/10 bg-white p-4 text-black outline-none transition placeholder:text-gray-400 focus:border-black dark:border-white/10 dark:bg-neutral-950 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-white"
            />

            <button
              onClick={signInWithLogin}
              className="w-full rounded-full bg-rose-500 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-rose-600"
            >
              Войти по логину
            </button>

            <button
              onClick={signUpWithLogin}
              className="mt-3 w-full rounded-full border border-rose-200 bg-white px-6 py-3 font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-white/10 dark:bg-neutral-950 dark:text-rose-300 dark:hover:bg-neutral-800"
            >
              Создать аккаунт по логину
            </button>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full rounded-full border border-black/10 bg-gray-100 px-6 py-3 font-semibold text-black transition hover:bg-gray-200 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            Войти через Google
          </button>
        </div>
      </div>
    </main>
  );
}

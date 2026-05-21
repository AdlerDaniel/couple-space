const memories = [
  {
    title: "Первая поездка",
    note: "маленький город, длинные прогулки",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    rotate: "-rotate-3",
  },
  {
    title: "Вечер дома",
    note: "чай, плед и любимый сериал",
    image:
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=900&q=80",
    rotate: "rotate-2",
  },
  {
    title: "Наше лето",
    note: "дни, которые хочется повторить",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    rotate: "-rotate-1",
  },
  {
    title: "Свидание",
    note: "городские огни и разговоры до ночи",
    image:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80",
    rotate: "rotate-3",
  },
];

const stats = [
  ["❤️", "42", "дня вместе"],
  ["📸", "126", "воспоминаний"],
  ["💌", "84", "ответа"],
  ["🔥", "17", "дней подряд"],
];

const features = [
  {
    icon: "📸",
    title: "Моменты, к которым возвращаются",
    text: "Собирайте ваши фотографии, заметки и маленькие истории в одном красивом месте.",
  },
  {
    icon: "💌",
    title: "Разговоры глубже обычного",
    text: "Вопросы дня помогают замечать друг друга даже в самые занятые недели.",
  },
  {
    icon: "✨",
    title: "История только для вас",
    text: "Общее пространство пары с настроением, прогрессом, ачивками и личным ритмом.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fff7fb] text-[#7f1d1d] transition-colors dark:bg-[#130711] dark:text-[#ffe4ec]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(244,63,94,0.26),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_48%_84%,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fff7fb_0%,#fff1f2_42%,#f6f1ff_100%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(244,63,94,0.22),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(124,58,237,0.22),transparent_32%),radial-gradient(circle_at_48%_84%,rgba(20,184,166,0.12),transparent_32%),linear-gradient(135deg,#170711_0%,#230a18_46%,#120b24_100%)]" />
        <div className="landing-noise absolute inset-0 opacity-[0.18]" />
        <div className="landing-blob absolute left-[-10rem] top-32 h-96 w-96 rounded-full bg-rose-300/40 blur-3xl dark:bg-rose-500/18" />
        <div className="landing-blob landing-blob-delayed absolute right-[-8rem] top-80 h-[28rem] w-[28rem] rounded-full bg-violet-300/35 blur-3xl dark:bg-violet-500/18" />
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-14 px-6 pb-20 pt-32 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="landing-heart absolute left-[8%] top-[18%] text-3xl text-rose-400/55">❤️</span>
          <span className="landing-heart landing-heart-delay absolute left-[44%] top-[12%] text-2xl text-fuchsia-400/45">♥</span>
          <span className="landing-heart landing-heart-slow absolute right-[7%] top-[22%] text-4xl text-violet-400/40">❤️</span>
        </div>

        <div className="landing-reveal relative z-10">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/45 px-5 py-2 text-sm font-semibold text-rose-600 shadow-[0_18px_60px_rgba(244,63,94,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-rose-200">
            <span>❤️</span>
            Couple Space
          </div>

          <h1 className="max-w-4xl text-6xl font-black leading-[0.92] tracking-normal text-[#b91c1c] dark:text-white md:text-8xl">
            Место, которое будет только вашим
          </h1>

          <p className="mt-8 max-w-2xl text-xl leading-9 text-[#9f1239]/75 dark:text-white/72 md:text-2xl">
            Ваше личное пространство для любви, воспоминаний и маленьких
            моментов, к которым хочется возвращаться снова.
          </p>

          <div className="mt-10 flex">
            <a
              href="/login"
              className="rounded-full bg-gradient-to-r from-rose-600 to-fuchsia-600 px-8 py-4 text-center text-lg font-bold text-white shadow-[0_18px_50px_rgba(225,29,72,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(225,29,72,0.45)]"
            >
              Начать
            </a>
          </div>

          <div className="mt-12 flex items-center gap-5">
            <div className="flex -space-x-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-300 to-rose-600 text-2xl shadow-xl ring-4 ring-white/70 dark:ring-[#130711]">
                А
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-600 text-2xl shadow-xl ring-4 ring-white/70 dark:ring-[#130711]">
                М
              </div>
            </div>
            <div>
              <p className="font-bold text-rose-700 dark:text-rose-100">Анна + Максим</p>
              <p className="text-sm font-semibold text-rose-700/60 dark:text-white/50">
                42 дня создают свою историю
              </p>
            </div>
          </div>
        </div>

        <div id="preview" className="landing-reveal landing-reveal-delay relative">
          <div className="landing-float absolute -left-5 top-16 z-20 rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
            <p className="text-sm font-bold text-rose-500">💌 Вопрос дня</p>
            <p className="mt-1 text-2xl font-black text-rose-700 dark:text-white">84 ответа</p>
          </div>
          <div className="landing-float landing-float-slow absolute -right-4 top-56 z-20 rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
            <p className="text-sm font-bold text-violet-500">🔥 Серия</p>
            <p className="mt-1 text-2xl font-black text-violet-700 dark:text-white">17 дней</p>
          </div>
          <div className="landing-float landing-float-fast absolute bottom-10 left-8 z-20 rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
            <p className="text-sm font-bold text-teal-600">📸 Воспоминания</p>
            <p className="mt-1 text-2xl font-black text-teal-700 dark:text-white">126</p>
          </div>

          <div className="relative rounded-[2.5rem] border border-white/70 bg-white/50 p-4 shadow-[0_36px_120px_rgba(159,18,57,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-[#fff8fb] shadow-inner dark:border-white/10 dark:bg-[#170916]">
              <div className="flex items-center justify-between border-b border-rose-100/80 px-5 py-4 dark:border-white/10">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-300" />
                  <span className="h-3 w-3 rounded-full bg-teal-300" />
                </div>
                <span className="rounded-full bg-rose-100 px-4 py-1 text-xs font-bold text-rose-600 dark:bg-white/10 dark:text-rose-100">
                  dashboard
                </span>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-violet-600 p-5 text-white shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white/70">Вместе</p>
                      <p className="mt-1 text-4xl font-black">42 дня</p>
                    </div>
                    <div className="flex -space-x-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/25 ring-2 ring-white/60">
                        А
                      </span>
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/25 ring-2 ring-white/60">
                        М
                      </span>
                    </div>
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {["Фото", "Вопросы", "Серия"].map((item) => (
                      <div key={item} className="rounded-2xl bg-white/16 p-3">
                        <p className="text-xs font-bold text-white/70">{item}</p>
                        <p className="mt-1 text-xl font-black">
                          {item === "Фото" ? "126" : item === "Вопросы" ? "84" : "17"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-3xl bg-white p-5 shadow-xl dark:bg-white/10">
                    <p className="text-sm font-bold text-rose-500">💌 Вопрос дня</p>
                    <p className="mt-3 text-xl font-black text-rose-950 dark:text-white">
                      Что ты больше всего любишь в наших обычных днях?
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-white/10 dark:text-rose-100">
                        Когда мы готовим ужин и смеёмся без причины.
                      </div>
                      <div className="rounded-2xl bg-violet-50 p-3 text-sm font-semibold text-violet-700 dark:bg-white/10 dark:text-violet-100">
                        Твои сообщения посреди дня.
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {["2025", "❤️", "2026"].map((item) => (
                      <div key={item} className="rounded-2xl bg-white/80 p-4 text-center font-black shadow-lg dark:bg-white/10">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 grid grid-cols-4 gap-3">
                  {memories.map((memory) => (
                    <div
                      key={memory.title}
                      className="h-24 overflow-hidden rounded-2xl shadow-lg"
                    >
                      <img
                        src={memory.image}
                        alt={memory.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="landing-reveal mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase text-rose-500">Не просто функции</p>
          <h2 className="mt-4 text-4xl font-black text-[#9f1239] dark:text-white md:text-6xl">
            Сохраняйте то, что обычно теряется в переписках
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="landing-reveal rounded-[2rem] border border-white/60 bg-white/48 p-8 shadow-[0_24px_80px_rgba(159,18,57,0.12)] backdrop-blur-xl transition hover:-translate-y-2 hover:bg-white/65 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12"
            >
              <div className="mb-8 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-rose-100 to-violet-100 text-3xl shadow-inner dark:from-white/14 dark:to-white/6">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-black text-[#9f1239] dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-4 leading-7 text-[#9f1239]/68 dark:text-white/62">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="landing-reveal">
          <p className="text-sm font-black uppercase text-teal-600">Ваши воспоминания</p>
          <h2 className="mt-4 text-5xl font-black leading-tight text-[#9f1239] dark:text-white">
            Галерея моментов, которые выглядят как маленькая история
          </h2>
          <p className="mt-6 text-xl leading-8 text-[#9f1239]/68 dark:text-white/62">
            Фотографии, подписи, даты и настроение дня собираются в живую ленту,
            а не исчезают среди обычных сообщений.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {memories.map((memory, index) => (
            <article
              key={memory.title}
              className={`landing-reveal ${memory.rotate} rounded-[1.6rem] bg-white p-3 shadow-[0_24px_70px_rgba(88,28,135,0.16)] transition hover:rotate-0 hover:scale-[1.03] dark:bg-white/10`}
            >
              <img
                src={memory.image}
                alt={memory.title}
                className={`w-full rounded-[1.1rem] object-cover ${
                  index % 2 === 0 ? "h-56" : "h-72"
                }`}
              />
              <div className="px-2 py-4">
                <h3 className="font-black text-[#9f1239] dark:text-white">{memory.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#9f1239]/55 dark:text-white/50">
                  {memory.note}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="landing-reveal rounded-[2.5rem] border border-white/60 bg-white/55 p-8 shadow-[0_34px_100px_rgba(225,29,72,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
          <div className="rounded-[2rem] bg-gradient-to-br from-rose-600 via-fuchsia-600 to-violet-700 p-8 text-white shadow-2xl">
            <p className="text-sm font-black uppercase text-white/70">💌 Вопрос дня</p>
            <h2 className="mt-5 text-4xl font-black leading-tight">
              Что ты больше всего любишь в наших обычных днях?
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-white/16 p-5 backdrop-blur">
                <p className="text-sm font-bold text-white/60">Анна</p>
                <p className="mt-3 text-lg font-bold">
                  Когда мы идём рядом и молчим, но всё равно понятно, что мы вместе.
                </p>
              </div>
              <div className="rounded-3xl bg-white/16 p-5 backdrop-blur">
                <p className="text-sm font-bold text-white/60">Максим</p>
                <p className="mt-3 text-lg font-bold">
                  Твоё “я дома” и то, как обычный день сразу становится теплее.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-reveal">
          <p className="text-sm font-black uppercase text-rose-500">Больше близости</p>
          <h2 className="mt-4 text-5xl font-black leading-tight text-[#9f1239] dark:text-white">
            Маленький вопрос может стать большим разговором
          </h2>
          <p className="mt-6 text-xl leading-8 text-[#9f1239]/68 dark:text-white/62">
            Вы отвечаете отдельно, а потом видите ответы друг друга. Без давления,
            без шума, только повод услышать партнёра внимательнее.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-5 md:grid-cols-4">
          {stats.map(([icon, value, label]) => (
            <div
              key={label}
              className="landing-reveal rounded-[2rem] border border-white/60 bg-white/50 p-7 text-center shadow-[0_26px_80px_rgba(159,18,57,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8"
            >
              <p className="text-4xl">{icon}</p>
              <p className="mt-4 text-5xl font-black text-[#9f1239] dark:text-white">
                {value}
              </p>
              <p className="mt-2 font-bold text-[#9f1239]/58 dark:text-white/52">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-28 pt-16">
        <div className="landing-reveal relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#be123c] via-[#c026d3] to-[#4f46e5] p-10 text-center text-white shadow-[0_36px_120px_rgba(190,18,60,0.28)] md:p-16">
          <div className="absolute left-10 top-10 text-5xl opacity-30">❤️</div>
          <div className="absolute bottom-10 right-12 text-6xl opacity-25">✨</div>
          <h2 className="mx-auto max-w-4xl text-5xl font-black leading-tight md:text-7xl">
            Начните создавать вашу историю уже сегодня
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-white/72">
            Создайте место, где будут жить ваши даты, ответы, фотографии и
            маленькие доказательства любви.
          </p>
          <a
            href="/login"
            className="mt-10 inline-flex rounded-full bg-white px-9 py-4 text-lg font-black text-rose-700 shadow-2xl transition hover:-translate-y-0.5 hover:bg-rose-50"
          >
            Создать пространство
          </a>
        </div>
      </section>
    </main>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#fff8ed] px-6 pb-28 pt-24 text-[#c2410c] dark:bg-[#140b05] dark:text-[#ffedd5]">
      <div className="mx-auto max-w-6xl">
        <div className="app-glass rounded-[2rem] px-6 py-5">
          <p className="text-sm font-black uppercase tracking-[0.16em] opacity-60">
            Couple Space
          </p>
          <p className="mt-2 text-xl font-black">Загружаем раздел...</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="app-glass rounded-3xl p-4">
              <div className="ui-skeleton h-10 w-10 rounded-2xl" />
              <div className="ui-skeleton mt-5 h-3 w-24 rounded-full" />
              <div className="ui-skeleton mt-3 h-8 w-16 rounded-full" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="app-glass rounded-[2rem] p-5">
            <div className="ui-skeleton h-6 w-52 rounded-full" />
            <div className="ui-skeleton mt-4 h-40 rounded-3xl" />
          </div>
          <div className="app-glass rounded-[2rem] p-5">
            <div className="ui-skeleton h-6 w-40 rounded-full" />
            <div className="mt-4 space-y-3">
              <div className="ui-skeleton h-12 rounded-2xl" />
              <div className="ui-skeleton h-12 rounded-2xl" />
              <div className="ui-skeleton h-12 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fff8ed] px-6 text-[#c2410c] dark:bg-[#140b05] dark:text-[#ffedd5]">
      <div className="rounded-[2rem] border border-white/60 bg-white/70 px-6 py-5 text-center shadow-[0_20px_64px_rgba(194,65,12,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/8">
        <p className="text-sm font-black uppercase tracking-[0.16em] opacity-60">
          Couple Space
        </p>
        <p className="mt-2 text-xl font-black">Загружаем раздел...</p>
      </div>
    </main>
  );
}

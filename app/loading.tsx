import AppSkeleton from "@/components/AppSkeleton";

export default function Loading() {
  return (
    <main
      className="min-h-screen bg-[#fff8ed] px-6 pb-28 pt-24 text-[#c2410c] dark:bg-[#140b05] dark:text-[#ffedd5]"
      style={{ ["--scroll-accent" as string]: "#ea580c" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="ui-card px-6 py-5">
          <p className="ui-eyebrow">
            Couple Space
          </p>
          <p className="mt-2 text-xl font-black text-[#7c2d12] dark:text-white">Загружаем раздел...</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <AppSkeleton key={item} rows={2} accent="#ea580c" />)}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="ui-card p-5">
            <div className="ui-skeleton h-6 w-52 rounded-full" />
            <div className="ui-skeleton mt-4 h-40 rounded-[1.25rem]" />
          </div>
          <div className="ui-card p-5">
            <div className="ui-skeleton h-6 w-40 rounded-full" />
            <div className="mt-4 space-y-3">
              <div className="ui-skeleton h-12 rounded-[1rem]" />
              <div className="ui-skeleton h-12 rounded-[1rem]" />
              <div className="ui-skeleton h-12 rounded-[1rem]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

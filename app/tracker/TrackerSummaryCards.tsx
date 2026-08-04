const panelClass =
  "border border-amber-900/12 bg-white/64 shadow-[0_20px_55px_rgba(146,64,14,0.09)] backdrop-blur-xl dark:border-amber-200/10 dark:bg-[#211a0c]/78 dark:shadow-[0_24px_70px_rgba(0,0,0,0.26)]";

export function TrackerSummaryCards({ cards }: { cards: [string, string | number][] }) {
  return (
    <section className={`${panelClass} grid grid-cols-2 overflow-hidden rounded-[1.35rem] p-2 sm:p-3 lg:grid-cols-4`}>
      {cards.map(([label, value]) => (
        <div key={label} className="tracker-summary-item min-h-20 border-amber-900/10 px-3 py-3 text-center sm:px-4">
          <p className="text-lg font-black leading-tight text-[#a16207] dark:text-amber-300 sm:text-xl">{value}</p>
          <p className="mt-1 text-[10px] font-bold leading-tight text-[#713f12]/55 dark:text-amber-100/50 sm:text-xs">{label}</p>
        </div>
      ))}
    </section>
  );
}

type AppSkeletonProps = {
  rows?: number;
  accent?: string;
};

export default function AppSkeleton({ rows = 3, accent = "#be123c" }: AppSkeletonProps) {
  return (
    <div
      className="ui-card p-5"
      style={{ ["--scroll-accent" as string]: accent, color: accent }}
    >
      <div className="flex items-center gap-3">
        <div className="ui-skeleton h-12 w-12 rounded-[1rem]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="ui-skeleton h-3 w-1/2 rounded-full" />
          <div className="ui-skeleton h-5 w-3/4 rounded-full" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="ui-skeleton h-3 rounded-full"
            style={{ width: `${86 - index * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

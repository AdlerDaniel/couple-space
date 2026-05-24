type AppSkeletonProps = {
  rows?: number;
  accent?: string;
};

export default function AppSkeleton({ rows = 3, accent = "#be123c" }: AppSkeletonProps) {
  return (
    <div
      className="app-glass rounded-3xl p-5"
      style={{ color: accent, borderColor: `${accent}25` }}
    >
      <div className="ui-skeleton h-10 w-10 rounded-2xl" />
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

import type { NavIconName } from "@/lib/navigation";

const iconPaths: Record<NavIconName, string> = {
  home: "M4 11.2 12 4l8 7.2v8.3a.5.5 0 0 1-.5.5h-5v-5h-5v5h-5a.5.5 0 0 1-.5-.5v-8.3Z",
  today: "M5 5.5h14v14H5v-14Zm3-2v4m8-4v4M8 11h8m-8 4h5",
  questions: "M5 5h14v10H9l-4 4V5Zm4 4h6m-6 3h4",
  quizzes: "M12 4l2.2 5 5.3.5-4 3.5 1.2 5.2L12 15.1 7.3 18.2 8.5 13l-4-3.5 5.3-.5L12 4Z",
  watch: "M5 6.5h14v11H5v-11Zm5.5 3.2 4.5 2.3-4.5 2.3V9.7Z",
  chat: "M5 6h14v9H9l-4 4V6Zm4 4h6",
  dashboard: "M5 13h5v6H5v-6Zm9-8h5v14h-5V5ZM5 5h5v5H5V5Z",
  memories: "M5 7h14v11H5V7Zm3-2h8l1 2H7l1-2Zm1 9 2-2.3 2 2 1.4-1.4L17 15H7l2-1Z",
  tracker: "M5 12h4l2-5 3 10 2-5h3m-12 7h10",
  achievements: "M8 5h8v3a4 4 0 0 1-8 0V5Zm-2 1H4v2a3 3 0 0 0 3 3m10-5h2v2a3 3 0 0 1-3 3m-4 1v4m-3 0h6",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-4v2m0 11v2m7.5-7.5h-2m-11 0h-2m12.1-5.1-1.4 1.4m-7.8 7.8-1.4 1.4m0-10.6 1.4 1.4m7.8 7.8 1.4 1.4",
  notifications: "M7 17h10l-1.2-2.4V11a3.8 3.8 0 0 0-7.6 0v3.6L7 17Zm3 0a2 2 0 0 0 4 0",
  plus: "M12 5v14m-7-7h14",
  logout: "M10 5H6v14h4m4-10 3 3-3 3m-7-3h10",
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
  title?: string;
};

export default function NavIcon({ name, className = "", title }: NavIconProps) {
  return (
    <span
      className={`nav-icon inline-grid place-items-center ${className}`}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 24 24" role={title ? "img" : undefined} aria-label={title}>
        <path d={iconPaths[name]} />
      </svg>
    </span>
  );
}

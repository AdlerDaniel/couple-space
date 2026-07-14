import type { NavIconName } from "@/lib/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  Ellipsis,
  House,
  Images,
  LayoutDashboard,
  LogOut,
  MessageCircleQuestion,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  Trophy,
  UserRound,
  X,
  type LucideIcon as LucideIconComponent,
} from "lucide-react";

const icons: Record<NavIconName, LucideIconComponent> = {
  home: House,
  today: CalendarDays,
  questions: MessageCircleQuestion,
  quizzes: Sparkles,
  watch: Clapperboard,
  chat: MessageCircle,
  dashboard: LayoutDashboard,
  memories: Images,
  tracker: Activity,
  achievements: Trophy,
  profile: UserRound,
  settings: Settings,
  notifications: Bell,
  more: Ellipsis,
  close: X,
  chevronRight: ChevronRight,
  plus: Plus,
  logout: LogOut,
};

type NavIconProps = {
  name: NavIconName;
  className?: string;
  title?: string;
};

export default function NavIcon({ name, className = "", title }: NavIconProps) {
  const Icon = icons[name];

  return (
    <span
      className={`nav-icon inline-grid place-items-center ${className}`}
      aria-hidden={title ? undefined : true}
    >
      <Icon
        aria-hidden={title ? undefined : true}
        aria-label={title}
        role={title ? "img" : undefined}
        strokeWidth={2}
      />
    </span>
  );
}

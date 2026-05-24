export type ActivityLike = {
  createdAt: string;
};

export type AchievementLike = {
  id: string;
  value: number;
  target: number;
  unlocked: boolean;
};

export function getWeeklyActivityCount(
  activity: ActivityLike[],
  now = new Date(),
  days = 7,
) {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;

  return activity.filter((item) => {
    const activityTime = new Date(item.createdAt).getTime();

    return Number.isFinite(activityTime) && activityTime >= cutoff && activityTime <= now.getTime();
  }).length;
}

export function getNearestAchievements<T extends AchievementLike>(
  achievements: T[],
  limit = 3,
) {
  return achievements
    .filter((achievement) => !achievement.unlocked && achievement.target > 0)
    .sort((first, second) => {
      const firstProgress = first.value / first.target;
      const secondProgress = second.value / second.target;

      return secondProgress - firstProgress;
    })
    .slice(0, limit);
}

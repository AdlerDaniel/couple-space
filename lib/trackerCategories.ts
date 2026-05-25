export type TrackerDefaultCategory = {
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export const trackerDefaultCategories: TrackerDefaultCategory[] = [
  { name: "Поели", slug: "food", icon: "🍽️", color: "#facc15", sort_order: 10, is_default: true },
  { name: "Секс", slug: "sex", icon: "❤️", color: "#fde047", sort_order: 20, is_default: true },
  { name: "Спорт", slug: "sport", icon: "🏃", color: "#bef264", sort_order: 30, is_default: true },
  { name: "Игры", slug: "games", icon: "🎮", color: "#ca8a04", sort_order: 40, is_default: true },
  { name: "Рисунки", slug: "drawings", icon: "🎨", color: "#84cc16", sort_order: 50, is_default: true },
];

export const trackerCategoryColors = trackerDefaultCategories.reduce<Record<string, string>>(
  (result, category) => {
    result[category.slug] = category.color;
    return result;
  },
  {}
);

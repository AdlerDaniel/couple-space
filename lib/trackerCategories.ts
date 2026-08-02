export type TrackerDefaultCategory = {
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export const trackerDefaultCategories: TrackerDefaultCategory[] = [
  { name: "Поели", slug: "food", icon: "utensils", color: "#9a6334", sort_order: 10, is_default: true },
  { name: "Секс", slug: "sex", icon: "heart", color: "#e5484d", sort_order: 20, is_default: true },
  { name: "Спорт", slug: "sport", icon: "dumbbell", color: "#2f9e44", sort_order: 30, is_default: true },
  { name: "Игры", slug: "games", icon: "gamepad", color: "#3478d4", sort_order: 40, is_default: true },
  { name: "Рисунки", slug: "drawings", icon: "palette", color: "#db5b9a", sort_order: 50, is_default: true },
];

export const trackerCategoryColors = trackerDefaultCategories.reduce<Record<string, string>>(
  (result, category) => {
    result[category.slug] = category.color;
    return result;
  },
  {}
);

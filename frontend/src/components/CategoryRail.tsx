import type { Category } from "../api/orderApi";

type CategoryRailProps = {
  categories: Category[];
  activeId: number | null;
  onSelect: (categoryId: number) => void;
};

function CategoryRail({ categories, activeId, onSelect }: CategoryRailProps) {
  return (
    <aside className="category-rail" aria-label="菜单分类">
      {categories.map((category) => (
        <button
          className={`cat-button ${category.id === activeId ? "active" : ""}`}
          key={category.id}
          onClick={() => onSelect(category.id)}
          type="button"
        >
          {category.name}
        </button>
      ))}
    </aside>
  );
}

export default CategoryRail;

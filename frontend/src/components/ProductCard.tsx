import type { Dish } from "../api/orderApi";
import { affection } from "../api/affection";

type ProductCardProps = {
  dish: Dish;
  onQuantityChange: (dish: Dish, quantity: number) => void;
};

function ProductCard({ dish, onQuantityChange }: ProductCardProps) {
  const nextQuantity = (delta: number) => Math.max(0, dish.quantity + delta);
  const categoryVariant = `variant-${dish.categoryId % 4}`;

  return (
    <article className="product-card">
      <div className={`dish-visual ${categoryVariant}`}>
        {dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} /> : <span />}
      </div>
      <div className="product-info">
        {dish.badge && <div className="badge">{dish.badge}</div>}
        <h3>{dish.name}</h3>
        <p>{dish.description}</p>
        <div className="product-bottom">
          <strong>{affection(dish.price)}</strong>
          <div className="quantity-control">
            <button
              className="qty-button minus"
              aria-label={`减少${dish.name}`}
              onClick={() => onQuantityChange(dish, nextQuantity(-1))}
              type="button"
            >
              −
            </button>
            <span>{dish.quantity}</span>
            <button
              className="qty-button"
              aria-label={`增加${dish.name}`}
              onClick={() => onQuantityChange(dish, nextQuantity(1))}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;

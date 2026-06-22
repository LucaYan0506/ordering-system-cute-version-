import type { Basket } from "../api/orderApi";
import { affection } from "../api/affection";

type CartBarProps = {
  basket: Basket;
  onOpen: () => void;
};

function CartBar({ basket, onOpen }: CartBarProps) {
  return (
    <footer className="cart-bar">
      <button className="cart-icon" onClick={onOpen} type="button" aria-label="打开购物袋">
        抱
      </button>
      <div className="cart-total">
        <strong>{affection(basket.totalPrice)}</strong>
        <span>{basket.itemCount}件商品</span>
      </div>
      <button className="checkout-button" onClick={onOpen} type="button">
        去结算
      </button>
    </footer>
  );
}

export default CartBar;

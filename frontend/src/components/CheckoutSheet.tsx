import { useEffect, useState } from "react";
import { affection } from "../api/affection";
import type { Basket } from "../api/orderApi";

type CheckoutSheetProps = {
  basket: Basket;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onClear: () => void;
  onSubmit: (people: number, allTogether: boolean) => void;
};

function CheckoutSheet({ basket, open, busy, onClose, onClear, onSubmit }: CheckoutSheetProps) {
  const [people, setPeople] = useState(1);
  const [allTogether, setAllTogether] = useState(false);

  useEffect(() => {
    if (open) {
      setPeople(1);
      setAllTogether(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="checkout-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <h2>购物袋</h2>
          <button onClick={onClose} type="button" aria-label="关闭">
            ×
          </button>
        </div>

        <div className="cart-items">
          {basket.items.length === 0 ? (
            <div className="empty-state">还没有选好吃的</div>
          ) : (
            basket.items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div>
                  <strong>{item.dish.name}</strong>
                  <span>x {item.quantity}</span>
                </div>
                <b>{affection(item.lineTotal)}</b>
              </div>
            ))
          )}
        </div>

        <div className="checkout-options">
          <label>
            <span>人数</span>
            <input
              min={1}
              value={people}
              onChange={(event) => setPeople(Number(event.target.value))}
              type="number"
            />
          </label>
          <label className="toggle-row">
            <span>一起上菜</span>
            <input
              checked={allTogether}
              onChange={(event) => setAllTogether(event.target.checked)}
              type="checkbox"
            />
          </label>
        </div>

        <div className="sheet-actions">
          <button className="secondary-button" onClick={onClear} disabled={busy || basket.itemCount === 0} type="button">
            清空
          </button>
          <button
            className="primary-button"
            onClick={() => onSubmit(people, allTogether)}
            disabled={busy || basket.itemCount === 0}
            type="button"
          >
            用 {affection(basket.totalPrice)} 下单
          </button>
        </div>
      </section>
    </div>
  );
}

export default CheckoutSheet;

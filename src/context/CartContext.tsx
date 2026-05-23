import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type CartItem = {
  productId: string;
  variantSku?: string;
  title: string;
  price_cents: number;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (productId: string, variantSku?: string) => void;
  clearCart: () => void;
  totalCents: number;
  count: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (incoming: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      setItems((prev) => {
        const idx = prev.findIndex(
          (i) =>
            i.productId === incoming.productId &&
            i.variantSku === incoming.variantSku,
        );
        if (idx > -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + (incoming.quantity ?? 1),
          };
          return next;
        }
        return [...prev, { ...incoming, quantity: incoming.quantity ?? 1 }];
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string, variantSku?: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.variantSku === variantSku),
      ),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCents = items.reduce(
    (sum, i) => sum + i.price_cents * i.quantity,
    0,
  );
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, totalCents, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
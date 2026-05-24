import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from "react";

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
  restoreFromStorage: () => void;
  totalCents: number;
  count: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  // Always start empty to ensure a clean state on fresh loads
  const [items, setItems] = useState<CartItem[]>([]);

  // Debugging: Log whenever state changes
  useEffect(() => {
    console.log("Cart State Updated:", items);
  }, [items]);

  // Sync to localStorage
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem("cart_items", JSON.stringify(items));
    } else {
      localStorage.removeItem("cart_items");
    }
  }, [items]);

  const restoreFromStorage = useCallback(() => {
    const saved = localStorage.getItem("cart_items");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed);
        console.log("Cart restored from storage");
      } catch (e) {
        console.error("Cart corruption during restore", e);
      }
    }
  }, []);

  const addItem = useCallback(
    (incoming: Omit<CartItem, "quantity"> & { quantity?: number }) => {
      console.log("addItem triggered with:", incoming);
      setItems((prev) => {
        const idx = prev.findIndex(
          (i) => i.productId === incoming.productId && i.variantSku === incoming.variantSku,
        );
        if (idx > -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + (incoming.quantity ?? 1) };
          console.log("Item updated quantity:", next[idx]);
          return next;
        }
        console.log("Adding new item to cart");
        return [...prev, { ...incoming, quantity: incoming.quantity ?? 1 }];
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string, variantSku?: string) => {
    setItems((prev) => prev.filter((i) => !(i.productId === productId && i.variantSku === variantSku)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem("cart_items");
  }, []);

  // Use useMemo to prevent unnecessary re-renders of consuming components
  const value = useMemo(() => ({
    items,
    addItem,
    removeItem,
    clearCart,
    restoreFromStorage,
    totalCents: items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0),
    count: items.reduce((sum, i) => sum + i.quantity, 0)
  }), [items, addItem, removeItem, clearCart, restoreFromStorage]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};

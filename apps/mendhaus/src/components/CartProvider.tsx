"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/money";

type CartContextValue = {
  lines: CartLine[];
  add: (productId: string, quantity?: number) => void;
  setQty: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE = "mh_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      add(productId, quantity = 1) {
        setLines((current) => {
          const existing = current.find((line) => line.productId === productId);
          if (existing) {
            return current.map((line) =>
              line.productId === productId
                ? { ...line, quantity: Math.min(8, line.quantity + quantity) }
                : line,
            );
          }
          return [...current, { productId, quantity }];
        });
      },
      setQty(productId, quantity) {
        setLines((current) =>
          current
            .map((line) =>
              line.productId === productId ? { ...line, quantity } : line,
            )
            .filter((line) => line.quantity > 0),
        );
      },
      remove(productId) {
        setLines((current) => current.filter((line) => line.productId !== productId));
      },
      clear() {
        setLines([]);
      },
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}

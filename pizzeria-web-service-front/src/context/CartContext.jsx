import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCart, removeFromCart } from "../api/user.api";
import { AuthContext } from "./AuthContext";

export const CartContext = createContext();

const emptyCart = {
  id: null,
  items: [],
  total: 0,
};

function normalizeCart(payload) {
  return {
    id: payload?.id ?? null,
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number(payload?.total ?? 0),
  };
}

export function CartProvider({ children }) {
  const { token } = useContext(AuthContext);
  const [cart, setCart] = useState(emptyCart);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const refreshCart = useCallback(async () => {
    if (!token) {
      setCart(emptyCart);
      setError("");
      setLoading(false);
      setHasLoaded(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getCart(token);
      setCart(normalizeCart(response));
      setError("");
    } catch (err) {
      setCart(emptyCart);
      setError(err?.response?.data?.error || "Unable to load cart.");
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setHasLoaded(false);
      return;
    }
    setCart(emptyCart);
    setError("");
    setLoading(false);
    setHasLoaded(false);
  }, [token]);

  const ensureCartLoaded = useCallback(async () => {
    if (!token || hasLoaded) {
      return;
    }
    await refreshCart();
  }, [hasLoaded, refreshCart, token]);

  const setCartFromResponse = useCallback((response) => {
    setCart(normalizeCart(response));
    setError("");
    setHasLoaded(true);
  }, []);

  const removeItem = useCallback(
    async (itemId) => {
      if (!token) return;
      setUpdating(true);
      setError("");
      try {
        const response = await removeFromCart(token, itemId);
        setCart(normalizeCart(response));
      } catch (err) {
        setError(err?.response?.data?.error || "Unable to update cart.");
      } finally {
        setUpdating(false);
      }
    },
    [token]
  );

  const clearCart = useCallback(async () => {
    if (!token || cart.items.length === 0) return;
    setUpdating(true);
    setError("");
    const itemIds = cart.items.map((item) => item.id);
    try {
      let lastResponse = null;
      for (const itemId of itemIds) {
        // Sequential deletes keep backend state consistent for each response.
        // This also keeps the context synchronized after every item deletion.
        lastResponse = await removeFromCart(token, itemId);
      }
      setCart(lastResponse ? normalizeCart(lastResponse) : emptyCart);
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to clear cart.");
      await refreshCart();
    } finally {
      setUpdating(false);
    }
  }, [token, cart.items, refreshCart]);

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items]
  );

  const value = useMemo(
    () => ({
      cart,
      cartItems: cart.items,
      cartTotal: cart.total,
      itemCount,
      loading,
      hasLoaded,
      updating,
      error,
      refreshCart,
      ensureCartLoaded,
      setCartFromResponse,
      removeItem,
      clearCart,
    }),
    [
      cart,
      itemCount,
      loading,
      hasLoaded,
      updating,
      error,
      refreshCart,
      ensureCartLoaded,
      setCartFromResponse,
      removeItem,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

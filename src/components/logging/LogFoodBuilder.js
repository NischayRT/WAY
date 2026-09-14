'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import FoodSearch from './FoodSearch';
import DishBuilder from './DishBuilder';
import RecommendedFoods from './RecommendedFoods';
import Cart from './Cart';
import { ui } from '@/lib/ui';

export default function LogFoodBuilder({ userId }) {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);

  const addToCart = (food, quantityG) => {
    setCart((prev) => [...prev, { food, quantityG }]);
  };

  const updateQuantity = (index, value) => {
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantityG: value } : item))
    );
  };

  const removeItem = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Browser refresh/tab-close confirmation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cart.length]);

  // Intercept internal link clicks if cart has items
  useEffect(() => {
    const handleAnchorClick = (e) => {
      if (cart.length === 0) return;
      const anchor = e.target.closest('a');
      if (anchor && anchor.href && !anchor.href.includes('#')) {
        const url = new URL(anchor.href);
        if (url.pathname !== window.location.pathname) {
          e.preventDefault();
          setPendingRoute(anchor.href);
          setShowExitModal(true);
        }
      }
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => document.removeEventListener('click', handleAnchorClick, true);
  }, [cart.length]);

  const scrollToCart = () => {
    const el = document.getElementById('cart-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    if (pendingRoute) {
      router.push(pendingRoute);
    }
  };

  return (
    <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <FoodSearch onAdd={addToCart} />
        <DishBuilder onAdd={addToCart} />
        <RecommendedFoods onAdd={addToCart} />
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Cart
          userId={userId}
          items={cart}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          onLogged={() => setCart([])}
        />
      </div>

      {/* Floating Mobile Cart Icon & Badge */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 right-5 z-40 lg:hidden">
          <button
            type="button"
            onClick={scrollToCart}
            className="flex items-center gap-2 rounded-full bg-emerald-600 text-white p-3.5 shadow-xl transition-all duration-300 active:scale-95 border-2 border-white dark:border-slate-900"
            aria-label="View Cart"
          >
            <ShoppingBag size={20} />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-700 font-numeric text-xs font-bold shadow-xs">
              {cart.length}
            </span>
          </button>
        </div>
      )}

      {/* Unsaved Items Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unsaved Meal Items</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  You have {cart.length} item{cart.length > 1 ? 's' : ''} in your meal list. If you leave now, these selections will be discarded.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className={`${ui.btnSecondary} flex-1`}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 active:scale-[0.98] flex-1 cursor-pointer"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
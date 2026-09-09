'use client';

import { useState } from 'react';
import FoodSearch from './FoodSearch';
import DishBuilder from './DishBuilder';
import RecommendedFoods from './RecommendedFoods';
import Cart from './Cart';

export default function LogFoodBuilder({ userId }) {
  const [cart, setCart] = useState([]);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
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
    </div>
  );
}

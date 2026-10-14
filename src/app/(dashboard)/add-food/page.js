import { redirect } from 'next/navigation';

// The old "Add your own dish" form is now the Recipe Builder.
export default function AddFoodPage() {
  redirect('/log-food/recipe');
}

import BottomNav from '@/components/layout/BottomNav';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50/40 dark:bg-[#090d16] md:pl-16 transition-colors duration-300">
      <div className="w-full">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
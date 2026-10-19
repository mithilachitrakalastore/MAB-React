import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Heart, User, Sparkles } from 'lucide-react';

export const BottomNav = ({ currentUser }) => {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: ShoppingBag, label: 'Shop', path: '/products' },
        { icon: Sparkles, label: 'Advice', path: '/advice' },
        { icon: Heart, label: 'Wishlist', path: '/wishlist' },
        { icon: User, label: 'Account', path: currentUser ? '/profile' : '/login' },
    ];

    return (
        <div className="fixed bottom-2 left-2 right-2 z-[110] bg-white/30 backdrop-blur-sm border border-white/10 rounded-full p-6 shadow-xl px-4 py-2 pb-2 backdrop-blur-lg lg:hidden print:hidden">
            <div className="mx-auto flex max-w-lg items-center justify-between">
                {navItems.map((item) => {
                    const isActive =
                        item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-1 flex-col items-center gap-0.5 transition-colors ${
                                isActive ? 'text-[#7C2020]' : 'text-salt-500 hover:text-salt-700'
                            }`}
                        >
                            <item.icon size={22} strokeWidth={isActive ? 2.25 : 1.75} fill={item.icon === Heart && isActive ? 'currentColor' : 'none'} />
                            <span className="text-[10px] font-semibold">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};
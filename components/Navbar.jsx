import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ShoppingCart,
    User as UserIcon,
    LogOut,
    Shield,
    Store,
    Heart,
    Search,
    ChevronDown,
} from 'lucide-react';

const NAV_LINKS = [
    { to: '/', label: 'Home', match: (path) => path === '/' },
    {
        to: '/products',
        label: 'Shop',
        match: (path) => path.startsWith('/products') || path.startsWith('/product/'),
        hasDropdown: true,
        items: [
            { label: 'All Works', to: '/products' },
            { label: 'Paintings', to: '/products?cat=paintings' },
            { label: 'Home Decor', to: '/products?cat=home-decor' },
            { label: 'Textiles', to: '/products?cat=textile-art' },
            { label: 'Crafts', to: '/products?cat=crafts' },
        ],
    },
    { to: '/journal', label: 'Journal', match: (path) => path.startsWith('/journal') },
    { to: '/advice', label: 'Art Consultants', match: (path) => path.startsWith('/advice') },
];

export const Navbar = ({ cartCount, currentUser, setCurrentUser }) => {
    const [query, setQuery] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const isAccountPage = location.pathname === '/profile' || location.pathname === '/login';

    useEffect(() => {
        setQuery(new URLSearchParams(location.search).get('q') || '');
    }, [location.pathname, location.search]);

    const logout = () => {
        setCurrentUser(null);
        navigate('/');
    };

    const runSearch = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
        else navigate('/products');
        setQuery('');
    };

    const isActive = (link) => {
        if (typeof link.to === 'object' && link.to.hash) {
            return link.match(location.pathname, location.hash);
        }
        return link.match(location.pathname, location.hash);
    };

    const sellerLink = currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin');

    return (
        <header className={`fixed inset-x-0 top-0 z-[100] print:hidden ${isAccountPage ? 'hidden lg:block' : ''}`}>
            <div className="hidden border-b border-[#e9e1d5] bg-[#fffdf9] shadow-[0_6px_24px_rgba(41,34,25,0.08)] lg:block">
                <div className="mx-auto flex max-w-[1280px] items-center gap-5 px-4 py-1 sm:px-5 sm:py-2 xl:px-8">
                    <Link to="/" className="flex w-[190px] shrink-0 items-center gap-2" aria-label="Mithila Chitrakala Store home">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d5b879] bg-[#fff5d6]">
                            <img
                                className="h-[34px] w-[34px] rounded-full object-cover"
                                src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png"
                                alt="Mithila Chitrakala Store"
                            />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-playfair text-[14px] font-bold tracking-[-0.02em] text-[#35271f]">Mithila Chitrakala</span>
                            <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.3em] text-[#9a6b39]">Store</span>
                        </div>
                    </Link>

                    <form onSubmit={runSearch} role="search" className="flex h-10 min-w-[190px] max-w-[560px] flex-1 items-center rounded-full border border-[#e5ddd1] bg-[#f8f5ef] px-2.5 transition-colors focus-within:border-[#a77c4e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#a77c4e]/15">
                        <Search size={14} className="shrink-0 text-[#8b7c6b]" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search paintings, crafts, textiles..."
                            className="h-full min-w-0 flex-1 bg-transparent px-2 text-[11px] text-[#35271f] outline-none placeholder:text-[#9a9186]"
                            aria-label="Search products"
                        />
                        <button type="submit" className="rounded-full bg-[#7c2924] px-3.5 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#65211d]">
                            Search
                        </button>
                    </form>

                    <div className="ml-auto flex shrink-0 items-center gap-4">
                        <Link
                            to={currentUser ? '/profile' : '/login'}
                            className="inline-flex items-center gap-1.5 text-[#55483b] transition-colors hover:text-[#8b332b]"
                            aria-label={currentUser ? 'Account' : 'Sign in'}
                        >
                            <UserIcon size={14} strokeWidth={1.7} />
                            <span className="text-[11px] font-medium">{currentUser ? 'Account' : 'Sign in'}</span>
                        </Link>
                        <Link
                            to="/wishlist"
                            className={`inline-flex items-center gap-1.5 transition-colors hover:text-[#8b332b] ${location.pathname === '/wishlist' ? 'text-[#8b332b]' : 'text-[#55483b]'}`}
                            aria-label="Wishlist"
                        >
                            <Heart size={14} strokeWidth={1.7} fill={location.pathname === '/wishlist' ? 'currentColor' : 'none'} />
                            <span className="text-[11px] font-medium">Wishlist</span>
                        </Link>
                        <Link
                            to="/cart"
                            className="relative inline-flex items-center gap-1 rounded-full bg-[#7c2924] px-2.5 py-1 text-white transition-colors hover:bg-[#65211d]"
                            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
                        >
                            <ShoppingCart size={14} strokeWidth={1.8} />
                            <span className="text-[11px] font-semibold">Cart</span>
                            {cartCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d8b86e] px-1 text-[9px] font-bold text-[#35271f] ring-2 ring-[#fffdf9]">
                                    {cartCount}
                                </span>
                            )}
                        </Link>
                        {currentUser && (
                            <button
                                type="button"
                                onClick={logout}
                                className="inline-flex items-center gap-1.5 text-[#786b5d] transition-colors hover:text-[#8b332b]"
                                aria-label="Sign out"
                            >
                                <LogOut size={15} strokeWidth={1.7} />
                                <span className="text-[11px] font-medium">Sign out</span>
                            </button>
                        )}
                    </div>
                </div>

                <nav className="border-t border-[#eee8df] bg-[#faf7f1]" aria-label="Main">
                    <div className="mx-auto flex h-8 max-w-[1280px] items-center justify-center gap-6 px-4 sm:px-5 xl:px-8">
                        {NAV_LINKS.map((link) => {
                            return (
                                <div key={link.label} className="group relative h-full">
                                    <Link
                                        to={link.to}
                                        aria-current={isActive(link) ? 'page' : undefined}
                                        className={`relative inline-flex h-full items-center gap-1 text-[11px] font-semibold tracking-[0.01em] transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:origin-center after:scale-x-0 after:bg-[#9c4938] after:transition-transform hover:text-[#8b332b] hover:after:scale-x-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#9c4938] ${
                                            isActive(link) ? 'text-[#8b332b] after:scale-x-100' : 'text-[#51473c]'
                                        }`}
                                    >
                                        {link.label}
                                        {link.hasDropdown && <ChevronDown size={11} className="text-[#8f7c69] transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />}
                                    </Link>
                                    {link.hasDropdown && (
                                        <div className="invisible absolute left-1/2 top-full z-20 w-52 -translate-x-1/2 translate-y-2 rounded-b-lg border border-[#e9e1d5] bg-[#fffdf9] p-1.5 opacity-0 shadow-[0_12px_24px_rgba(48,36,24,0.14)] transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                                            {link.items.map((item) => (
                                                <Link
                                                    key={item.label}
                                                    to={item.to}
                                                    className="block rounded-md px-2.5 py-2 text-xs font-medium text-[#51473c] transition-colors hover:bg-[#f5eee4] hover:text-[#8b332b] focus-visible:bg-[#f5eee4] focus-visible:outline-none"
                                                >
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {sellerLink && (
                            <a
                                href="https://dash.mithilachitrakalastore.com.np"
                                className={`inline-flex h-full items-center gap-1 text-[10px] font-semibold transition-colors hover:text-[#8b332b] ${
                                    location.pathname === '/seller' ? 'text-[#8b332b]' : 'text-[#51473c]'
                                }`}
                            >
                                {currentUser.role === 'admin' ? <Shield size={14} /> : <Store size={14} />}
                                {currentUser.role === 'admin' ? 'Admin Dashboard' : 'Seller Dashboard'}
                            </a>
                        )}
                    </div>
                </nav>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 lg:hidden">
                    <Link to="/" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80" aria-label="Mithila Chitrakala Store home">
                        <img
                            className="h-full w-full object-contain"
                            src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png"
                            alt="Mithila Chitrakala Store"
                        />
                    </Link>
                    <form onSubmit={runSearch} className="flex min-w-0 flex-1 items-center rounded-full border border-[#d8cfc2] bg-white/80 px-3 shadow-sm focus-within:border-[#9a6b4b]">
                        <Search size={16} className="shrink-0 text-[#897d70]" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search paintings, crafts..."
                            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-xs text-[#292621] outline-none placeholder:text-[#9d9489]"
                            aria-label="Search products"
                        />
                    </form>
                    <Link
                        to="/cart"
                        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9e1d5] text-[#5c1111] transition-colors hover:bg-[#dfd2c1]"
                        title="Cart"
                        aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
                    >
                        <ShoppingCart size={18} />
                        {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7c2020] px-1 text-[9px] font-bold text-white">{cartCount}</span>}
                    </Link>
                </div>

        </header>
    );
};

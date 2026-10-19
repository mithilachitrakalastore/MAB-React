import React, { useState, useEffect, useRef } from 'react';
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

const DesktopNavLink = ({ to, active, children, hasDropdown = false, onClick }) => (
    <button
        type="button"
        onClick={onClick || (() => null)}
        className={`group relative inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors sm:text-[12px] ${
            active ? 'text-[#F3D9A8]' : 'text-[#F5EFE7]/90 hover:text-[#FFF9F2]'
        }`}
    >
        <span>{children}</span>
        {hasDropdown && <ChevronDown size={14} className="opacity-80" />}
        {active && (
            <span className="absolute -bottom-1 left-2 right-2 h-[2px] rounded-full bg-[#E0B96E]" aria-hidden />
        )}
    </button>
);

export const Navbar = ({ cartCount, currentUser, setCurrentUser }) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [openDropdown, setOpenDropdown] = useState(null);
    const searchWrapRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const isAccountPage = location.pathname === '/profile' || location.pathname === '/login';

    useEffect(() => {
        setSearchOpen(false);
        setOpenDropdown(null);
        setQuery(new URLSearchParams(location.search).get('q') || '');
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!searchOpen) return undefined;

        const handlePointerDown = (event) => {
            if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
                setSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [searchOpen]);

    const logout = () => {
        setCurrentUser(null);
        navigate('/');
    };

    const runSearch = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q) navigate(`/products?q=${encodeURIComponent(q)}`);
        else navigate('/products');
        setSearchOpen(false);
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
        <header className={`fixed inset-x-0 top-0 z-[100] print:hidden ${isAccountPage ? 'hidden lg:block' : ''}`} ref={searchWrapRef}>
            <div className="w-full border-b border-[#ded7ca] bg-[#f5f1e9]/95 shadow-[0_4px_16px_rgba(41,38,33,0.06)] backdrop-blur-xl lg:border-white/10 lg:bg-[#171512]/95 lg:shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
                <div className="hidden items-center justify-between gap-2 px-3 py-2.5 sm:gap-2 sm:px-5 sm:py-3 lg:flex lg:px-4">
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 sm:gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E7C77A] bg-[#fff5d6] shadow-[0_0_0_2px_rgba(242,217,140,0.2)] transition-transform duration-200 hover:scale-[1.02] sm:h-9 sm:w-9">
                            <img
                                className="h-8 w-8 rounded-full object-cover sm:h-8 sm:w-8"
                                src="https://res.cloudinary.com/djmbuuz28/image/upload/v1761108817/logo.png"
                                alt="Mithila Chitrakala Store"
                            />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-playfair text-[14px] font-bold text-[#F7F1E7] sm:text-[18px]">Mithila Chitrakala</span>
                            <span className="mt-0.5 hidden text-[7px] font-semibold uppercase tracking-[0.32em] text-[#D5B57B] sm:block sm:text-[8px]">Store</span>
                        </div>
                    </Link>

                    <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main">
                        {NAV_LINKS.map((link) => {
                            const isDropdownOpen = openDropdown === link.label;

                            return (
                                <div key={link.label} className="relative">
                                    <DesktopNavLink
                                        to={link.to}
                                        active={isActive(link)}
                                        hasDropdown={link.hasDropdown}
                                        onClick={() => {
                                            if (link.hasDropdown) {
                                                setOpenDropdown((prev) => (prev === link.label ? null : link.label));
                                            } else {
                                                navigate(link.to);
                                            }
                                        }}
                                    >
                                        {link.label}
                                    </DesktopNavLink>

                                    {link.hasDropdown && isDropdownOpen && (
                                        <div className="absolute left-1/2 top-full mt-3 w-52 -translate-x-1/2 rounded-2xl border border-[#E7C77A]/20 bg-[#1E1A17]/95 p-2 shadow-[0_18px_35px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                                            {link.items.map((item) => (
                                                <Link
                                                    key={item.label}
                                                    to={item.to}
                                                    onClick={() => setOpenDropdown(null)}
                                                    className="block rounded-xl px-3 py-2 text-sm text-[#F5EFE7]/85 transition-colors hover:bg-white/5 hover:text-[#F3D9A8]"
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
                                className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors ${
                                    location.pathname === '/seller' ? 'text-[#F3D9A8]' : 'text-[#F5EFE7]/90 hover:text-[#FFF9F2]'
                                }`}
                            >
                                {currentUser.role === 'admin' ? <Shield size={14} /> : <Store size={14} />}
                                {currentUser.role === 'admin' ? 'Admin Dashboard' : 'Seller Dashboard'}
                            </a>
                        )}
                    </nav>

                    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setSearchOpen((v) => !v)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#F5EFE7] transition-colors hover:bg-white/10 sm:h-8 sm:w-8"
                            aria-label="Search"
                        >
                            <Search size={16} className="sm:h-[18px] sm:w-[18px]" />
                        </button>

                        <Link
                            to={currentUser ? '/profile' : '/login'}
                            className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#F5EFE7] transition-colors hover:bg-white/10 md:inline-flex sm:h-8 sm:w-8"
                            title={currentUser ? 'Account' : 'Sign in'}
                        >
                            <UserIcon size={18} />
                        </Link>

                        <Link
                            to="/wishlist"
                            className={`hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 transition-colors sm:h-8 sm:w-8 md:inline-flex ${
                                location.pathname === '/wishlist'
                                    ? 'bg-[#F3D9A8]/15 text-[#F3D9A8]'
                                    : 'bg-white/5 text-[#F5EFE7] hover:bg-white/10'
                            }`}
                            title="Wishlist"
                        >
                            <Heart size={18} fill={location.pathname === '/wishlist' ? 'currentColor' : 'none'} />
                        </Link>

                        <Link
                            to="/cart"
                            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E7C77A]/40 bg-[#B14A2E] text-white shadow-[0_10px_20px_rgba(177,74,46,0.35)] transition-transform hover:scale-[1.03] sm:h-8 sm:w-8"
                            title="Cart"
                        >
                            <ShoppingCart size={16} className="sm:h-[18px] sm:w-[18px]" />
                            {cartCount > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F7F1E7] px-1 text-[9px] font-bold text-[#1E1A17] ring-2 ring-[#1E1A17]">
                                    {cartCount}
                                </span>
                            )}
                        </Link>

                        {currentUser && (
                            <button
                                type="button"
                                onClick={logout}
                                className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#E7D9C2] hover:text-[#F3D9A8] lg:inline-flex sm:h-8 sm:w-8"
                                title="Sign out"
                            >
                                <LogOut size={16} />
                            </button>
                        )}
                    </div>
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

                {searchOpen && (
                    <div className="overflow-hidden border-t border-white/10  px-3 py-3 transition-all duration-300 ease-out sm:px-6">
                        <form
                            onSubmit={runSearch}
                            className="mx-auto flex max-w-xl gap-2"
                            style={{ animation: 'searchSlideIn 0.25s ease-out' }}
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D5B57B]" size={18} />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search art, artists, motifs..."
                                    className="w-full rounded-full border border-[#E7C77A]/90 bg-[#F8F5F1]/80 py-2.5 pl-11 pr-4 text-sm text-[#241F1A] shadow-[inset_0_0_0_1px_rgba(231,199,122,0.12)] outline-none transition-all duration-200 focus:border-[#E0B96E] focus:ring-2 focus:ring-[#E0B96E]/20"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="rounded-full bg-[#B14A2E] px-4 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(177,74,46,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#8E3824] sm:px-5"
                            >
                                Search
                            </button>
                        </form>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes searchSlideIn {
                  from {
                    opacity: 0;
                    transform: translateY(-6px) scale(0.98);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
            `}</style>
        </header>
    );
};

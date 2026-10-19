import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ChevronDown, Heart, ShieldCheck, Truck, Sparkles } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { dbService } from '../services/dbservices';

const SEARCH_SYNONYM_GROUPS = [
    ['gift', 'gifts', 'present', 'presents', 'souvenir'],
    ['home', 'house', 'living room', 'interior'],
    ['decor', 'decoration', 'ornament', 'ornaments'],
    ['painting', 'paintings', 'picture', 'pictures', 'artwork', 'canvas'],
    ['clothing', 'clothes', 'apparel', 'wear', 'outfit', 'outfits'],
    ['women', 'woman', 'womens', "women's", 'ladies', 'lady', 'female'],
    ['men', 'man', 'mens', "men's", 'male'],
    ['kids', 'children', 'child'],
    ['festival', 'festive', 'celebration', 'occasion'],
    ['handmade', 'handcrafted', 'artisan', 'artisanal'],
    ['accessory', 'accessories', 'jewelry', 'jewellery'],
    ['wall', 'walls', 'mural'],
    ['textile', 'fabric', 'cloth'],
    ['kurta', 'kurtas', 'ethnic wear'],
    ['mother', 'mothers', 'mom', 'mum'],
];

const SEARCH_STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'find', 'i', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'want', 'with']);
const normalizeSearchText = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSearchTerms = (query) => {
    const normalizedQuery = normalizeSearchText(query);
    const terms = new Set(normalizedQuery.split(' ').filter((term) => term && !SEARCH_STOP_WORDS.has(term)));

    SEARCH_SYNONYM_GROUPS.forEach((group) => {
        const normalizedGroup = group.map(normalizeSearchText);
        if (normalizedGroup.some((term) => normalizedQuery.includes(term))) {
            normalizedGroup.forEach((term) => {
                terms.add(term);
                term.split(' ').forEach((word) => {
                    if (word && !SEARCH_STOP_WORDS.has(word)) terms.add(word);
                });
            });
        }
    });

    return [...terms];
};

const getSearchScore = (product, terms) => {
    const productText = normalizeSearchText(productSearchText(product));
    return terms.reduce((score, term) => score + (productText.includes(term) ? Math.max(1, term.split(' ').length) : 0), 0);
};

const BASE_CATEGORY_LABELS = {
    'all': 'All Works',
    'paintings': 'Paintings',
    'accessories': 'Accessories',
    'home-decor': 'Home Decor',
    'gift-items': 'Gift Items',
    'wall-art': 'Wall Art',
    'textile-art': 'Textile Art',
    'crafts': 'Crafts',
};

const CATEGORY_ALIASES = {
    textiles: 'textile-art',
};

const normalizeCategory = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
    return normalized;
};

const productCategories = (value) => String(value || '')
    .split(',')
    .map((category) => normalizeCategory(category))
    .filter(Boolean);

const productAttributeValues = (value) => (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || '').split(','))
    .map((item) => String(item || '').trim())
    .filter(Boolean);

const productCollections = (product) => [...new Set([
    ...productAttributeValues(product.collection),
    ...productAttributeValues(product.collections),
    ...productAttributeValues(product.collection_name),
    ...productAttributeValues(product.category),
].map(normalizeCategory).filter(Boolean))];

const productTypes = (product) => [...new Set(productAttributeValues(product.product_type || product.type || product.category)
    .map(normalizeCategory)
    .filter(Boolean))];

const categoryLabel = (category) => category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const SORT_OPTIONS = [
    { key: 'featured', label: 'Featured First' },
    { key: 'price-asc', label: 'Price: Low to High' },
    { key: 'price-desc', label: 'Price: High to Low' },
    { key: 'rating', label: 'Top Rated' },
    { key: 'name', label: 'Name: A to Z' },
];

const STYLE_OPTIONS = [
    { key: 'traditional', label: 'Traditional', terms: ['traditional', 'mithila', 'handmade', 'painting'] },
    { key: 'modern', label: 'Modern', terms: ['modern'] },
    { key: 'folk', label: 'Folk', terms: ['folk'] },
    { key: 'contemporary', label: 'Contemporary', terms: ['contemporary'] },
    { key: 'minimal', label: 'Minimal', terms: ['minimal'] },
    { key: 'nature', label: 'Nature', terms: ['nature', 'flower', 'bird', 'tree', 'fish', 'sun'] },
    { key: 'floral', label: 'Floral', terms: ['floral', 'flower'] },
    { key: 'birds', label: 'Birds', terms: ['birds', 'bird'] },
    { key: 'devotional', label: 'Devotional', terms: ['devotional', 'god', 'goddess', 'krishna', 'radha', 'shiva', 'sita', 'ram'] },
    { key: 'mythology', label: 'Mythology', terms: ['mythology', 'myth'] },
    { key: 'village-life', label: 'Village Life', terms: ['village life', 'village'] },
    { key: 'folklore', label: 'Folklore', terms: ['folklore', 'story'] },
    { key: 'abstract', label: 'Abstract', terms: ['abstract'] },
];

const productSearchText = (product) => [
    product.style,
    product.theme,
    product.tags,
    product.custom_tags,
    product.category,
    product.name,
    product.description,
    product.key_features,
    product.material,
    product.product_code,
    product.storeName,
].flat().filter(Boolean).join(' ').toLowerCase();

const audienceScore = (product, gender) => {
    const preference = String(gender || '').toLowerCase();
    if (preference !== 'female' && preference !== 'male') return 0;

    const categories = productCategories(product.category).join(' ');
    const isWomens = /\bwomen(?:'s)?\b|\bladies\b/.test(categories);
    const isMens = /\bmen(?:'s)?\b/.test(categories);
    const isUnisex = /\bunisex\b/.test(categories);
    const matchesPreference = preference === 'female' ? isWomens : isMens;
    const matchesOtherPreference = preference === 'female' ? isMens : isWomens;

    if (matchesPreference) return 2;
    if (isUnisex) return 1;
    if (matchesOtherPreference) return -1;
    return 0;
};

export const ProductsPage = ({ products, addToCart, wishlist, toggleWishlist, currentUser }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(() => searchParams.get('q') || '');
    const [assistantSearch, setAssistantSearch] = useState('');
    const [sort, setSort] = useState('featured');
    const [filterOpen, setFilterOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [mobileFilterSection, setMobileFilterSection] = useState('collection');
    const [selectedStyles, setSelectedStyles] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [priceLimit, setPriceLimit] = useState(null);
    const [savedCategories, setSavedCategories] = useState([]);
    const category = normalizeCategory(searchParams.get('cat') || 'all');
    const selectedCategory = CATEGORY_ALIASES[category] || category;

    const maxPrice = useMemo(() => Math.max(10000, ...products.map((product) => Number(product.price) || 0)), [products]);
    const activePriceLimit = priceLimit ?? maxPrice;
    const activeFilterCount = selectedTypes.length + selectedStyles.length + (selectedCategory !== 'all' ? 1 : 0) + (priceLimit !== null ? 1 : 0);

    useEffect(() => {
        setSearch(searchParams.get('q') || '');
        setAssistantSearch('');
    }, [searchParams]);

    useEffect(() => {
        const desktopQuery = window.matchMedia('(min-width: 1024px)');
        const updateDesktopLayout = () => setIsDesktop(desktopQuery.matches);
        updateDesktopLayout();
        desktopQuery.addEventListener('change', updateDesktopLayout);
        return () => desktopQuery.removeEventListener('change', updateDesktopLayout);
    }, []);

    useEffect(() => {
        if (!filterOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setFilterOpen(false);
        };
        document.addEventListener('keydown', closeOnEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.body.style.overflow = previousOverflow;
        };
    }, [filterOpen]);

    useEffect(() => {
        let isMounted = true;
        dbService.getProductCategories()
            .then((categories) => {
                if (isMounted) setSavedCategories((categories || []).map((item) => item.name).filter(Boolean));
            })
            .catch((error) => console.error('Unable to load product categories:', error));
        return () => { isMounted = false; };
    }, []);

    const setCategory = (cat) => {
        if (cat === 'all') searchParams.delete('cat');
        else searchParams.set('cat', cat);
        setSearchParams(searchParams, { replace: true });
    };

    const toggleStyle = (styleKey) => {
        setSelectedStyles((current) => current.includes(styleKey)
            ? current.filter((style) => style !== styleKey)
            : [...current, styleKey]);
    };

    const toggleType = (typeKey) => {
        setSelectedTypes((current) => current.includes(typeKey)
            ? current.filter((type) => type !== typeKey)
            : [...current, typeKey]);
    };

    const clearFilters = () => {
        setSearch('');
        setAssistantSearch('');
        setCategory('all');
        setSelectedStyles([]);
        setSelectedTypes([]);
        setPriceLimit(null);
        setSort('featured');
    };

    const handleAssistantSearch = (event) => {
        event.preventDefault();
        const query = search.trim();
        if (query) setAssistantSearch(query);
    };

    const categoryCounts = useMemo(() => {
        const counts = { all: products.length };
        products.forEach(p => {
            productCollections(p).forEach((normalizedCategory) => {
                counts[normalizedCategory] = (counts[normalizedCategory] || 0) + 1;
            });
        });
        return counts;
    }, [products]);

    const typeOptions = useMemo(() => {
        const counts = new Map();
        products.forEach((product) => {
            productTypes(product).forEach((type) => counts.set(type, (counts.get(type) || 0) + 1));
        });
        return [...counts].map(([key, count]) => ({ key, label: categoryLabel(key), count }));
    }, [products]);

    const styleOptions = useMemo(() => {
        const options = new Map(STYLE_OPTIONS.map((style) => [style.key, style]));
        products.flatMap((product) => [product.style, product.theme])
            .flatMap((value) => String(value || '').split(','))
            .map((value) => value.trim())
            .filter(Boolean)
            .forEach((value) => {
                const key = normalizeCategory(value);
                if (!options.has(key)) options.set(key, { key, label: value, terms: [value.toLowerCase(), key.replace(/-/g, ' ')] });
            });
        return [...options.values()];
    }, [products]);

    const styleCounts = useMemo(() => Object.fromEntries(
        styleOptions.map((style) => [
            style.key,
            products.filter((product) => style.terms.some((term) => productSearchText(product).includes(term))).length,
        ])
    ), [products, styleOptions]);

    const categoryOptions = useMemo(() => {
        const existingCategories = new Set([
            ...savedCategories.map((savedCategory) => normalizeCategory(savedCategory)),
            ...products.flatMap(productCollections),
        ]);
        const options = Object.entries(BASE_CATEGORY_LABELS);
        existingCategories.forEach((categoryKey) => {
            if (!BASE_CATEGORY_LABELS[categoryKey] && !options.some(([key]) => key === categoryKey)) {
                options.push([categoryKey, categoryLabel(categoryKey)]);
            }
        });
        return options;
    }, [products, savedCategories]);

    const filtered = useMemo(() => {
        const activeAssistantSearch = assistantSearch && assistantSearch === search.trim()
            ? getSearchTerms(assistantSearch)
            : null;
        const list = products.filter(p => {
            const q = search.toLowerCase();
            const productText = productSearchText(p);
            const matchesSearch = activeAssistantSearch
                ? getSearchScore(p, activeAssistantSearch) > 0
                : String(p.name || '').toLowerCase().includes(q) ||
                    String(p.description || '').toLowerCase().includes(q) ||
                    String(p.storeName || '').toLowerCase().includes(q);
            const matchesCategory = selectedCategory === 'all' || productCollections(p).includes(selectedCategory);
            const matchesType = selectedTypes.length === 0 || selectedTypes.some((type) => productTypes(p).includes(type));
            const matchesStyle = selectedStyles.length === 0 || selectedStyles.some((styleKey) => {
                const style = styleOptions.find((option) => option.key === styleKey);
                return style?.terms.some((term) => productText.includes(term));
            });
            const matchesPrice = (Number(p.price) || 0) <= activePriceLimit;
            return matchesSearch && matchesCategory && matchesType && matchesStyle && matchesPrice;
        });
        switch (sort) {
            case 'price-asc': return [...list].sort((a, b) => a.price - b.price);
            case 'price-desc': return [...list].sort((a, b) => b.price - a.price);
            case 'rating': return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
            case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name));
            default: return [...list].sort((a, b) =>
                (activeAssistantSearch ? getSearchScore(b, activeAssistantSearch) - getSearchScore(a, activeAssistantSearch) : 0) ||
                audienceScore(b, currentUser?.gender) - audienceScore(a, currentUser?.gender) ||
                (b.featured === true) - (a.featured === true)
            );
        }
    }, [products, search, assistantSearch, selectedCategory, selectedTypes, selectedStyles, activePriceLimit, sort, currentUser?.gender]);

    return (
        <div className="min-h-screen bg-[#f5f1e9] pb-20 pt-[4.5rem] text-[#292621] sm:pb-28 sm:pt-[5.2rem]">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-8 lg:px-10">
                <div className="flex items-center gap-2 py-3 text-[10px] text-[#81786d] sm:py-4"><span>Home</span><span>/</span><span className="text-[#292621]">Shop</span></div>
                {currentUser?.role === 'customer' && currentUser.gender && <p className="mb-4 text-xs text-[#71695e]">Recommendations are personalized to your shopping preference. You can still browse every product.</p>}
                <div className="mb-5 border-y border-[#ded7ca] py-2 sm:mb-7 sm:py-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="hidden text-[10px] text-[#81786d] sm:block">Showing <strong className="text-[#292621]">1–{filtered.length}</strong> of {products.length} products</p>
                        <div className="flex w-full items-center justify-around text-[10px] sm:ml-auto sm:w-auto sm:justify-end sm:gap-2 sm:text-[#81786d]">
                            <button type="button" onClick={() => setSort('featured')} className={`px-2 py-2 font-semibold sm:hidden ${sort === 'featured' ? 'text-[#7c2020]' : 'text-[#6f675e]'}`}>Best Match</button>
                            <button type="button" onClick={() => setSort('rating')} className={`px-2 py-2 font-semibold sm:hidden ${sort === 'rating' ? 'text-[#7c2020]' : 'text-[#6f675e]'}`}>Top Rated</button>
                            <button type="button" onClick={() => setSort(sort === 'price-asc' ? 'price-desc' : 'price-asc')} className={`inline-flex items-center gap-1 px-2 py-2 font-semibold sm:hidden ${sort.startsWith('price-') ? 'text-[#7c2020]' : 'text-[#6f675e]'}`}>Price<ChevronDown size={12} className={sort === 'price-asc' ? 'rotate-180' : ''} /></button>
                            <div className="hidden items-center gap-2 text-[10px] text-[#81786d] sm:flex"><span>Sort by:</span><div className="relative"><select value={sort} onChange={(e) => setSort(e.target.value)} className="appearance-none bg-transparent py-2 pl-1 pr-6 font-semibold text-[#292621] outline-none"><option value="featured">Popularity</option>{SORT_OPTIONS.filter((option) => option.key !== 'featured').map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2" /></div></div>
                        </div>
                    </div>
                    <div className="-mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:hidden">
                        <button type="button" onClick={() => setFilterOpen(true)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#d9b7a8] bg-[#fff8f2] px-3 text-[10px] font-semibold text-[#7c2020]"><Filter size={13} /> Filter{activeFilterCount > 0 && <span className="ml-0.5">{activeFilterCount}</span>}<ChevronDown size={12} /></button>
                        {categoryOptions.filter(([collection]) => collection !== 'all').map(([collection, label]) => <button key={collection} type="button" onClick={() => setCategory(selectedCategory === collection ? 'all' : collection)} className={`min-h-9 shrink-0 rounded-lg px-3 text-[10px] font-medium transition-colors ${selectedCategory === collection ? 'bg-[#7c2020] text-white' : 'bg-[#eeeae4] text-[#6f675e]'}`}>{label}</button>)}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-7 lg:grid-cols-[245px_minmax(0,1fr)] lg:items-start lg:gap-8">
                {filterOpen && <button type="button" onClick={() => setFilterOpen(false)} className="fixed inset-0 z-[80] cursor-default bg-black/40 lg:hidden" aria-label="Close filters" />}
                <aside
                    aria-hidden={!filterOpen && !isDesktop}
                    inert={!filterOpen && !isDesktop}
                    className={`fixed inset-x-0 bottom-0 top-[12vh] z-[120] flex flex-col overflow-hidden rounded-t-2xl border border-[#e0d8cb] bg-white shadow-2xl transition-transform duration-300 ease-out lg:sticky lg:top-24 lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:w-auto lg:translate-x-0 lg:translate-y-0 lg:rounded-xl lg:border lg:shadow-sm ${filterOpen ? 'translate-y-0' : 'translate-y-full'}`}
                    aria-label="Product filters"
                >
                    <div className="flex items-center justify-between border-b border-[#e6dfd4] px-4 py-3 lg:px-5 lg:py-4">
                        <div className="flex items-center gap-3">
                            <span className="h-1 w-8 rounded-full bg-[#d8d2ca] lg:hidden" />
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-[0.16em]">Filters</h2>
                                <p className="mt-1 text-[9px] text-[#81786d]">{filtered.length} products match</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setFilterOpen(false)} className="rounded-full p-2 text-[#6f675e] hover:bg-[#eee8dc] lg:hidden" aria-label="Close filters"><X size={17} /></button>
                    </div>
                    <div className="flex min-h-0 flex-1">
                        <nav className="w-[112px] shrink-0 overflow-y-auto bg-[#f5f5f5] py-1 sm:w-[145px] lg:hidden" aria-label="Filter sections">
                            {[
                                ['collection', 'Collection'],
                                ['type', 'Product Type'],
                                ['price', 'Price'],
                                ['style', 'Style / Theme'],
                            ].map(([key, label]) => <button key={key} type="button" onClick={() => setMobileFilterSection(key)} className={`relative w-full px-3 py-4 text-left text-[10px] leading-tight ${mobileFilterSection === key ? 'bg-white font-bold text-[#c75a25]' : 'text-[#6f675e]'}`}>{mobileFilterSection === key && <span className="absolute inset-y-0 left-0 w-1 bg-[#c75a25]" />}{label}</button>)}
                        </nav>
                        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 lg:px-5">
                        <section className={`lg:hidden ${mobileFilterSection === 'collection' ? '' : 'hidden'}`}>
                            <h3 className="mb-3 text-sm font-semibold text-[#292621]">Collection</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {categoryOptions.map(([collection, label]) => <button key={collection} type="button" onClick={() => setCategory(collection)} className={`min-h-10 rounded-md px-2 text-[10px] ${selectedCategory === collection ? 'border border-[#c75a25] bg-[#fff5ef] font-semibold text-[#c75a25]' : 'bg-[#f6f6f6] text-[#6f675e]'}`}>{label}<span className="ml-1 text-[8px] opacity-70">({categoryCounts[collection] || 0})</span></button>)}
                            </div>
                        </section>
                        <section className={`lg:hidden ${mobileFilterSection === 'type' ? '' : 'hidden'}`}>
                            <h3 className="mb-3 text-sm font-semibold text-[#292621]">Product Type</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {typeOptions.map((type) => {
                                    const isSelected = selectedTypes.includes(type.key);
                                    return <button key={type.key} type="button" onClick={() => toggleType(type.key)} className={`min-h-10 rounded-md px-2 text-[10px] ${isSelected ? 'border border-[#c75a25] bg-[#fff5ef] font-semibold text-[#c75a25]' : 'bg-[#f6f6f6] text-[#6f675e]'}`}>{type.label}<span className="ml-1 text-[8px] opacity-70">({type.count})</span></button>;
                                })}
                            </div>
                        </section>
                        <section className={`lg:hidden ${mobileFilterSection === 'price' ? '' : 'hidden'}`}>
                            <h3 className="mb-3 text-sm font-semibold text-[#292621]">Price</h3>
                            <input type="range" min="0" max={maxPrice} step="100" value={activePriceLimit} onChange={(event) => setPriceLimit(Number(event.target.value))} className="h-1 w-full cursor-pointer accent-[#c75a25]" aria-label="Maximum price" />
                            <div className="mt-2 flex justify-between text-[10px] text-[#81786d]"><span>Rs 0</span><span>{activePriceLimit >= maxPrice ? `Rs ${maxPrice.toLocaleString()}+` : `Up to Rs ${activePriceLimit.toLocaleString()}`}</span></div>
                        </section>
                        <section className={`lg:hidden ${mobileFilterSection === 'style' ? '' : 'hidden'}`}>
                            <h3 className="mb-3 text-sm font-semibold text-[#292621]">Style / Theme</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {styleOptions.map((style) => {
                                    const count = styleCounts[style.key] || 0;
                                    const isSelected = selectedStyles.includes(style.key);
                                    return <button key={style.key} type="button" disabled={count === 0} onClick={() => toggleStyle(style.key)} className={`min-h-10 rounded-md px-2 text-[10px] disabled:opacity-40 ${isSelected ? 'border border-[#c75a25] bg-[#fff5ef] font-semibold text-[#c75a25]' : 'bg-[#f6f6f6] text-[#6f675e]'}`}>{style.label}<span className="ml-1 text-[8px] opacity-70">({count})</span></button>;
                                })}
                            </div>
                        </section>
                        <div className="hidden space-y-6 lg:block">
                        <section>
                            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em]">Collection</h3>
                            <div className="space-y-1 border-t border-[#e6dfd4] pt-2">
                                {categoryOptions.map(([collection, label]) => <button key={collection} type="button" onClick={() => setCategory(collection)} className={`flex w-full items-center justify-between border-b border-[#eee8df] py-2 text-left text-[10px] transition-colors ${selectedCategory === collection ? 'font-bold text-[#7c2020]' : 'text-[#6f675e] hover:text-[#7c2020]'}`}><span>{label}</span><span className="text-[8px] text-[#a39a8d]">({categoryCounts[collection] || 0})</span></button>)}
                            </div>
                        </section>
                        <section className="border-t border-[#e6dfd4] pt-4">
                            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em]">Product Type</h3>
                            <div className="space-y-1">
                                {typeOptions.map((type) => {
                                    const isSelected = selectedTypes.includes(type.key);
                                    return <label key={type.key} className={`flex items-center gap-3 border px-3 py-2.5 text-[10px] transition-colors ${isSelected ? 'cursor-pointer border-[#d9b7a8] bg-[#f3e4db] font-bold text-[#7c2020]' : 'cursor-pointer border-transparent text-[#6f675e] hover:border-[#e6dfd4] hover:bg-white'}`}><input type="checkbox" checked={isSelected} onChange={() => toggleType(type.key)} className="h-3.5 w-3.5 cursor-pointer accent-[#7c2020]" /><span className="flex-1">{type.label}</span><span className="text-[8px] text-[#a39a8d]">{type.count}</span></label>;
                                })}
                            </div>
                        </section>
                        <section className="border-t border-[#e6dfd4] pt-4">
                            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]">Price Range</h3>
                            <input type="range" min="0" max={maxPrice} step="100" value={activePriceLimit} onChange={(event) => setPriceLimit(Number(event.target.value))} className="h-1 w-full cursor-pointer accent-[#7c2020]" aria-label="Maximum price" />
                            <div className="mt-2 flex justify-between text-[8px] text-[#81786d]"><span>Rs 0</span><span>{activePriceLimit >= maxPrice ? `Rs ${maxPrice.toLocaleString()}+` : `Up to Rs ${activePriceLimit.toLocaleString()}`}</span></div>
                        </section>
                        <section className="border-t border-[#e6dfd4] pt-4">
                            <div className="mb-3 flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-[0.16em]">Style / Theme</h3><span className="text-[8px] text-[#a39a8d]">Optional</span></div>
                            <div className="space-y-1">{styleOptions.map((style) => {
                                const count = styleCounts[style.key] || 0;
                                const isSelected = selectedStyles.includes(style.key);
                                return <label key={style.key} className={`flex items-center gap-3 border px-3 py-2.5 text-[10px] transition-colors ${count === 0 ? 'cursor-not-allowed border-transparent text-[#b8aea0]' : isSelected ? 'cursor-pointer border-[#d9b7a8] bg-[#f3e4db] font-bold text-[#7c2020]' : 'cursor-pointer border-transparent text-[#6f675e] hover:border-[#e6dfd4] hover:bg-white'}`}><input type="checkbox" checked={isSelected} onChange={() => toggleStyle(style.key)} disabled={count === 0} className="h-3.5 w-3.5 cursor-pointer accent-[#7c2020] disabled:cursor-not-allowed disabled:opacity-40" /><span className="flex-1">{style.label}</span><span className={`text-[8px] ${isSelected ? 'text-[#7c2020]' : 'text-[#a39a8d]'}`}>{count}</span></label>;
                            })}</div>
                        </section>
                        </div>
                    </div>
                    </div>
                    <div className="flex gap-2 border-t border-[#e6dfd4] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-4">
                        <button type="button" onClick={clearFilters} className="flex-1 rounded-md border border-[#cfc6b8] py-3 text-[10px] font-semibold text-[#6f675e] transition-colors hover:border-[#7c2020] hover:text-[#7c2020] lg:text-[9px] lg:font-bold lg:uppercase lg:tracking-[0.14em]">Reset</button>
                        <button type="button" onClick={() => setFilterOpen(false)} className="flex-1 rounded-md bg-[#ee5b0b] py-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#d84e06] lg:bg-[#7c2020] lg:py-3 lg:text-[9px] lg:font-bold lg:uppercase lg:tracking-[0.14em] lg:hover:bg-[#5c1111]">Done <span className="block text-[9px] font-normal lg:hidden">{filtered.length} Products</span><span className="hidden lg:inline"> {filtered.length} Products</span></button>
                    </div>
                </aside>

                <main>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <p className="text-[10px] text-[#81786d] sm:hidden">{filtered.length} {filtered.length === 1 ? 'piece' : 'pieces'}</p>
                            <form onSubmit={handleAssistantSearch} className="ml-auto flex w-full max-w-[430px] items-center gap-2">
                                <div className="relative min-w-0 flex-1">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c9387]" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value);
                                            setAssistantSearch('');
                                        }}
                                        placeholder="Search products..."
                                        className="w-full border-b border-[#cfc6b8] bg-transparent py-2 pl-8 pr-7 text-[11px] outline-none placeholder:text-[#a59c90] focus:border-[#7c2020]"
                                        aria-label="Search products"
                                    />
                                    {search && <button type="button" onClick={() => { setSearch(''); setAssistantSearch(''); }} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#81786d]" aria-label="Clear search"><X size={13} /></button>}
                                </div>
                                <button type="submit" disabled={!search.trim()} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded bg-[#7c2020] px-3 text-[9px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#5c1111] disabled:cursor-not-allowed disabled:opacity-50">
                                    <Sparkles size={13} /> Find products
                                </button>
                            </form>
                        </div>
                        {assistantSearch === search.trim() && assistantSearch && <p className="mb-4 text-xs text-[#71695e]" role="status">Product finder matched {filtered.length} {filtered.length === 1 ? 'product' : 'products'} using related words, categories and product details.</p>}
                        {filtered.length > 0 ? <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-6 xl:grid-cols-4">{filtered.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 55}><ProductCard product={p} addToCart={addToCart} isWishlisted={wishlist.includes(p.id)} toggleWishlist={toggleWishlist} /></Reveal>)}</div> : <div className="border border-dashed border-[#cfc6b8] bg-[#fbf9f5] px-6 py-24 text-center"><Filter size={28} className="mx-auto mb-5 text-[#b8aea0]" /><h3 className="font-playfair text-2xl font-bold">No works found</h3><p className="mt-2 text-sm text-[#81786d]">Try another search or clear your filters.</p><button onClick={clearFilters} className="mt-6 bg-[#7c2020] px-5 py-3 text-[9px] font-bold uppercase tracking-widest text-white">Clear Filters</button></div>}
                    </main>
                </div>
                <div className="mt-12 grid grid-cols-3 border-y border-[#ded7ca] py-5 text-center text-[#6f675e] sm:mt-16"><div className="flex flex-col items-center gap-1 border-r border-[#ded7ca] text-[8px] uppercase tracking-[0.13em] sm:flex-row sm:justify-center sm:text-[9px]"><ShieldCheck size={15} /> <span>100% Genuine</span></div><div className="flex flex-col items-center gap-1 border-r border-[#ded7ca] text-[8px] uppercase tracking-[0.13em] sm:flex-row sm:justify-center sm:text-[9px]"><Truck size={15} /> <span>Secure Delivery</span></div><div className="flex flex-col items-center gap-1 text-[8px] uppercase tracking-[0.13em] sm:flex-row sm:justify-center sm:text-[9px]"><Heart size={15} /> <span>Support Artists</span></div></div>
            </div>
        </div>
    );
}

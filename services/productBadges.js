const BADGE_RULES = [
    {
        id: 'best-match',
        label: 'Best Match',
        variant: 'primary',
        matches: ({ product }) => Boolean(product.featured),
    },
    {
        id: 'top',
        label: 'Top',
        variant: 'success',
        matches: ({ product, topSalesThreshold }) => Number(product.sold || 0) >= topSalesThreshold,
    },
    {
        id: 'recommended',
        label: 'Recommended',
        variant: 'saffron',
        matches: ({ product }) => Number(product.rating || 0) >= 4.5 && Number(product.reviewCount || 0) >= 3,
    },
    {
        id: 'for-you',
        label: 'For You',
        variant: 'personalized',
        matches: ({ product, wishlistProducts }) => matchesWishlistPreferences(product, wishlistProducts),
    },
];
const salesThresholdCache = new WeakMap();

const attributeValues = (value) => (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || '').split(','))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const matchesWishlistPreferences = (product, wishlistProducts = []) => {
    const productCategories = new Set(attributeValues(product.category));
    const productStyles = new Set([...attributeValues(product.style), ...attributeValues(product.theme)]);
    return wishlistProducts.some((savedProduct) => {
        if (!savedProduct || savedProduct.id === product.id) return false;
        const sameCategory = attributeValues(savedProduct.category).some((category) => productCategories.has(category));
        const sameStyle = [...attributeValues(savedProduct.style), ...attributeValues(savedProduct.theme)]
            .some((style) => productStyles.has(style));
        return sameCategory || sameStyle;
    });
};

const getTopSalesThreshold = (catalog = []) => {
    if (salesThresholdCache.has(catalog)) return salesThresholdCache.get(catalog);
    const sales = catalog.map((product) => Number(product.sold || 0)).filter((count) => count > 0).sort((a, b) => a - b);
    const threshold = sales.length
        ? Math.max(5, sales[Math.floor((sales.length - 1) * 0.75)])
        : Infinity;
    salesThresholdCache.set(catalog, threshold);
    return threshold;
};

export const getProductBadges = (product, { catalog = [], wishlistProducts = [] } = {}) => {
    if (!product) return [];
    const topSalesThreshold = getTopSalesThreshold(catalog);
    const manualLabel = String(product.badge || '').trim();
    const automaticBadges = BADGE_RULES
        .filter((rule) => rule.matches({ product, topSalesThreshold, wishlistProducts }))
        .map(({ id, label, variant }) => ({ id, label, variant }));

    if (!manualLabel) return automaticBadges;

    const normalizedManualLabel = manualLabel.toLowerCase();
    const matchingRule = BADGE_RULES.find((rule) => rule.label.toLowerCase() === normalizedManualLabel);
    const manualBadge = {
        id: matchingRule?.id || 'custom',
        label: manualLabel,
        variant: matchingRule?.variant || (normalizedManualLabel.includes('sale') || normalizedManualLabel === 'bestseller' ? 'saffron' : 'primary'),
    };
    return [
        manualBadge,
        ...automaticBadges.filter((badge) => badge.label.toLowerCase() !== normalizedManualLabel),
    ];
};

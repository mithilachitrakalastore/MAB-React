import React from 'react';
import { getProductBadges } from '../services/productBadges';
import { Badge } from './Badge';

export const ProductBadges = ({ product, context, limit = 3, fallbackLabel }) => {
    const badges = getProductBadges(product, context).slice(0, limit);
    if (!badges.length && !fallbackLabel) return null;

    return (
        <div className="flex flex-wrap items-start gap-1.5" aria-label="Product highlights">
            {badges.map((badge) => (
                <Badge key={badge.id} variant={badge.variant}>{badge.label}</Badge>
            ))}
            {!badges.length && fallbackLabel && <Badge variant="saffron">{fallbackLabel}</Badge>}
        </div>
    );
};

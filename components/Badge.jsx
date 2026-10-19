import React from 'react';

export const Badge = ({ children, variant = 'primary' }) => {
    const styles = {
        primary: 'bg-[#5c1111] text-white border-white/20',
        saffron: 'bg-amber-400 text-amber-950 border-amber-300',
        cancelled: 'bg-red-100 text-red-800 border-red-200',
        success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
        personalized: 'bg-violet-100 text-violet-900 border-violet-200',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[7px] sm:text-[9px] font-black uppercase tracking-[0.15em] shadow-md border backdrop-blur-sm ${styles[variant]}`}>
            {children}
        </span>
    );
};

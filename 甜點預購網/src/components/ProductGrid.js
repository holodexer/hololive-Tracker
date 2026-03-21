import { jsx as _jsx } from "react/jsx-runtime";
import { ProductCard } from './ProductCard';
export const ProductGrid = ({ products, onSelectProduct, loading, error, }) => {
    if (loading) {
        return (_jsx("div", { className: "col-span-full text-center py-20 text-gray-400 animate-pulse", children: "\u8F09\u5165\u5546\u54C1\u4E2D..." }));
    }
    if (error) {
        return (_jsx("div", { className: "col-span-full text-center py-20 text-cake-accent font-bold", children: error }));
    }
    if (products.length === 0) {
        return (_jsx("div", { className: "col-span-full text-center py-20 text-gray-400", children: "\u66AB\u7121\u5546\u54C1" }));
    }
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8", children: products.map((product) => (_jsx(ProductCard, { product: product, onSelect: onSelectProduct }, product.id))) }));
};

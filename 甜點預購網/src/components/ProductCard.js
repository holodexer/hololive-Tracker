import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export const ProductCard = ({ product, onSelect }) => {
    const isOutOfStock = product.stock <= 0;
    return (_jsxs("div", { onClick: () => !isOutOfStock && onSelect(product), className: `bg-white rounded-3xl p-4 transition-all duration-300 cursor-pointer
        ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1 border-cake-pink border-2'}
        border-2 border-cake-pink
      `, children: [_jsxs("div", { className: "relative w-full h-52 rounded-2xl overflow-hidden mb-4", children: [_jsx("img", { src: product.img || 'https://via.placeholder.com/200', alt: product.name, className: "w-full h-full object-cover", onError: (e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/200';
                        } }), isOutOfStock && (_jsx("div", { className: "absolute inset-0 bg-black/50 flex items-center justify-center", children: _jsx("span", { className: "text-white text-2xl font-bold drop-shadow-lg", children: "\u5DF2\u552E\u5B8C" }) }))] }), _jsxs("div", { children: [_jsx("span", { className: "inline-block bg-gradient-to-r from-cake-accent to-cake-peach text-white px-4 py-1 rounded-full text-xs font-bold mb-3 shadow-md", children: product.tag || '商品' }), _jsx("h3", { className: "font-bold text-lg text-cake-coffee mb-2", children: product.name }), _jsxs("div", { className: "font-bold text-cake-accent text-xl mb-2", children: ["NT$ ", product.price] }), _jsx("div", { className: "text-xs text-gray-600", children: isOutOfStock ? (_jsx("span", { className: "font-bold text-cake-accent", children: "\u5DF2\u552E\u5B8C" })) : (_jsxs(_Fragment, { children: ["\u5EAB\u5B58: ", product.stock] })) })] })] }));
};

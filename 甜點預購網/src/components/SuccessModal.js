import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
export const SuccessModal = ({ isOpen, name, productName, quantity, totalPrice, onClose, }) => {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm", children: _jsxs("div", { className: "bg-white rounded-4xl w-11/12 max-w-md text-center shadow-2xl overflow-hidden animate-slideUp", children: [_jsx("div", { className: "bg-gradient-to-r from-cake-sage to-cake-mint py-12", children: _jsx("div", { className: "inline-block relative w-20 h-20", children: _jsx("i", { className: "fas fa-check-circle text-6xl text-white animate-scaleUp" }) }) }), _jsxs("div", { className: "p-8", children: [_jsx("h2", { className: "text-2xl font-bold text-cake-accent mb-4", children: "\u9810\u8CFC\u6210\u529F\uFF01" }), _jsxs("div", { className: "bg-cake-cream rounded-2xl p-4 space-y-3 text-left mb-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-bold text-gray-600", children: "\u9810\u8CFC\u8005" }), _jsx("span", { className: "text-base font-bold text-cake-coffee", children: name })] }), _jsx("div", { className: "border-t border-cake-light-pink" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-bold text-gray-600", children: "\u5546\u54C1" }), _jsx("span", { className: "text-base font-bold text-cake-coffee", children: productName })] }), _jsx("div", { className: "border-t border-cake-light-pink" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-bold text-gray-600", children: "\u6578\u91CF" }), _jsxs("span", { className: "text-base font-bold text-cake-coffee", children: [quantity, " \u4EFD"] })] }), _jsx("div", { className: "border-t border-cake-light-pink" }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-bold text-gray-600", children: "\u7E3D\u91D1\u984D" }), _jsxs("span", { className: "text-lg font-bold text-cake-accent", children: ["NT$ ", totalPrice] })] })] }), _jsx("p", { className: "text-cake-coffee text-sm mb-6", children: "\u2728 \u611F\u8B1D\u60A8\u7684\u9810\u8CFC\uFF01\u5C0F\u718A\u6703\u76E1\u5FEB\u6E96\u5099\u60A8\u7684\u8A02\u55AE\u3002" }), _jsx("button", { onClick: onClose, className: "w-full bg-gradient-to-r from-cake-accent to-cake-peach text-white font-bold py-3 rounded-full hover:shadow-lg transition-all", children: "\u95DC\u9589" })] })] }) }));
};

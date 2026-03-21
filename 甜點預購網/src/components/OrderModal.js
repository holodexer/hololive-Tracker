import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export const OrderModal = ({ isOpen, product, onClose, onSubmit, }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        quantity: '1',
        note: '',
    });
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        if (product) {
            setFormData({
                name: '',
                phone: '',
                quantity: '1',
                note: '',
            });
        }
    }, [product]);
    const quantity = parseInt(formData.quantity) || 0;
    const totalPrice = product ? quantity * product.price : 0;
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, phone: value }));
    };
    const handleQuantityChange = (e) => {
        let value = parseInt(e.target.value) || 0;
        if (product && value > product.stock) {
            alert(`目前「${product.name}」剩餘庫存為 ${product.stock}`);
            value = product.stock;
        }
        setFormData(prev => ({ ...prev, quantity: value.toString() }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product)
            return;
        setSubmitting(true);
        try {
            await onSubmit({
                name: formData.name,
                phone: formData.phone,
                productName: product.name,
                quantity: parseInt(formData.quantity),
                totalPrice,
                note: formData.note,
            });
        }
        finally {
            setSubmitting(false);
        }
    };
    if (!isOpen || !product)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm", onClick: onClose, children: _jsxs("div", { className: "bg-white rounded-4xl w-11/12 max-w-md relative shadow-2xl overflow-hidden", onClick: e => e.stopPropagation(), children: [_jsx("button", { onClick: onClose, className: "absolute top-5 right-5 text-cake-accent hover:scale-110 transition-transform text-2xl z-10", children: _jsx("i", { className: "fas fa-times-circle" }) }), _jsxs("div", { className: "bg-gradient-to-r from-cake-yellow to-cake-pink p-8 text-center", children: [_jsx("img", { src: product.img || 'https://via.placeholder.com/200', alt: product.name, className: "w-32 h-32 rounded-full border-4 border-white object-cover mx-auto mb-4", onError: e => {
                                e.currentTarget.src = 'https://via.placeholder.com/200';
                            } }), _jsx("h2", { className: "text-2xl font-bold text-cake-coffee", children: product.name })] }), _jsx("div", { className: "p-8", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-cake-coffee mb-2", children: "\u600E\u9EBC\u7A31\u547C\u60A8\uFF1F" }), _jsx("input", { type: "text", placeholder: "\u4F8B\u5982\uFF1A\u718A\u5148\u751F", value: formData.name, onChange: e => setFormData(prev => ({ ...prev, name: e.target.value })), className: "w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-cake-coffee mb-2", children: "\u96FB\u8A71 (\u9700\u70BA10\u78BC\u6578\u5B57)" }), _jsx("input", { type: "tel", placeholder: "0912345678", value: formData.phone, onChange: handlePhoneChange, maxLength: 10, className: "w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all", required: true })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-bold text-cake-coffee mb-2", children: ["\u9810\u8CFC\u6578\u91CF (\u5EAB\u5B58\u5269\u9918\uFF1A", product.stock, ")"] }), _jsx("input", { type: "number", min: "1", max: product.stock, value: formData.quantity, onChange: handleQuantityChange, className: "w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-bold text-cake-coffee mb-2", children: "\u6709\u4EC0\u9EBC\u60F3\u544A\u8A34\u5C0F\u718A\u7684\uFF1F (\u5099\u8A3B)" }), _jsx("textarea", { rows: 2, placeholder: "\u5099\u8A3B\u7279\u6B8A\u9700\u6C42...", value: formData.note, onChange: e => setFormData(prev => ({ ...prev, note: e.target.value })), className: "w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all resize-none" })] }), _jsxs("div", { className: "bg-cake-cream px-4 py-4 rounded-2xl border-2 border-cake-light-pink flex justify-between items-center", children: [_jsx("span", { className: "font-bold text-cake-coffee", children: "\u9810\u8A08\u7D50\u5E33\u91D1\u984D" }), _jsxs("span", { className: "text-2xl font-bold text-cake-accent", children: ["NT$ ", totalPrice] })] }), _jsx("button", { type: "submit", disabled: submitting, className: "w-full bg-gradient-to-r from-cake-accent to-cake-peach text-white font-bold py-3 rounded-full hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed", children: submitting ? '提交中...' : '確認預購下單！' })] }) })] }) }));
};

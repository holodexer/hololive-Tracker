import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useApp } from '@context/AppContext';
import { Hero } from './components/Hero';
import { ProductGrid } from './components/ProductGrid';
import { OrderModal } from './components/OrderModal';
import { SuccessModal } from './components/SuccessModal';
import { SoldOutModal } from './components/SoldOutModal';
export const App = () => {
    const { products, loading, error, loadProducts, submitOrder } = useApp();
    const [modals, setModals] = useState({
        orderModal: false,
        successModal: false,
        soldOutModal: false,
    });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [successData, setSuccessData] = useState(null);
    // 初始化：載入商品
    useEffect(() => {
        loadProducts();
    }, [loadProducts]);
    const handleSelectProduct = (product) => {
        if (product.stock <= 0) {
            setSelectedProduct(product);
            openModal('soldOutModal');
        }
        else {
            setSelectedProduct(product);
            openModal('orderModal');
        }
    };
    const handleOrderSubmit = async (orderData) => {
        try {
            const success = await submitOrder(orderData);
            if (success) {
                setSuccessData({
                    name: orderData.name,
                    productName: orderData.productName,
                    quantity: orderData.quantity,
                    totalPrice: orderData.totalPrice,
                });
                closeModal('orderModal');
                openModal('successModal');
            }
        }
        catch (err) {
            console.error('Order submission error:', err);
            alert('訂單提交失敗，請稍後重試');
        }
    };
    const openModal = (modal) => {
        setModals(prev => ({ ...prev, [modal]: true }));
    };
    const closeModal = (modal) => {
        setModals(prev => ({ ...prev, [modal]: false }));
    };
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-cake-cream via-white to-cake-light-pink", children: [_jsx(Hero, {}), _jsxs("div", { className: "max-w-6xl mx-auto px-4 md:px-6 py-16", children: [_jsx("h2", { className: "text-center text-3xl md:text-4xl font-bold text-cake-coffee mb-12 animate-bounce", children: "\uD83C\uDF70 \u4ECA\u65E5\u63A8\u85A6\u5546\u54C1" }), _jsx(ProductGrid, { products: products, onSelectProduct: handleSelectProduct, loading: loading, error: error })] }), _jsx("div", { className: "h-16" }), _jsx(OrderModal, { isOpen: modals.orderModal, product: selectedProduct, onClose: () => closeModal('orderModal'), onSubmit: handleOrderSubmit }), _jsx(SuccessModal, { isOpen: modals.successModal, name: successData?.name || '', productName: successData?.productName || '', quantity: successData?.quantity || 0, totalPrice: successData?.totalPrice || 0, onClose: () => closeModal('successModal') }), _jsx(SoldOutModal, { isOpen: modals.soldOutModal, product: selectedProduct, onClose: () => closeModal('soldOutModal') })] }));
};

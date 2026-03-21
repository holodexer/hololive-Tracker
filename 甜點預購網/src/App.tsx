import React, { useEffect, useState } from 'react'
import { useApp } from '@context/AppContext'
import type { Product } from '@types'
import { Hero } from './components/Hero'
import { ProductGrid } from './components/ProductGrid'
import { OrderModal } from './components/OrderModal'
import { SuccessModal } from './components/SuccessModal'
import { SoldOutModal } from './components/SoldOutModal'

interface ModalState {
  orderModal: boolean
  successModal: boolean
  soldOutModal: boolean
}

interface SuccessData {
  name: string
  productName: string
  quantity: number
  totalPrice: number
}

export const App: React.FC = () => {
  const { products, loading, error, loadProducts, submitOrder } = useApp()
  const [modals, setModals] = useState<ModalState>({
    orderModal: false,
    successModal: false,
    soldOutModal: false,
  })
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  // 初始化：載入商品
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSelectProduct = (product: Product) => {
    if (product.stock <= 0) {
      setSelectedProduct(product)
      openModal('soldOutModal')
    } else {
      setSelectedProduct(product)
      openModal('orderModal')
    }
  }

  const handleOrderSubmit = async (orderData: any) => {
    try {
      const success = await submitOrder(orderData)
      if (success) {
        setSuccessData({
          name: orderData.name,
          productName: orderData.productName,
          quantity: orderData.quantity,
          totalPrice: orderData.totalPrice,
        })
        closeModal('orderModal')
        openModal('successModal')
      }
    } catch (err) {
      console.error('Order submission error:', err)
      alert('訂單提交失敗，請稍後重試')
    }
  }

  const openModal = (modal: keyof ModalState) => {
    setModals(prev => ({ ...prev, [modal]: true }))
  }

  const closeModal = (modal: keyof ModalState) => {
    setModals(prev => ({ ...prev, [modal]: false }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cake-cream via-white to-cake-light-pink">
      <Hero />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-16">
        <h2 className="text-center text-3xl md:text-4xl font-bold text-cake-coffee mb-12 animate-bounce">
          🍰 今日推薦商品
        </h2>

        <ProductGrid
          products={products}
          onSelectProduct={handleSelectProduct}
          loading={loading}
          error={error}
        />
      </div>

      <div className="h-16"></div>

      {/* Modals */}
      <OrderModal
        isOpen={modals.orderModal}
        product={selectedProduct}
        onClose={() => closeModal('orderModal')}
        onSubmit={handleOrderSubmit}
      />

      <SuccessModal
        isOpen={modals.successModal}
        name={successData?.name || ''}
        productName={successData?.productName || ''}
        quantity={successData?.quantity || 0}
        totalPrice={successData?.totalPrice || 0}
        onClose={() => closeModal('successModal')}
      />

      <SoldOutModal
        isOpen={modals.soldOutModal}
        product={selectedProduct}
        onClose={() => closeModal('soldOutModal')}
      />
    </div>
  )
}

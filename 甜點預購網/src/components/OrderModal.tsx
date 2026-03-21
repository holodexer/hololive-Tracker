import React, { useState, useEffect } from 'react'
import type { Product, Order } from '@types'

interface OrderModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
  onSubmit: (order: Order) => Promise<void>
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  product,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    quantity: '1',
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (product) {
      setFormData({
        name: '',
        phone: '',
        quantity: '1',
        note: '',
      })
    }
  }, [product])

  const quantity = parseInt(formData.quantity) || 0
  const totalPrice = product ? quantity * product.price : 0

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '')
    setFormData(prev => ({ ...prev, phone: value }))
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value) || 0
    if (product && value > product.stock) {
      alert(`目前「${product.name}」剩餘庫存為 ${product.stock}`)
      value = product.stock
    }
    setFormData(prev => ({ ...prev, quantity: value.toString() }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: formData.name,
        phone: formData.phone,
        productName: product.name,
        quantity: parseInt(formData.quantity),
        totalPrice,
        note: formData.note,
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !product) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl w-11/12 max-w-md relative shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-cake-accent hover:scale-110 transition-transform text-2xl z-10"
        >
          <i className="fas fa-times-circle"></i>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-cake-yellow to-cake-pink p-8 text-center">
          <img
            src={product.img || 'https://via.placeholder.com/200'}
            alt={product.name}
            className="w-32 h-32 rounded-full border-4 border-white object-cover mx-auto mb-4"
            onError={e => {
              e.currentTarget.src = 'https://via.placeholder.com/200'
            }}
          />
          <h2 className="text-2xl font-bold text-cake-coffee">{product.name}</h2>
        </div>

        {/* Body */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 姓名 */}
            <div>
              <label className="block text-sm font-bold text-cake-coffee mb-2">
                怎麼稱呼您？
              </label>
              <input
                type="text"
                placeholder="例如：熊先生"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all"
                required
              />
            </div>

            {/* 電話 */}
            <div>
              <label className="block text-sm font-bold text-cake-coffee mb-2">
                電話 (需為10碼數字)
              </label>
              <input
                type="tel"
                placeholder="0912345678"
                value={formData.phone}
                onChange={handlePhoneChange}
                maxLength={10}
                className="w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all"
                required
              />
            </div>

            {/* 數量 */}
            <div>
              <label className="block text-sm font-bold text-cake-coffee mb-2">
                預購數量 (庫存剩餘：{product.stock})
              </label>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={formData.quantity}
                onChange={handleQuantityChange}
                className="w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all"
                required
              />
            </div>

            {/* 備註 */}
            <div>
              <label className="block text-sm font-bold text-cake-coffee mb-2">
                有什麼想告訴小熊的？ (備註)
              </label>
              <textarea
                rows={2}
                placeholder="備註特殊需求..."
                value={formData.note}
                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-cake-light-pink rounded-2xl focus:outline-none focus:border-cake-accent focus:bg-cake-cream transition-all resize-none"
              />
            </div>

            {/* 金額計算 */}
            <div className="bg-cake-cream px-4 py-4 rounded-2xl border-2 border-cake-light-pink flex justify-between items-center">
              <span className="font-bold text-cake-coffee">預計結帳金額</span>
              <span className="text-2xl font-bold text-cake-accent">NT$ {totalPrice}</span>
            </div>

            {/* 提交按鈕 */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cake-accent to-cake-peach text-white font-bold py-3 rounded-full hover:shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '提交中...' : '確認預購下單！'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

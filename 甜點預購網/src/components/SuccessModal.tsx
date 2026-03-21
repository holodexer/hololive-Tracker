import React, { useEffect } from 'react'

interface SuccessModalProps {
  isOpen: boolean
  name: string
  productName: string
  quantity: number
  totalPrice: number
  onClose: () => void
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  name,
  productName,
  quantity,
  totalPrice,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-4xl w-11/12 max-w-md text-center shadow-2xl overflow-hidden animate-slideUp">
        {/* 成功圖標 */}
        <div className="bg-gradient-to-r from-cake-sage to-cake-mint py-12">
          <div className="inline-block relative w-20 h-20">
            <i className="fas fa-check-circle text-6xl text-white animate-scaleUp"></i>
          </div>
        </div>

        {/* 內容 */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-cake-accent mb-4">
            預購成功！
          </h2>

          <div className="bg-cake-cream rounded-2xl p-4 space-y-3 text-left mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">預購者</span>
              <span className="text-base font-bold text-cake-coffee">{name}</span>
            </div>
            <div className="border-t border-cake-light-pink"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">商品</span>
              <span className="text-base font-bold text-cake-coffee">{productName}</span>
            </div>
            <div className="border-t border-cake-light-pink"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">數量</span>
              <span className="text-base font-bold text-cake-coffee">{quantity} 份</span>
            </div>
            <div className="border-t border-cake-light-pink"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-600">總金額</span>
              <span className="text-lg font-bold text-cake-accent">NT$ {totalPrice}</span>
            </div>
          </div>

          <p className="text-cake-coffee text-sm mb-6">
            ✨ 感謝您的預購！小熊會盡快準備您的訂單。
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-cake-accent to-cake-peach text-white font-bold py-3 rounded-full hover:shadow-lg transition-all"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

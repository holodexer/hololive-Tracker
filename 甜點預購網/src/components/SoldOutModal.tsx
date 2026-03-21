import React from 'react'
import type { Product } from '@types'

interface SoldOutModalProps {
  isOpen: boolean
  product: Product | null
  onClose: () => void
}

export const SoldOutModal: React.FC<SoldOutModalProps> = ({
  isOpen,
  product,
  onClose,
}) => {
  if (!isOpen || !product) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl w-11/12 max-w-md text-center shadow-2xl overflow-hidden animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        {/* 圖標區 */}
        <div className="bg-gradient-to-r from-gray-300 to-gray-400 py-12">
          <div className="text-6xl mb-2">📬</div>
          <p className="text-white font-bold text-lg">不好意思...</p>
        </div>

        {/* 內容 */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-cake-coffee mb-4">
            {product.name}
          </h2>

          <div className="bg-gray-100 rounded-2xl px-6 py-8 mb-6">
            <p className="text-gray-600 text-lg font-bold mb-3">
              ⚠️ 已售完
            </p>
            <p className="text-gray-600 text-sm">
              這項商品目前已經賣完了，歡迎您下次光臨。想要提前預約嗎？歡迎私訊我們！
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 rounded-full transition-all"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  )
}

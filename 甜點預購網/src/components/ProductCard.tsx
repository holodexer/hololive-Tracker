import React from 'react'
import type { Product } from '@types'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const isOutOfStock = product.stock <= 0

  return (
    <div
      onClick={() => !isOutOfStock && onSelect(product)}
      className={`bg-white rounded-3xl p-4 transition-all duration-300 cursor-pointer
        ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1 border-cake-pink border-2'}
        border-2 border-cake-pink
      `}
    >
      {/* 商品圖片容器 */}
      <div className="relative w-full h-52 rounded-2xl overflow-hidden mb-4">
        <img
          src={product.img || 'https://via.placeholder.com/200'}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/200'
          }}
        />
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-2xl font-bold drop-shadow-lg">已售完</span>
          </div>
        )}
      </div>

      {/* 商品資訊 */}
      <div>
        <span className="inline-block bg-gradient-to-r from-cake-accent to-cake-peach text-white px-4 py-1 rounded-full text-xs font-bold mb-3 shadow-md">
          {product.tag || '商品'}
        </span>
        <h3 className="font-bold text-lg text-cake-coffee mb-2">{product.name}</h3>
        <div className="font-bold text-cake-accent text-xl mb-2">NT$ {product.price}</div>
        <div className="text-xs text-gray-600">
          {isOutOfStock ? (
            <span className="font-bold text-cake-accent">已售完</span>
          ) : (
            <>庫存: {product.stock}</>
          )}
        </div>
      </div>
    </div>
  )
}

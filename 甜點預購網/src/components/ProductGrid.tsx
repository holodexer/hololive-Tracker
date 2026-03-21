import React from 'react'
import { ProductCard } from './ProductCard'
import type { Product } from '@types'

interface ProductGridProps {
  products: Product[]
  onSelectProduct: (product: Product) => void
  loading: boolean
  error: string | null
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onSelectProduct,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <div className="col-span-full text-center py-20 text-gray-400 animate-pulse">
        載入商品中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="col-span-full text-center py-20 text-cake-accent font-bold">
        {error}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="col-span-full text-center py-20 text-gray-400">
        暫無商品
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelectProduct}
        />
      ))}
    </div>
  )
}

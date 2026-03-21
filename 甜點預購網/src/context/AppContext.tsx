import React, { createContext, useState, useCallback, ReactNode } from 'react'
import type { Product, Order, AppContextType } from '@types'
import { gasService } from '@services/gasService'

/**
 * 建立應用 Context
 */
export const AppContext = createContext<AppContextType | undefined>(undefined)

/**
 * AppProvider 組件
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 從試算表加載商品
   */
  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await gasService.getProducts()
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('無法連接到試算表，請檢查網址設定')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 提交訂單
   */
  const submitOrder = useCallback(async (order: Order): Promise<boolean> => {
    try {
      const result = await gasService.submitOrder({
        action: 'addOrder',
        name: order.name,
        phone: order.phone,
        productName: order.productName,
        quantity: order.quantity,
        totalPrice: order.totalPrice,
        note: order.note || '',
        orderDate: new Date().toLocaleString('zh-TW'),
      })

      if (result.success) {
        // 重新加載商品以更新庫存
        await loadProducts()
        return true
      }
      return false
    } catch (err) {
      console.error('訂單提交失敗:', err)
      return false
    }
  }, [loadProducts])

  const value: AppContextType = {
    products,
    loading,
    error,
    loadProducts,
    submitOrder,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/**
 * 自訂 Hook - 使用 App Context
 */
export const useApp = (): AppContextType => {
  const context = React.useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

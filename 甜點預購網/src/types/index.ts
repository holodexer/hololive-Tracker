/**
 * 商品類型定義
 */
export interface Product {
  id: number
  name: string
  tag: string
  price: number
  stock: number
  img?: string
}

/**
 * 訂單類型定義
 */
export interface Order {
  name: string
  phone: string
  productName: string
  quantity: number
  totalPrice: number
  note?: string
  orderDate?: string
}

/**
 * API 回應類型
 */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
}

/**
 * 應用狀態類型
 */
export interface AppContextType {
  products: Product[]
  loading: boolean
  error: string | null
  loadProducts: () => Promise<void>
  submitOrder: (order: Order) => Promise<boolean>
}

/**
 * Google Apps Script API 服務
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbwRNsU3uj-hYtIwq6HSqbNDIZ6XieWT6C_LEYKKpQJoBdslAPDT8ravibFWy3fN6P5qTg/exec"

export const gasService: any = {
  /**
   * 從試算表取得商品列表
   */
  async getProducts() {
    try {
      const response = await fetch(
        `${GAS_URL}?action=getProducts&t=${Date.now()}`,
        {
          method: 'GET',
        }
      )
      return await response.json()
    } catch (error) {
      console.error('加載商品失敗:', error)
      throw error
    }
  },

  /**
   * 提交訂單到試算表
   */
  async submitOrder(orderData: any) {
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addOrder',
          ...orderData,
          phone: "'" + orderData.phone, // 前導單引號保留電話號碼前導0
        }),
      })
      return await response.json()
    } catch (error) {
      console.error('提交訂單失敗:', error)
      throw error
    }
  },
}

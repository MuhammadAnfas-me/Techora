import XLSX from 'xlsx'
import ejs from 'ejs'
import puppeteer, { executablePath } from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSalesReportData } from '../../utils/reportHelper.js'
import { Order } from '../../models/orderModel.js'
import { generatePdf } from '../../utils/pupeteer.js'
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from '../../constants/orderConstants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export const getReportDashboardData = async () => {
  const allOrders = await Order.find()
    .populate({
      path: 'items.productId',
      populate: { path: 'categoryId' }
    })
    .lean()

  const totalOrders = allOrders.length
  let totalRevenue = 0
  let pendingOrders = 0
  let cancelledOrders = 0
  let deliveredOrders = 0

  const categoryRevenue = {}
  const productSales = {}
  const dailyVolume = {}

  // Set up last 7 days for the chart
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  })

  last7Days.forEach(day => (dailyVolume[day] = 0))

  for (const order of allOrders) {
    if ([ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PENDING].includes(order.orderStatus)) pendingOrders++
    if (order.orderStatus === ORDER_STATUS.CANCELLED) cancelledOrders++
    if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.PARTIALLY_RETURNED].includes(order.orderStatus)) deliveredOrders++

    if (
      (order.paymentStatus === PAYMENT_STATUS.PAID || (order.paymentMethod === PAYMENT_METHOD.COD && order.orderStatus === ORDER_STATUS.DELIVERED)) &&
      [ORDER_STATUS.DELIVERED, ORDER_STATUS.SHIPPED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PLACED, ORDER_STATUS.PARTIALLY_RETURNED].includes(order.orderStatus)
    ) {
      const dayStr = new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'short' })
      if (dailyVolume[dayStr] !== undefined) dailyVolume[dayStr]++

      order.items?.forEach(item => {
        // Only count items that are NOT cancelled or returned
        if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(item.status)) {
          const product = item.productId
          const categoryName = product?.categoryId?.name || 'Uncategorized'
          const productName = product?.name || item.name || 'Unknown Item'
          const img = product?.variants?.[0]?.image?.[0] || item.image || ''

          const qty = item.quantity || 1
          const rev = item.finalTotal || item.total || 0 // Use finalTotal if available (after split discount)

          totalRevenue += rev
          categoryRevenue[categoryName] = (categoryRevenue[categoryName] || 0) + rev

          const pid = product?._id?.toString() || item.name
          if (!productSales[pid]) {
            productSales[pid] = {
              name: productName,
              image: img,
              category: categoryName,
              unitsSold: 0,
              revenue: 0
            }
          }
          productSales[pid].unitsSold += qty
          productSales[pid].revenue += rev
        }
      })
    }
  }

  // Round totalRevenue and category data
  totalRevenue = Math.round(totalRevenue * 100) / 100
  Object.keys(categoryRevenue).forEach(key => {
    categoryRevenue[key] = Math.round(categoryRevenue[key] * 100) / 100
  })
  Object.keys(productSales).forEach(key => {
    productSales[key].revenue = Math.round(productSales[key].revenue * 100) / 100
  })

  const chartLabels = last7Days
  const chartData = last7Days.map(day => dailyVolume[day])

  const categoryChartLabels = Object.keys(categoryRevenue).length
    ? Object.keys(categoryRevenue)
    : ['No Data']
  const categoryChartData = Object.values(categoryRevenue).length
    ? Object.values(categoryRevenue)
    : [0]

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 10)

  const topCategories = await Order.aggregate([
    { 
      $match: { 
        $or: [
          { paymentStatus: PAYMENT_STATUS.PAID },
          { paymentMethod: PAYMENT_METHOD.COD, orderStatus: ORDER_STATUS.DELIVERED }
        ]
      } 
    },
    { $unwind: '$items' },
    { $match: { 'items.status': ORDER_STATUS.DELIVERED } },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $lookup: {
        from: 'categories',
        localField: 'productInfo.categoryId',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $group: {
        _id: '$categoryInfo.name',
        totalUnitsSold: { $sum: { $ifNull: ['$items.quantity', 0] } },
        totalRevenue: { $sum: '$items.finalTotal' }
      }
    },
    { $sort: { totalUnitsSold: -1 } }
  ])

  return {
    totalOrders,
    totalRevenue,
    pendingOrders,
    cancelledOrders,
    deliveredOrders,
    chartLabels: JSON.stringify(chartLabels),
    chartData: JSON.stringify(chartData),
    categoryChartLabels: JSON.stringify(categoryChartLabels),
    categoryChartData: JSON.stringify(categoryChartData),
    topProducts,
    topCategories
  }
}

export const generateSalesReportPDF = async (startDate, endDate) => {
  const data = await getSalesReportData(startDate, endDate)

  const templateData = {
    startDate,
    endDate,
    storeName: 'Techora',
    generatedDate: new Date().toLocaleDateString(),
    totalOrders: data.totalOrders || 0,
    grossSales: data.totalSales || 0,
    totalDiscount: data.totalDiscount || 0,
    totalRefunds: data.totalRefunds || 0,
    netRevenue: data.totalRevenue || 0,
    reportData: data.detailedOrders || []
  }

  const templatePath = path.join(__dirname, '../../views/Admin/salesReport.ejs')
  const htmlContent = await ejs.renderFile(templatePath, templateData)

  const pdfBuffer = await generatePdf(htmlContent)

  return pdfBuffer
}

// ─── GENERATE EXCEL BUFFER ────────────────────────────────────────────────────

export const generateSalesReportExcel = async (startDate, endDate) => {
  const data = await getSalesReportData(startDate, endDate)

  const wb = XLSX.utils.book_new()

  const sheetData = [
    ['Sales Report', '', '', '', '', '', ''],
    ['Start Date', startDate, 'End Date', endDate, '', '', ''],
    [],
    ['Overview Metrics', '', '', '', '', '', ''],
    ['Total Transactions', 'Gross Sales Amount', 'Total Deductions', 'Net Revenue', '', '', ''],
    [
      data.totalOrders || 0,
      data.totalSales || 0,
      (data.totalDiscount || 0) + (data.totalRefunds || 0),
      data.totalRevenue || 0
    ],
    [],
    ['Order Details', '', '', '', '', '', ''],
    ['Order ID', 'Date', 'Customer', 'Base', 'Disc', 'Paid', 'Status']
  ]

  // Add individual orders
  ;(data.detailedOrders || []).forEach(row => {
    sheetData.push([
      row.orderId,
      new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      row.customerName || 'N/A',
      row.subtotal || 0,
      row.discount || 0,
      row.totalAmount || 0,
      row.orderStatus
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return buffer
}
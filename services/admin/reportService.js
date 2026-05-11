import XLSX from 'xlsx'
import ejs from 'ejs'
import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSalesReportData } from '../../utils/reportHelper.js'
import { Order } from '../../models/orderModel.js'

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
    if (['Placed', 'Confirmed', 'Pending'].includes(order.orderStatus)) pendingOrders++
    if (order.orderStatus === 'Cancelled') cancelledOrders++
    if (order.orderStatus === 'Delivered') deliveredOrders++

    if (
      order.paymentStatus === 'Paid' &&
      ['Delivered', 'Shipped', 'Confirmed', 'Placed'].includes(order.orderStatus)
    ) {
      totalRevenue += order.totalAmount || 0

      const dayStr = new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'short' })
      if (dailyVolume[dayStr] !== undefined) dailyVolume[dayStr]++

      order.items?.forEach(item => {
        const product = item.productId
        const categoryName = product?.categoryId?.name || 'Uncategorized'
        const productName = product?.name || item.name || 'Unknown Item'
        const img = product?.variants?.[0]?.image?.[0] || item.image || ''

        const qty = item.quantity || 1
        const rev = item.total || 0

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
      })
    }
  }

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
    { $match: { paymentStatus: 'Paid' } },
    { $unwind: '$items' },
    { $match: { 'items.status': { $in: ['Delivered'] } } },
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
    reportData: data.reportData || []
  }

  const templatePath = path.join(__dirname, '../../views/Admin/salesReport.ejs')
  const htmlContent = await ejs.renderFile(templatePath, templateData)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  })

  await browser.close()

  return pdfBuffer
}

// ─── GENERATE EXCEL BUFFER ────────────────────────────────────────────────────

export const generateSalesReportExcel = async (startDate, endDate) => {
  const data = await getSalesReportData(startDate, endDate)

  const wb = XLSX.utils.book_new()

  // 1. Summary Sheet
  const summaryData = [
    { 'Report Metric': 'Start Date', 'Value': startDate },
    { 'Report Metric': 'End Date', 'Value': endDate },
    { 'Report Metric': 'Total Orders', 'Value': data.totalOrders },
    { 'Report Metric': 'Total Items Sold', 'Value': data.totalItemsSold },
    { 'Report Metric': 'Gross Sales', 'Value': data.totalSales },
    { 'Report Metric': 'Total Discount', 'Value': data.totalDiscount },
    { 'Report Metric': 'Total Refunds', 'Value': data.totalRefunds },
    { 'Report Metric': 'Net Revenue', 'Value': data.totalRevenue }
  ]
  const wsSummary = XLSX.utils.json_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  const detailedData = data.reportData.map(row => ({
    'Date': row.date,
    'Orders': row.ordersCount,
    'Gross Sales': row.grossSales,
    'Discounts': row.discount,
    'Refunds': row.refunds,
    'Net Revenue': row.netRevenue
  }))
  const wsDetailed = XLSX.utils.json_to_sheet(detailedData)
  XLSX.utils.book_append_sheet(wb, wsDetailed, 'Daily Breakdown')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return buffer
}
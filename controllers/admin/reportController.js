import {
  getReportDashboardData,
  generateSalesReportPDF,
  generateSalesReportExcel
} from '../../services/admin/reportService.js'

// ─── REPORT DASHBOARD ─────────────────────────────────────────────────────────

export const reportLoad = async (req, res) => {
  try {
    const data = await getReportDashboardData()
    res.render('Admin/report.ejs', data)
  } catch (error) {
    console.log('Report Error:', error)
    res.status(500).send('Server Error')
  }
}

// ─── DOWNLOAD PDF ─────────────────────────────────────────────────────────────

export const downloadSalesReportPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).send('Start and End date required')
    }

    const pdfBuffer = await generateSalesReportPDF(startDate, endDate)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="sales-report.pdf"',
      'Content-Length': pdfBuffer.length
    })

    res.end(pdfBuffer)
  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).send('Error generating PDF')
  }
}

// ─── DOWNLOAD EXCEL ───────────────────────────────────────────────────────────

export const downloadSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).send('Start and End date required')
    }

    const buffer = await generateSalesReportExcel(startDate, endDate)

    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx')
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    res.send(buffer)
  } catch (error) {
    console.error(error)
    res.status(500).send('Error generating Excel')
  }
}
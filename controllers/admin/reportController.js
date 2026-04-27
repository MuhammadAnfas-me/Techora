import { Order } from '../../models/orderModel.js';
import Product from '../../models/productModel.js';
import { Categories } from '../../models/categoryModel.js';

export const reportLoad = async (req, res) => {
  try {
    // 1. Fetch all orders and populate product & category details easily
    const allOrders = await Order.find().populate({
      path: 'items.productId',
      populate: { path: 'categoryId' }
    }).lean();

    // 2. Setup initial variables
    const totalOrders = allOrders.length;
    let totalRevenue = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let deliveredOrders = 0;

    const categoryRevenue = {};
    const productSales = {};
    const dailyVolume = {};

    // Set up last 7 days for the chart
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    
    last7Days.forEach(day => dailyVolume[day] = 0);

    // 3. Loop through orders and calculate everything using basic Javascript
    for (const order of allOrders) {
      if (['Placed', 'Confirmed', 'Pending'].includes(order.orderStatus)) pendingOrders++;
      if (order.orderStatus === 'Cancelled') cancelledOrders++;
      if (order.orderStatus === 'Delivered') deliveredOrders++;

      if (!['Cancelled', 'Returned', 'Return Approved'].includes(order.orderStatus)) {
        totalRevenue += order.totalAmount || 0;

        // Daily volume chart data
        const dayStr = new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
        if (dailyVolume[dayStr] !== undefined) {
          dailyVolume[dayStr]++;
        }

        // Category and Product calculations
        order.items?.forEach(item => {
          const product = item.productId;
          const categoryName = product?.categoryId?.name || 'Uncategorized';
          const productName = product?.name || item.name || 'Unknown Item';
          const img = product?.variants?.[0]?.image?.[0] || item.image || '';
          
          const qty = item.quantity || 1;
          const rev = item.total || 0;

          // Add to category revenue
          categoryRevenue[categoryName] = (categoryRevenue[categoryName] || 0) + rev;

          // Add to top products
          const pid = product?._id?.toString() || item.name;
          if (!productSales[pid]) {
            productSales[pid] = { name: productName, image: img, category: categoryName, unitsSold: 0, revenue: 0 };
          }
          productSales[pid].unitsSold += qty;
          productSales[pid].revenue += rev;
        });
      }
    }

    // 4. Format arrays specifically to pass directly to the view chart
    const chartLabels = last7Days;
    const chartData = last7Days.map(day => dailyVolume[day]);

    const categoryChartLabels = Object.keys(categoryRevenue).length ? Object.keys(categoryRevenue) : ["No Data"];
    const categoryChartData = Object.values(categoryRevenue).length ? Object.values(categoryRevenue) : [0];

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    // 5. Render
    res.render("Admin/report.ejs", {
      totalOrders,
      totalRevenue,
      pendingOrders,
      cancelledOrders,
      deliveredOrders,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData),
      categoryChartLabels: JSON.stringify(categoryChartLabels),
      categoryChartData: JSON.stringify(categoryChartData),
      topProducts
    });

  } catch (error) {
    console.log("Report Error:", error);
    res.status(500).send("Server Error");
  }
}
import { Order } from '../../models/orderModel.js';
import { User } from '../../models/userModel.js';
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from '../../constants/orderConstants.js';
import { MONTH_NAMES } from '../../constants/constant.js';

export const dashboardLoad = async (req, res) => {
  try {
    const allOrders = await Order.find().populate('userId').lean();
    
    let totalRevenue = 0;
    let pendingOrdersCount = 0;
    const totalOrders = allOrders.length;
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } }); 

    const monthNames = MONTH_NAMES
    const now = new Date();
    
    const chartLabels = [];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      chartLabels.push(monthNames[d.getMonth()]);
      chartData.push(0);
    }

    for (const order of allOrders) {
      if ([ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PENDING].includes(order.orderStatus)) {
        pendingOrdersCount++;
      }
      
      let orderNetRevenue = 0;

      // ── Revenue condition: must exactly match the report page logic ──────────
      // Only count orders that are paid (or COD delivered as a safety net)
      // AND whose status is one of the active/positive statuses.
      // This excludes RETURN_REQUESTED, RETURN_APPROVED, RETURN_REJECTED, RETURNED, CANCELLED.
      const COUNTABLE_STATUSES = [
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.PLACED,
        ORDER_STATUS.PARTIALLY_RETURNED
      ];

      const isPaid =
        order.paymentStatus === PAYMENT_STATUS.PAID ||
        (order.paymentMethod === PAYMENT_METHOD.COD && order.orderStatus === ORDER_STATUS.DELIVERED);

      if (isPaid && COUNTABLE_STATUSES.includes(order.orderStatus)) {
         order.items.forEach(item => {
           if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(item.status)) {
             orderNetRevenue += (item.finalTotal || item.total || 0);
           }
         });
      }

      if (orderNetRevenue > 0) {
        totalRevenue += orderNetRevenue;
        
        const orderDate = new Date(order.createdAt);
        const monthDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + now.getMonth() - orderDate.getMonth();
        if (monthDiff >= 0 && monthDiff <= 5) {
          const idx = 5 - monthDiff; 
          chartData[idx] += orderNetRevenue;
        }
      }
    }

    const recentOrders = allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(o => {
      const dateStr = new Date(o.createdAt).toLocaleDateString('en-US');
      return {
        id: o.orderId || '#...',
        customer: o.address?.name || o.userId?.fullName || 'Unknown Customer',
        date: dateStr,
        status: o.orderStatus,
        amount: "₹" + (o.totalAmount?.toLocaleString() || "0")
      };
    });

    // Top 10 Best Selling Products
    const topProducts = await Order.aggregate([
      { $match: { paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          image: { $first: '$items.image' },
          totalSold: { $sum: '$items.quantity' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Top 10 Best Selling Categories
    const topCategories = await Order.aggregate([
      { $match: { paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.name' },
          totalSold: { $sum: '$items.quantity' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Top 10 Best Selling Brands
    const topBrands = await Order.aggregate([
      { $match: { paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      {
        $group: {
          _id: '$items.brand',
          totalSold: { $sum: '$items.quantity' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.render("Admin/dashboard.ejs", {
      totalOrders,
      totalRevenue,
      totalUsers,
      pendingOrders: pendingOrdersCount,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData),
      recentOrders,
      topProducts,
      topCategories,
      topBrands,
      ORDER_STATUS
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).send("Server Error");
  }
}
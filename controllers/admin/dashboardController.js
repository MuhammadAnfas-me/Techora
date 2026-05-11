import { Order } from '../../models/orderModel.js';
import { User } from '../../models/userModel.js';

export const dashboardLoad = async (req, res) => {
  try {
    const allOrders = await Order.find().populate('userId').lean();
    
    let totalRevenue = 0;
    let pendingOrdersCount = 0;
    const totalOrders = allOrders.length;
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } }); 

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    
    const chartLabels = [];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      chartLabels.push(monthNames[d.getMonth()]);
      chartData.push(0);
    }

    for (const order of allOrders) {
      if (['Placed', 'Confirmed', 'Pending'].includes(order.orderStatus)) {
        pendingOrdersCount++;
      }
      
      if (
        order.paymentStatus === 'Paid' &&
        ['Delivered', 'Shipped', 'Confirmed', 'Placed'].includes(order.orderStatus)
      ) {
        totalRevenue += order.totalAmount || 0;
        
        const orderDate = new Date(order.createdAt);
        const monthDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + now.getMonth() - orderDate.getMonth();
        if (monthDiff >= 0 && monthDiff <= 5) {
          const idx = 5 - monthDiff; 
          chartData[idx] += order.totalAmount || 0;
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
      { $match: { paymentStatus: 'Paid' } },
      { $unwind: '$items' },
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
      { $match: { paymentStatus: 'Paid' } },
      { $unwind: '$items' },
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
      { $match: { paymentStatus: 'Paid' } },
      { $unwind: '$items' },
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
      topBrands
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).send("Server Error");
  }
}
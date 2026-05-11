import Order from '../../models/order/order.js';

export const getSalesReportService = async (filter, startDate, endDate, page = null, limit = null, status = 'exclude_cancelled') => {
    let matchCondition = {};
    
    if (status === 'Delivered') {
        matchCondition.orderStatus = 'Delivered';
    } else if (status === 'exclude_cancelled') {
        matchCondition.orderStatus = { $nin: ['Cancelled', 'Returned'] };
    }
    // if status === 'all', no orderStatus condition added

    const now = new Date();
    let start, end;
    // ... rest of date logic remains the same ...
    if (filter === 'daily') {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
    } else if (filter === 'weekly') {
        const firstDay = now.getDate() - now.getDay();
        const tempStart = new Date(now);
        tempStart.setDate(firstDay);
        tempStart.setHours(0, 0, 0, 0);
        start = tempStart;
        end = new Date();
    } else if (filter === 'monthly') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filter === 'yearly') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (filter === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    } else {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
    }

    if (start && end) {
        matchCondition.createdAt = { $gte: start, $lte: end };
    }

    // Previous Period calculation
    const duration = (start && end) ? (end.getTime() - start.getTime()) : 0;
    const prevStart = start ? new Date(start.getTime() - duration - 1) : new Date();
    const prevEnd = start ? new Date(start.getTime() - 1) : new Date();
    const prevMatchCondition = { ...matchCondition, createdAt: { $gte: prevStart, $lte: prevEnd } };

    let ordersQuery = Order.find(matchCondition)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        ordersQuery = ordersQuery.skip(skip).limit(parseInt(limit));
    }

    const [orders, totalOrders, stats, prevStats, couponUsage, topBrands] = await Promise.all([
        ordersQuery,
        Order.countDocuments(matchCondition),
        Order.aggregate([
            { $match: matchCondition },
            { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    totalSales: { $addToSet: "$_id" }, 
                    totalRevenue: { $sum: "$totalAmount" },
                    totalDiscount: { $sum: "$discount" },
                    totalProductsSold: { $sum: { $ifNull: ["$items.qty", 0] } }
                }
            },
            {
                $project: {
                    totalSales: { $size: "$totalSales" },
                    totalRevenue: 1,
                    totalDiscount: 1,
                    totalProductsSold: 1
                }
            }
        ]),
        Order.aggregate([
            { $match: prevMatchCondition },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" }
                }
            }
        ]),
        Order.aggregate([
            { $match: { ...matchCondition, couponCode: { $ne: null } } },
            {
                $group: {
                    _id: "$couponCode",
                    timesUsed: { $sum: 1 },
                    totalDiscount: { $sum: "$discount" }
                }
            },
            { $sort: { timesUsed: -1 } },
            { $limit: 5 }
        ]),
        Order.aggregate([
            { $match: matchCondition },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.brand",
                    totalSold: { $sum: "$items.qty" },
                    revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ])
    ]);
    
    // ── Chart Data Aggregation ──
    let chartGroup = {};
    if (filter === 'daily') {
        chartGroup = { $hour: "$createdAt" };
    } else if (filter === 'weekly' || filter === 'monthly' || filter === 'custom') {
        chartGroup = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    } else if (filter === 'yearly') {
        chartGroup = { $month: "$createdAt" };
    }

    const chartAggregation = await Order.aggregate([
        { $match: matchCondition },
        { $group: { _id: chartGroup, total: { $sum: "$totalAmount" } } },
        { $sort: { "_id": 1 } }
    ]);

    let chartLabels = [];
    let chartValues = [];

    if (filter === 'daily') {
        chartLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        chartValues = new Array(24).fill(0);
        chartAggregation.forEach(d => { chartValues[d._id] = d.total; });
    } else if (filter === 'yearly') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chartLabels = months;
        chartValues = new Array(12).fill(0);
        chartAggregation.forEach(d => { chartValues[d._id - 1] = d.total; });
    } else {
        // Fill missing days for weekly, monthly, and custom
        const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        for (let i = 0; i <= dayDiff; i++) {
            const current = new Date(start);
            current.setDate(start.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            
            chartLabels.push(dateStr);
            const found = chartAggregation.find(d => d._id === dateStr);
            chartValues.push(found ? found.total : 0);
        }
    }

    const reportStats = stats.length > 0 ? stats[0] : { totalSales: 0, totalRevenue: 0, totalDiscount: 0, totalProductsSold: 0 };
    const previousRevenue = prevStats.length > 0 ? prevStats[0].totalRevenue : 0;

    return {
        orders,
        stats: reportStats,
        previousRevenue,
        couponUsage,
        topBrands,
        period: { start, end },
        chartData: { labels: chartLabels, data: chartValues },
        totalPages: limit ? Math.ceil(totalOrders / limit) : 1,
        totalOrders,
        currentPage: page ? parseInt(page) : 1
    };
};
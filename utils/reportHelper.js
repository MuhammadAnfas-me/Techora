// utils/reportHelper.js
import { Order } from "../models/orderModel.js"
export const getSalesReportData = async (startDate, endDate) => {
  
  const start = new Date(`${startDate}T00:00:00.000+05:30`);
  const end = new Date(`${endDate}T23:59:59.999+05:30`);

  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lte: end
        }
      }
    },
    { $unwind: "$items" },
    {
      $facet: {
        totals: [
          {
            $match: {
              $or: [
                { paymentStatus: "Paid" },
                { paymentMethod: "COD", orderStatus: { $nin: ["Cancelled", "Returned"] } }
              ],
              "items.status": { $in: ["Delivered", "Shipped", "Confirmed", "Placed"] }
            }
          },
          {
            $group: {
              _id: null,
              orders: { $addToSet: "$_id" },
              totalSales: { $sum: "$items.total" },
              totalDiscount: { $sum: "$items.discount" },
              totalRevenue: { $sum: "$items.finalTotal" },
              totalItemsSold: { $sum: "$items.quantity" }
            }
          }
        ],
        refunds: [
          {
            $match: {
              $or: [
                { "items.status": "Returned" },
                { "items.refunds": "refunded" }
              ]
            }
          },
          {
            $group: {
              _id: null,
              totalRefunds: { $sum: "$items.finalTotal" }
            }
          }
        ],
        daily: [
          {
            $match: {
              $or: [
                { paymentStatus: "Paid" },
                { paymentMethod: "COD", orderStatus: { $nin: ["Cancelled", "Returned"] } }
              ],
              "items.status": { $in: ["Delivered", "Shipped", "Confirmed", "Placed"] }
            }
          },
          {
            $group: {
              _id: {
                date: { 
                  $dateToString: { 
                    format: "%d %b %Y", 
                    date: "$createdAt",
                    timezone: "Asia/Kolkata" 
                  } 
                },
                orderId: "$_id"
              },
              grossSales: { $sum: "$items.total" },
              discount: { $sum: "$items.discount" },
              netRevenue: { $sum: "$items.finalTotal" }
            }
          },
          {
            $group: {
              _id: "$_id.date",
              ordersCount: { $sum: 1 },
              grossSales: { $sum: "$grossSales" },
              discount: { $sum: "$discount" },
              netRevenue: { $sum: "$netRevenue" }
            }
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              ordersCount: 1,
              grossSales: 1,
              discount: 1,
              refunds: { $literal: 0 },
              netRevenue: 1
            }
          },
          { $sort: { date: 1 } }
        ]
      }
    }
  ]);

  const totals = result[0]?.totals[0] || {};
  const refunds = result[0]?.refunds[0] || {};
  const daily = result[0]?.daily || [];

  return {
    totalOrders: totals.orders ? totals.orders.length : 0,
    totalSales: totals.totalSales || 0,
    totalDiscount: totals.totalDiscount || 0,
    totalRevenue: totals.totalRevenue || 0,
    totalItemsSold: totals.totalItemsSold || 0,
    totalRefunds: refunds.totalRefunds || 0,
    reportData: daily
  };
};

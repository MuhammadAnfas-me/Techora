// utils/reportHelper.js
import { Order } from "../models/orderModel.js"
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REFUND_STATUS
} from '../constants/orderConstants.js'
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
                { paymentStatus: PAYMENT_STATUS.PAID },
                { paymentMethod: PAYMENT_METHOD.COD, orderStatus: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } }
              ],
              "items.status": { $nin: [ORDER_STATUS.CANCELLED] }
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
                { "items.status": ORDER_STATUS.RETURNED },
                { "items.refunds": REFUND_STATUS.REFUNDED }
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
              grossSales: { 
                $sum: {
                  $cond: [
                    { $in: ["$items.status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.SHIPPED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PLACED]] },
                    "$items.total",
                    0
                  ]
                }
              },
              discount: { 
                $sum: {
                  $cond: [
                    { $in: ["$items.status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.SHIPPED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PLACED]] },
                    "$items.discount",
                    0
                  ]
                }
              },
              refunds: {
                $sum: {
                  $cond: [
                    { $or: [{ $eq: ["$items.status", ORDER_STATUS.RETURNED] }, { $eq: ["$items.refunds", REFUND_STATUS.REFUNDED] }] },
                    "$items.finalTotal",
                    0
                  ]
                }
              },
              netRevenue: {
                $sum: {
                  $cond: [
                    { $in: ["$items.status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.SHIPPED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PLACED]] },
                    "$items.finalTotal",
                    0
                  ]
                }
              }
            }
          },
          {
            $group: {
              _id: "$_id.date",
              ordersCount: { $sum: 1 },
              grossSales: { $sum: "$grossSales" },
              discount: { $sum: "$discount" },
              refunds: { $sum: "$refunds" },
              netRevenue: { $sum: "$netRevenue" }
            }
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              ordersCount: 1,
              grossSales: { $round: ["$grossSales", 2] },
              discount: { $round: ["$discount", 2] },
              refunds: { $round: ["$refunds", 2] },
              netRevenue: { $round: [{ $subtract: ["$netRevenue", "$refunds"] }, 2] }
            }
          },
          { $sort: { date: 1 } }
        ],
        // New facet for the detailed orders table used in PDF
        detailedOrders: [
          {
             $group: {
                _id: "$_id",
                orderId: { $first: "$orderId" },
                createdAt: { $first: "$createdAt" },
                customerName: { $first: "$address.name" },
                orderStatus: { $first: "$orderStatus" },
                totalAmount: { $first: "$totalAmount" },
                subtotal: { $first: "$subtotal" },
                discount: { $first: { $ifNull: ["$coupon.discount", 0] } }
             }
          },
          { $sort: { createdAt: -1 } }
        ]
      }
    }
  ]);

  const totals = result[0]?.totals[0] || {};
  const refunds = result[0]?.refunds[0] || {};
  const daily = result[0]?.daily || [];
  const detailedOrders = result[0]?.detailedOrders || [];

  return {
    totalOrders: totals.orders ? totals.orders.length : 0,
    totalSales: Math.round((totals.totalSales || 0) * 100) / 100,
    totalDiscount: Math.round((totals.totalDiscount || 0) * 100) / 100,
    totalRevenue: Math.round(((totals.totalRevenue || 0) - (refunds.totalRefunds || 0)) * 100) / 100,
    totalItemsSold: totals.totalItemsSold || 0,
    totalRefunds: Math.round((refunds.totalRefunds || 0) * 100) / 100,
    reportData: daily,
    detailedOrders: detailedOrders
  };
};

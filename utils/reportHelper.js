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

  // Reusable filter: only count paid / non-cancelled COD orders,
  // and exclude cancelled individual items.
  const validItemMatch = {
    $or: [
      { paymentStatus: PAYMENT_STATUS.PAID },
      {
        paymentMethod: PAYMENT_METHOD.COD,
        orderStatus: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] }
      }
    ],
    "items.status": { $nin: [ORDER_STATUS.CANCELLED] }
  };

  // Statuses that represent active (non-returned, non-cancelled) items
  const activeStatuses = [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PLACED
  ];

  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end }
      }
    },
    { $unwind: "$items" },

    {
      $facet: {

        // ── Summary cards ────────────────────────────────────────────────
        totals: [
          { $match: validItemMatch },
          {
            $group: {
              _id: null,
              orders:         { $addToSet: "$_id" },   // distinct order IDs
              totalSales:     { $sum: "$items.total" },
              totalDiscount:  { $sum: "$items.discount" },
              totalRevenue:   { $sum: "$items.finalTotal" },
              totalItemsSold: { $sum: "$items.quantity" }
            }
          }
        ],

        // ── Refunds ──────────────────────────────────────────────────────
        // FIX #1: use the correct field path for refund status.
        // Adjust "items.refundStatus" to match your actual schema
        // (e.g. "items.refunds.status" if refunds is an array of objects).
        refunds: [
          {
            $match: {
              $or: [
                { "items.status":       ORDER_STATUS.RETURNED   },
                { "items.refundStatus": REFUND_STATUS.REFUNDED  }  // ✅ fixed path
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

        // ── Daily breakdown ───────────────────────────────────────────────
        // FIX #2: sort by a real date field, not a formatted string.
        daily: [
          {
            $group: {
              _id: {
                // Store a sortable date (truncated to day) alongside the orderId
                dateRaw: {
                  $dateTrunc: {
                    date:     "$createdAt",
                    unit:     "day",
                    timezone: "Asia/Kolkata"
                  }
                },
                orderId: "$_id"
              },
              grossSales: {
                $sum: {
                  $cond: [
                    { $in: ["$items.status", activeStatuses] },
                    "$items.total",
                    0
                  ]
                }
              },
              discount: {
                $sum: {
                  $cond: [
                    { $in: ["$items.status", activeStatuses] },
                    "$items.discount",
                    0
                  ]
                }
              },
              refunds: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ["$items.status",       ORDER_STATUS.RETURNED  ] },
                        { $eq: ["$items.refundStatus", REFUND_STATUS.REFUNDED ] }  // ✅ fixed path
                      ]
                    },
                    "$items.finalTotal",
                    0
                  ]
                }
              },
              netRevenue: {
                $sum: {
                  $cond: [
                    { $in: ["$items.status", activeStatuses] },
                    "$items.finalTotal",
                    0
                  ]
                }
              }
            }
          },
          // Roll up per-order buckets into per-day buckets
          {
            $group: {
              _id:         "$_id.dateRaw",   // ✅ real Date — sorts correctly
              ordersCount: { $sum: 1 },
              grossSales:  { $sum: "$grossSales" },
              discount:    { $sum: "$discount" },
              refunds:     { $sum: "$refunds" },
              netRevenue:  { $sum: "$netRevenue" }
            }
          },
          { $sort: { _id: 1 } },             // ✅ chronological sort on Date
          {
            $project: {
              _id: 0,
              // Format only in the final projection, after sorting
              date: {
                $dateToString: {
                  format:   "%d %b %Y",
                  date:     "$_id",
                  timezone: "Asia/Kolkata"
                }
              },
              ordersCount: 1,
              grossSales:  { $round: ["$grossSales", 2] },
              discount:    { $round: ["$discount",   2] },
              refunds:     { $round: ["$refunds",    2] },
              netRevenue:  { $round: [{ $subtract: ["$netRevenue", "$refunds"] }, 2] }
            }
          }
        ],

        // ── Detailed orders table ─────────────────────────────────────────
        // FIX #4: include item-level discounts, not only the coupon discount.
        detailedOrders: [
          { $match: validItemMatch },
          {
            $group: {
              _id:          "$_id",
              orderId:      { $first: "$orderId"       },
              createdAt:    { $first: "$createdAt"     },
              customerName: { $first: "$address.name"  },
              orderStatus:  { $first: "$orderStatus"   },
              totalAmount:  { $first: "$totalAmount"   },
              subtotal:     { $first: "$subtotal"      },
              // ✅ sum item-level discounts accumulated across all (unwound) items
              itemDiscount:   { $sum: "$items.discount" },
              // coupon discount is order-level; $first is fine for it
              couponDiscount: { $first: { $ifNull: ["$coupon.discount", 0] } }
            }
          },
          {
            $addFields: {
              // Total discount = per-item offers + coupon
              discount: { $add: ["$itemDiscount", "$couponDiscount"] }
            }
          },
          {
            $project: {
              itemDiscount:   0,   // remove helper fields from output
              couponDiscount: 0
            }
          },
          { $sort: { createdAt: -1 } }
        ]
      }
    }
  ]);

  const totals        = result[0]?.totals[0]        || {};
  const refunds       = result[0]?.refunds[0]       || {};
  const daily         = result[0]?.daily             || [];
  const detailedOrders = result[0]?.detailedOrders  || [];

  return {
    totalOrders:     totals.orders ? totals.orders.length : 0,
    totalSales:      Math.round((totals.totalSales    || 0) * 100) / 100,
    totalDiscount:   Math.round((totals.totalDiscount || 0) * 100) / 100,
    totalRevenue:    Math.round(((totals.totalRevenue || 0) - (refunds.totalRefunds || 0)) * 100) / 100,
    totalItemsSold:  totals.totalItemsSold || 0,
    totalRefunds:    Math.round((refunds.totalRefunds || 0) * 100) / 100,
    reportData:      daily,
    detailedOrders
  };
};
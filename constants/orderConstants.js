export const ORDER_STATUS = Object.freeze({
    PLACED: 'Placed',
    CONFIRMED: 'Confirmed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    RETURNED: 'Returned',
    RETURN_REQUESTED: 'Return Requested',
    RETURN_APPROVED: 'Return Approved',
    RETURN_REJECTED: 'Return Rejected',
    PARTIALLY_RETURNED: 'Partially Returned'
});

export const PAYMENT_METHOD = Object.freeze({
    COD: 'COD',
    RAZORPAY: 'RAZORPAY',
    WALLET: 'WALLET'
});

export const PAYMENT_STATUS = Object.freeze({
    PENDING: 'Pending',
    PAID: 'Paid',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
    REFUND_PENDING: 'Refund Pending'
});

export const REFUND_STATUS = Object.freeze({
    PENDING: 'pending',
    NONE: 'none',
    REFUNDED: 'refunded'
});

export const RETURN_STATUS = Object.freeze({
    NONE: 'None',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected'
});

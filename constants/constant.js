export const RATE_LIMIT = {
  SIGNUP: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX: 5
  },
  LOGIN: {
    WINDOW_MS: 15 * 60 * 1000,
    MAX: 5
  },
  CHECKOUT: {
    WINDOW_MS: 10 * 60 * 1000,
    MAX: 25
  },
  PAYMENT: {
    WINDOW_MS: 5 * 60 * 1000,
    MAX: 10
  }
};

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];
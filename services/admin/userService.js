import { Order } from '../../models/orderModel.js'
import { User } from '../../models/userModel.js'

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ─── USER LIST DATA ───────────────────────────────────────────────────────────

export const getUserListData = async ({ page, search, role, status }) => {
  const limit = 5
  const skip = (page - 1) * limit

  const filter = {}

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ fullName: rx }, { email: rx }]
  }
  if (role) filter.role = role
  if (status === 'Active') filter.isBlocked = false
  if (status === 'Blocked') filter.isBlocked = true

  const totalUsers = await User.countDocuments(filter)
  const totalPages = Math.ceil(totalUsers / limit)

  const users = await User.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()

  const orderCounts = await Order.aggregate([
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 }
      }
    }
  ])

  const orderMap = {}
  orderCounts.forEach(o => {
    orderMap[o._id.toString()] = o.count
  })

  users.forEach(user => {
    user.orderCount = orderMap[user._id.toString()] || 0
  })

  return { users, totalUsers, totalPages }
}

// ─── TOGGLE BLOCK STATUS ──────────────────────────────────────────────────────

export const toggleUserBlock = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw { status: 404, message: 'User not found' }

  user.isBlocked = !user.isBlocked
  await user.save()

  return user
}
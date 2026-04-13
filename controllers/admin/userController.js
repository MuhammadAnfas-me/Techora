import { Order } from '../../models/orderModel.js'
import { User } from '../../models/userModel.js'
import formatDateForInput from '../../services/dateFormat.js'

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const userListApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = 5
    const skip = (page - 1) * limit

    const search = (req.query.search || '').trim()
    const role = (req.query.role || '').trim()
    const status = (req.query.status || '').trim()

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
          _id: "$userId",
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

    return res.status(200).json({
      success: true,
      users,
      page,
      totalUsers,
      totalPages,
      filter: { search, role, status }
    })

  } catch (err) {
    console.error('Error from userList :', err)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

const userList = (req, res) => {
  try {
    return res.render('admin/users', {
      currentPage: 'users',
      users: [],
      totalUsers: 0,
      totalPages: 1,
      page: 1,
      filter: { search: '', role: '', status: '' }
    })
  } catch (err) {
    console.log(err)
    return res.status(500).send('Server error')
  }
}

const blockUser = async (req, res) => {
  try {
    const id = req.params.id

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Toggle block status
    user.isBlocked = !user.isBlocked

    await user.save()

    return res.json({
      success: true,
      message: user.isBlocked ? 'User blocked' : 'User unblocked',
      isBlocked: user.isBlocked
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}

export { userList, userListApi, blockUser }

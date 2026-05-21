import { getUserListData, toggleUserBlock } from '../../services/admin/userService.js'

// ─── RENDER USER LIST PAGE ────────────────────────────────────────────────────

const userList = (req, res) => {
  try {
    return res.render('Admin/users', {
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

// ─── USER LIST API ────────────────────────────────────────────────────────────

const userListApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const search = (req.query.search || '').trim()
    const role = (req.query.role || '').trim()
    const status = (req.query.status || '').trim()

    const { users, totalUsers, totalPages } = await getUserListData({
      page,
      search,
      role,
      status
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

// ─── BLOCK / UNBLOCK USER ─────────────────────────────────────────────────────

const blockUser = async (req, res) => {
  try {
    const user = await toggleUserBlock(req.params.id)

    return res.json({
      success: true,
      message: user.isBlocked ? 'User blocked' : 'User unblocked',
      isBlocked: user.isBlocked
    })
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message })
    }
    console.error(err)
    return res.status(500).json({ message: 'Server error' })
  }
}

export { userList, userListApi, blockUser }
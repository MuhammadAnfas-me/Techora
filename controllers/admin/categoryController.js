import {
  fetchCategoryList,
  createCategory,
  getCategoryForEdit,
  updateCategory,
  deleteCategoryHandler
} from '../../services/admin/categoryService.js'
// ─────────────────────────────────────────────
// Category List — JSON API
// ─────────────────────────────────────────────

const categoryListApi = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)   || 1
    const search = req.query.search           || ''
    const status = req.query.status           || ''

    const data = await fetchCategoryList({ page, search, status })

    return res.json({ success: true, ...data })
  } catch (error) {
    console.error('Error from categoryList:', error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

// ─────────────────────────────────────────────
// Category List — Page render
// ─────────────────────────────────────────────

const categoryListPage = (req, res) => {
  try {
    return res.render('Admin/category/categoryList', {
      currentPage: 'category',
      categories:  [],          
      total:       0,
      filter:      { search: '', status: '' },
      totalPages:  1,
      page:        1
    })
  } catch (err) {
    console.error(err)
    return res.status(500).send('Server error')
  }
}

// ─────────────────────────────────────────────
// Add Category — Page render
// ─────────────────────────────────────────────

const addCategoryLoad = (req, res) => {
  res.render('Admin/category/addPage', { currentPage: 'category' })
}

// ─────────────────────────────────────────────
// Add Category — Action
// ─────────────────────────────────────────────

const addCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body

    await createCategory({ name, isActive })

    return res.status(201).json({ success: true, message: 'Category added successfully' })
  } catch (error) {
    console.error('error from addCategory:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Edit Category — Page render
// ─────────────────────────────────────────────

const editPageLoad = async (req, res) => {
  try {
    const { category, productsCount } = await getCategoryForEdit(req.params.id)

    res.render('Admin/category/editPage', {
      currentPage: 'category',
      category,
      productsCount
    })
  } catch (error) {
    console.log('Error from editPageLoad:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Edit Category — Action
// ─────────────────────────────────────────────

const editCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body

    await updateCategory(req.params.id, { name, isActive })

    return res.json({ success: true, message: 'Category updated successfully' })
  } catch (error) {
    console.error('update category error:', error)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message })
    }
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Delete Category — Action
// ─────────────────────────────────────────────

const deleteCategory = async (req, res) => {
  try {
    await deleteCategoryHandler(req.params.id)

    return res.status(200).json({ success: true, message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error from deleteCategory:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

  export {
    categoryListApi,
    categoryListPage,
    addCategoryLoad,
    addCategory,
    editPageLoad,
    editCategory,
    deleteCategory
  }
import {
  fetchOfferList,
  fetchActiveCategories,
  fetchActiveProducts,
  createOffer,
  getOfferForEdit,
  updateOffer,
  softDeleteOffer,
  toggleOfferStatus
} from '../../services/admin/offerService.js'  

// ─────────────────────────────────────────────
// Offer List — Page render
// ─────────────────────────────────────────────

export const offerLoad = async (req, res) => {
  try {
    let { page = 1, limit = 5, search = '', type, status } = req.query

    page  = parseInt(page)
    limit = parseInt(limit)

    const data = await fetchOfferList({ page, limit, search, type, status })

    res.render('Admin/offer/offerListPage.ejs', data)
  } catch (error) {
    console.log('Error from offerLoad:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// List Categories (dropdown API)
// ─────────────────────────────────────────────

export const listCategories = async (req, res) => {
  try {
    const categories = await fetchActiveCategories()

    return res.status(200).json({ success: true, categories })
  } catch (error) {
    console.log('Error from listCategories:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// List Products (dropdown API)
// ─────────────────────────────────────────────

export const listProducts = async (req, res) => {
  try {
    const products = await fetchActiveProducts()

    return res.status(200).json({ success: true, products })
  } catch (error) {
    console.log('Error from listProducts:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Add Offer — Page render
// ─────────────────────────────────────────────

export const addOfferLoad = (req, res) => {
  res.render('Admin/offer/addOffer.ejs', { date: new Date() })
}

// ─────────────────────────────────────────────
// Add Offer — Action
// ─────────────────────────────────────────────

export const addOffer = async (req, res) => {
  try {
    const {
      name, type, value, scope,
      product: productId, category: categoryId,
      start, end, isActive, maxDiscount
    } = req.body

    const offer = await createOffer({
      name, type, value, scope,
      product: productId, category: categoryId,
      start, end, isActive, maxDiscount
    })

    return res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer
    })
  } catch (error) {
    console.error('Add Offer Error:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Edit Offer — Page render
// ─────────────────────────────────────────────

export const editLoad = async (req, res) => {
  try {
    const { offer, items, selected, selectedId } =
      await getOfferForEdit(req.params.id)

    res.render('Admin/offer/editOffer.ejs', {
      offer,
      items,
      selected,
      date: new Date(),
      selectedId
    })
  } catch (error) {
    console.log('Error from editLoad:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Update Offer — Action
// ─────────────────────────────────────────────

export const updateOfferHandler = async (req, res) => {
  try {
    const {
      name, type, value, start, end,
      scope, product: productId, category: categoryId, isActive, maxDiscount
    } = req.body

    await updateOffer(req.params.id, {
      name, type, value, start, end,
      scope, product: productId, category: categoryId, isActive, maxDiscount
    })

    return res.status(200).json({ success: true, message: 'Offer updated successfully' })
  } catch (error) {
    console.log('Error updating offer:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Delete Offer (soft delete)
// ─────────────────────────────────────────────

export const deleteCoupon = async (req, res) => {
  try {
    await softDeleteOffer(req.params.id)

    return res.status(200).json({ success: true, message: 'Coupon deleted successfully' })
  } catch (error) {
    console.error('Delete offer Error:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}

// ─────────────────────────────────────────────
// Toggle Status
// ─────────────────────────────────────────────

export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.body

    const { message } = await toggleOfferStatus(id)

    return res.status(200).json({ success: true, message })
  } catch (error) {
    console.log('Toggle offer error:', error)
    const status  = error.status || 500
    const message = error.message || 'Server error'
    return res.status(status).json({ success: false, message })
  }
}
export { updateOfferHandler as updateOffer }
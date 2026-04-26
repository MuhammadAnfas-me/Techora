import { Categories } from '../../models/categoryModel.js'
import { Order } from '../../models/orderModel.js'
import { Offers } from '../../models/offerModel.js'
import Product from '../../models/productModel.js'

export const offerLoad = async (req, res) => {
  try {
    let { page = 1, limit = 5, search = '', type, status } = req.query

    page = parseInt(page)
    limit = parseInt(limit)

    const query = {}

    // 🔍 Search (Offer Name)
    if (search) {
      query.name = { $regex: search, $options: 'i' }
    }

    // 🎯 Filter by Offer Type
    if (type && type !== 'All') {
      query.type = type
    }

    // 📅 Status Filter (Active / Expired / Scheduled)
    if (status && status !== 'All') {
      const today = new Date()

      if (status === 'Active') {
        query.start = { $lte: today }
        query.end = { $gte: today }
      }

      if (status === 'Expired') {
        query.end = { $lt: today }
      }

      if (status === 'Scheduled') {
        query.start = { $gt: today }
      }
    }

    // 📊 Total count
    const totalOffers = await Offers.countDocuments(query)
    const offers = await Offers.find(query)
      .sort({ createdAt: -1 })
      .populate('product', 'name')
      .populate('category', 'name')
    if (!offers) {
      return res.status(400).json({
        success: false,
        message: 'Failed to load offers'
      })
    }
    res.render('Admin/offer/offerListPage.ejs', {
      offers,
      currentPage: page,
      totalPages: Math.ceil(totalOffers / limit),
      totalOffers,
      search,
      limit,
      type,
      status
    })
  } catch (error) {
    console.log('Error from offerLoad :', error)
  }
}

export const listCategories = async (req, res) => {
  try {
    const categories = await Categories.find({ isActive: true })
    if (!categories) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch categories'
      })
    }
    return res.status(200).json({
      success: true,
      categories
    })
  } catch (error) {
    console.log('Error from listCategories :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const listProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' })
    if (!products) {
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch products'
      })
    }

    return res.status(200).json({
      success: true,
      products
    })
  } catch (error) {
    console.log('Error from listProducts :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

export const addOfferLoad = (req, res) => {
  res.render('Admin/offer/addOffer.ejs', {
    date: new Date()
  })
}

export const addOffer = async (req, res) => {
  try {
    const {
      name,
      type,
      value,
      scope,
      product,
      category,
      start,
      end,
      isActive
    } = req.body

    // 🔹 Basic validation
    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Offer name required' })
    }

    if (!['flat', 'percentage'].includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid offer type' })
    }

    if (!value || value <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid value' })
    }

    if (type === 'percentage' && value > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Percentage cannot exceed 100' })
    }

    if (!['product', 'category'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'Invalid scope' })
    }

    // 🔥 Scope validation
    if (scope === 'product' && !product) {
      return res
        .status(400)
        .json({ success: false, message: 'Product required' })
    }

    if (scope === 'category' && !category) {
      return res
        .status(400)
        .json({ success: false, message: 'Category required' })
    }

    // 🔹 Date validation
    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'Dates required' })
    }

    if (new Date(start) >= new Date(end)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid date range' })
    }

    // 🔥 Prevent duplicate active offer (important)
    let existing

    const existingName = await Offers.findOne({ name })

    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Name is already existing'
      })
    }

    if (scope === 'product') {
      existing = await Offers.findOne({
        scope: 'product',
        product,
        isActive: true,
        isDeleted: false
      })
    }

    if (scope === 'category') {
      existing = await Offers.findOne({
        scope: 'category',
        category,
        isActive: true,
        isDeleted: false
      })
    }

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Offer already exists for this target'
      })
    }

    // 🔹 Create offer
    const offer = new Offers({
      name: name.trim(),
      type,
      value: Number(value),
      scope,
      product: scope === 'product' ? product : null,
      category: scope === 'category' ? category : null,
      start,
      end,
      isActive: isActive ?? true
    })

    await offer.save()

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer
    })
  } catch (err) {
    console.error('Add Offer Error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

export const editLoad = async (req, res) => {
  try {
    const name = req.params.id 
    const offer = await Offers.findOne({name : name})
    let items = null
    let selected = null

    if(offer.category != null){
      items = await Categories.find()
      selected = items.find(item => item._id.equals(offer.category))
    }else if(offer.product != null){
      items = await Product.find()
      selected = items.find(item => item._id.equals(offer.product))
    }

    res.render('Admin/offer/editOffer.ejs',{
      offer,
      items,
      selected,
      date: new Date(),
      selectedId : selected._id
    })
  } catch (error) {
    console.log('Error from aditLoad :',error)
  }
}

export const updateOffer = async (req, res) => {
  try {
    const nameId = req.params.id;

    const {
      name,
      type,
      value,
      start,
      end,
      scope, // Product or Category
      product,
      category
    } = req.body;

    // 🔴 Basic Validation
    if (!name || !type || !value || !start || !end) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    if (new Date(start) >= new Date(end)) {
      return res.status(400).json({ success: false, message: "Expiry must be after start date" });
    }

    // 🎯 Prepare update data
    const updateData = {
      name,
      type,
      value : Number(value),
      start,
      end,
      scope,
      product: scope === 'product' ? product : null,
      category: scope === 'category' ? category : null,
    };

    // 🔄 Update
    await Offers.findOneAndUpdate({name : nameId}, updateData, { new: true });
    return res.status(200).json({
      success : true,
      message : "Offer updated successfully"
    })
    
  } catch (error) {
    console.log("Error updating offer:", error);
    return res.status(500).json({
      success : false,
      message : "Server error"
    })
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const offerId = req.params.id;

    // 1. Validate ID
    if (!offerId) {
      return res.status(400).json({
        success: false,
        message: "Offer Id is required"
      });
    }

    // 2. Find offer
    const offer = await Offers.findById(offerId)

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    // 3. Prevent deleting already deleted
    if (offer.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Offer already deleted"
      });
    }

    // 4. Check if coupon is used in orders
    const isUsed = await Order.exists({ _id : offerId});

    if (isUsed) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete Offer already used in orders"
      });
    }

    // 5. Soft delete
    offer.isDeleted = true;
    offer.isActive = false;

    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });

  } catch (error) {
    console.error("Delete offer Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export const toggleStatus = async (req,res)=>{
  try {
    const {id , isActive} = req.body
    const offer = await Offers.findById(id)
    if(!offer){
      return res.status(400).json({
        success : false,
        message : "Offer not found"
      })
    }

    offer.isActive = !offer.isActive

    await offer.save()

    return res.status(200).json({
      success : true,
      message :  `Offer ${offer.isActive ? "activated" : "deactivated"} successfully`
    })
  } catch (error) {
    console.log("Toggle offer error :",error)
    return res.status(500).json({
      success : false,
      message : "Server error"
    })
  }
}
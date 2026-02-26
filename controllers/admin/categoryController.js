import { Console } from 'console'
import { Categories } from '../../models/categoryModel.js'

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const categoryListApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = 5
    const skip = (page - 1) * limit

    const search = req.query.search || ''
    const status = req.query.status || ''

    const filter = {}

    if (search) {
      filter.name = { $regex: escapeRegex(search), $options: 'i' }
    }

    if (status === 'Active') {
      filter.isActive = true 
    } else if (status === 'Inactive') {
      filter.isActive = false
    }

    
    const [categories, total] = await Promise.all([
      Categories.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Categories.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit)
    return res.json({success:true,
      categories,
      total,
      filter : {search,status},
      totalPages,
      page
    })
  } catch (error) {
    console.error('Error from categoryList : ', error)
    return res.status(500).json({success : false,message : "Servor error"})
  }
}

const categoryListPage = (req,res)=>{
  try {
    return res.render("Admin/category/categoryList", {
      currentPage: "category",
      categories: [],       // initial empty (we will fill using AJAX)
      total: 0,
      filter: { search: "", status: "" },
      totalPages: 1,
      page: 1
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
}

const addCategoryLoad = (req, res) => {
  res.render('Admin/category/addPage', { currentPage: 'category' })
}

const addCategory = async (req, res) => {
  try {
    
    let { name, description, type ,isActive} = req.body

    name = name?.trim()
    description = description?.trim()
    type = type?.trim()

    if (!name || !description || !type) {
      return res.status(400).json({
        success: false,
        message: 'All fields required'
      })
    }
    const exists = await Categories.findOne({
      name: { $regex: `^${name}$`, $options: 'i' }
    })
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: 'Category name already used' })
    }
    await Categories.create({
      name,
      type,
      description,
      isActive
    })

    return res.status(201).json({
      success: true,
      message: 'Category added successfuly'
    })
  } catch (error) {
    console.error('error from addCategory :', error)
    return res.status(500).json({
      success: false,
      message: 'Server error'
    })
  }
}

const editPageLoad = async (req, res) => {
  try {
    
    const id = req.params.id
  
    const category = await Categories.findById(id)
    if(!category) return res.status(400).json({success : false,message : "Category doesn't exists"})
  
    res.render('Admin/category/editPage', { currentPage: 'category' ,category})
  } catch (error) {
    console.log("Error from editPageLoad :",error)
  }

}

const editCategory = async (req,res)=>{
  try {
    
    const id = req.params.id
    const {name, type , description , isActive} = req.body
    const updateFields = {}
    if(name !== undefined) updateFields.name = name.trim()
    if(type !== undefined) updateFields.type = type.trim()
    if(description !== undefined) updateFields.description = description.trim()
    if(isActive !== undefined) updateFields.isActive = isActive
    const exists = await Categories.findById(id)
    if(!exists) return res.status(400).json({success : true , message : "This category doesn't exists"})
      
    if (Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Nothing to update' })
    }
  
    const updated = await Categories.findOneAndUpdate(
          { _id : id},
          { $set: updateFields },
          { new: true, runValidators: true }
    )
  
    if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: 'Category not found' })
      }
  
      return res.json({
        success: true,
        message: 'Category updated successfully'
      })
  } catch (error) {
    console.error('update category error :', error)
    if (error.name == 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message })
    }
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

const deleteCategory = async (req,res)=>{
  try {
    const id = req.params.id
    const category = await Categories.findById(id)
    if(!category) return res.status(400).json({success : false , message : "Category doesn't exists"})    
      await Categories.deleteOne({_id : id})
    return res.status(200).json({success : true ,message : "Category deleted successfully"})
  } catch (error) {
    console.error("Error from deleteCategory :" , error)
    return res.status(500).json({success : false,message : "Server error"})
  }
}

export { categoryListApi, categoryListPage , addCategoryLoad, addCategory, editPageLoad ,editCategory,deleteCategory}

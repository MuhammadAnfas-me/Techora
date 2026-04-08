import { Order } from '../../models/orderModel.js'
import  {formatDate}  from "../../services/dateFormat.js"
import puppeteer from "puppeteer";
import ejs from "ejs"
import path from "path";
import { fileURLToPath } from "url";
import Product from '../../models/productModel.js';
import { resendOtp } from './authController.js';

const getStatusText = (status) => {
  switch (status) {
    case "Placed":
      return "Order Placed";
    case "Confirmed":
      return "Confirmed";
    case "Shipped":
      return "Shipped - In Transit";
    case "Delivered":
      return "Delivered";
    case "Cancelled":
      return "Cancelled";
    default:
      return status;
  }
};

export const OrderLoad = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      res.redirect('/')
    }
    const orders = await Order.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(4)
    const totalOrders = await Order.countDocuments({userId: user.id})
    const delivered = await Order.countDocuments({ userId: user.id ,orderStatus: 'Delivered' })
    const shipped = await Order.countDocuments({ userId: user.id ,orderStatus: 'Shipped' })
    const cancelled = await Order.countDocuments({userId: user.id ,orderStatus: 'Cancelled' })
    res.render('User/order/orderPage.ejs', {
      orders,
      totalOrders,
      delivered,
      shipped,
      cancelled
    })
  } catch (error) {
    console.log(error)
  }
}

export const orderListPage = async (req, res) => {
  try {
    const user = req.session.user
    if (!user) {
      res.redirect('/')
    }
    const search = req.query.search || ''
    const status = req.query.status || ''

    const page = parseInt(req.query.page) || 1
    const limit = 6
    const skip = (page - 1) * limit

    let query = { userId: user.id }

    if (search) {
      query.orderId = { $regex: search, $options: 'i' }
    }
    if (status && status !== 'all') {
      query.orderStatus = status
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    const totalOrders = await Order.countDocuments(query)
    
    if (req.headers.accept.includes('json')) {
      return res.json({
        orders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        search,
        status
      })
    }

    res.render('User/order/orderListPage.ejs', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      status
    })
  } catch (error) {
    console.error('error from orderListPage:', error)
  }
}

export const orderDetailsLoad = async (req,res)=>{
  try {
    const orderId = req.params.orderId
    const user = req.session.user
    if(!user){
      return res.redirect("/")
    }
    if(!orderId){
      return res.status(404).render("404",{message : "Order id not found"})
    }

    const order = await Order.findOne({orderId})
    if(!order){
      return res.status(404).render("404",{message : "Order not found"})
    }
    const allCancelled = order.items.every(i=> i.cancelRequest.status === "Pending")
    console.log(allCancelled)
    res.render('User/order/orderDetails.ejs',{
      order,
      statusText : getStatusText(order.orderStatus) ,
      formatDate,
      allCancelled
    })

  } catch (error) {
    console.error("Error from orderDetailsPage :",error)
  }
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user.id;

    const order = await Order.findOne({
      orderId,
      userId
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // ✅ Render EJS to HTML
    const filePath = path.join("views/User/invoice.ejs");

    const html = await ejs.renderFile(filePath, { order });

    // 🚀 Launch Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    // ✅ Generate PDF
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        bottom: "20px",
        left: "15px",
        right: "15px"
      }
    });

    await browser.close();

    // 📥 Send as download
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${order.orderId}.pdf`
    });

    res.send(pdf);

  } catch (error) {
    console.error("Puppeteer Error:", error);
    res.status(500).send("PDF generation failed");
  }
};


export const cancelItem = async (req,res)=>{
  try {
    const {orderId , itemId} = req.body
    const order = await Order.findById(orderId)

    const item = order.items.id(itemId)
    if(!item){
      return res.status(404).json({
        success : false,
        message : "Item not Found"
      })
    }

    if(item.status === "Cancelled"){
      return res.status(400).json({
        success : false,
        message : "Already Cancelled"
      })
    }
    const {productId,variantId,quantity} = item
    const product = await Product.findOne({_id : productId})
    if(!product){
      return res.status(400).json({
        success : false,
        message  : "Product not found"
      })
    }

    const variant = product.variants.find(v => v.varientId.toString() === variantId.toString())

    if(!variant){
      return res.status(400).json({
        success : false,
        message : "Variant not found"
      })
    }
    item.status = "Cancelled"
    variant.stock += quantity

    const allCancelled = order.items.every(i=> i.status === "Cancelled")

    if(allCancelled){
      order.orderStatus = "Cancelled"
    }

    await order.save()
    await product.save()
    return res.status(200).json({
      success : true,
      message : `${product.name} cancelled successfully`,
    })
  } catch (error) {
    console.error("Error from cancelItem :",error)
  }
}

export const orderCancelLoad = async (req,res)=>{
  try {
    const orderId = req.params.id;
    const user = req.session.user;

    if(!user){
      return res.status(400).json({
        success : false,
        message : "Please login first"
      })
    }

    if(!orderId){
      return res.status(404).json({
        success : false,
        message : "Order not found"
      })
    }


    const order = await Order.findOne({
      orderId,
      userId : user.id
    });

    res.render("User/order/orderCancelPage.ejs",{
      order,
    })

  } catch (error) {
    console.log("Error from orderCancelLoad :",error)
  }

  
}

export const orderCancel = async (req,res)=>{
  try {
    const user = req.session.user
    const orderId = req.params.id

    if(!user){
      return res.status(400).json({
        success : false,
        message : "Please login first"
      })
    }

    if(!orderId){
      return res.status(400).json({
        success : false,
        message : "Order id not found"
      })
    }
    const order = await Order.findOne({
      orderId,
      userId : user.id
    });

    if(!order){
      return res.status(400).json({
        success : false,
        message : "Order not found"
      })
    }

    const {reason , comment} = req.body

    if(!reason){
      return res.status(400).json({
        success : false,
        message : "Please select an reason"
      })
    }

    if(["Shipped" , "Delivered"].includes(order.orderStatus) ){
      return res.status(400).json({
        success : false , 
        message : "Your order already Shipped"
      })
    }
    const allCancelled = order.items.every(i => i.cancelRequest.status === "Cancelled");
    const requested = order.items.every(i => i.cancelRequest.status === "Pending");

    if(allCancelled){
      return res.json({
        success : false,
        message : "You already Cancelled"
      })
    }

    if(requested){
      return res.status(400).json({
        success : false,
        message : "You already requested to cancellation"
      })
    }

    order.items.forEach(i=> i.cancelRequest.status = "Pending")
    order.save()
    return res.status(200).json({
      success : true,
      message : "Cancellation Requested"
    })
  } catch (error) {
    console.log("Error from orderCancel",error)
    return res.status(500).json({
      success : false,
      message : "Server error"
    })
  }
}
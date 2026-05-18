export function getOfferPrice(product, variantPrice, offers) {
  let bestOffer = null
  let maxDiscount = 0

  for (let offer of offers) {
    if (!isOfferValid(offer)) continue;
    if (
      (offer.scope === 'product' && offer.product?.toString() === product._id.toString()) ||
      (offer.scope === 'category' && offer.category?.toString() === (product.categoryId?._id || product.categoryId)?.toString())
    ) {
      const discount = getDiscountAmount(offer, variantPrice)
      if (discount > maxDiscount) {
        maxDiscount = discount
        bestOffer = offer
      }
    }
  }

  let finalPrice = variantPrice
  if (bestOffer) {
    finalPrice = variantPrice - Math.min(maxDiscount, variantPrice)
  }
  return Math.max(1, Math.round(finalPrice))
}

export function getDiscountAmount (offer, price) {
  if (offer.type === 'flat') return offer.value

  const rawDiscount = (price * offer.value) / 100

  // Cap percentage discount by maxDiscount if set
  if (offer.maxDiscount && rawDiscount > offer.maxDiscount) {
    return offer.maxDiscount
  }

  return rawDiscount
}

export function isOfferValid(offer) {
  const now = new Date()

  return (
    offer.isActive &&
    (!offer.startDate || now >= new Date(offer.startDate)) &&
    (!offer.endDate || now <= new Date(offer.endDate))
  )
}
document.addEventListener("DOMContentLoaded", () => {
  const variantTabsContainer = document.getElementById("variantTabsContainer");
  const variantContentArea = document.getElementById("variantContentArea");
  const specTableBody = document.getElementById("specTableBody");
  const addProductForm = document.getElementById("addProductForm");
  const saveButton = document.getElementById("saveButton")

  const addVariantBtn = document.getElementById("addVariantBtn");
  const addSpecBtn = document.getElementById("addSpecBtn");
  const specificationNameInput = document.getElementById("specificationName");
  const specificationValueInput = document.getElementById("specificationValue");
  
  const cropModal = document.getElementById("cropModal");
  const cropCloseBtn = document.getElementById("cropCloseBtn");
  const cropImage = document.getElementById("cropImage");
  const cropCancelBtn = document.getElementById("cropCancelBtn");
  const cropSaveBtn = document.getElementById("cropSaveBtn");

  let cropper = null;
  let activeVariantIndex = null;
  let currentObjectUrl = null;
  let pendingInput = null;

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createEmptyVariant() {
    return {
      varientId: crypto?.randomUUID?.() || String(Date.now()),
      color: "", 
      colorCode : "",  
      sku: "",
      price: 0,
      stock: 0,
      image: [],
      status: "Active"
    };
  }

  function renderSpecifications() {
    if (!specifications.length) {
      specTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:#64748b;">No specifications</td>
        </tr>
      `;
      return;
    }

    specTableBody.innerHTML = specifications.map((item, index) => `
      <tr>
        <td>${escapeHtml(item.label || "")}</td>
        <td>${escapeHtml(item.value || "")}</td>
        <td style="text-align:right;">
          <button type="button" class="remove-spec-btn" data-index="${index}">Remove</button>
        </td>
      </tr>
    `).join("");
  }

  function renderVariantTabs(activeIndex = 0) {
    variantTabsContainer.innerHTML = variants.map((item, index) => `
      <div class="variant-tab ${index === activeIndex ? "active" : ""}" data-index="${index}">
        <div class="variant-tab-text">
          <span class="variant-tab-title">
            ${escapeHtml(item.color || "New Variant")}
          </span>
          <span class="variant-tab-price">${item.price || 0}</span>
        </div>
        ${variants.length > 1 ? `
          <div class="variant-tab-close" data-remove="${index}">
            <span class="material-symbols-outlined" style="font-size:14px;">close</span>
          </div>
        ` : ""}
      </div>
    `).join("");
  }

  function renderVariantContent(variant, index) {
    const imagesHtml = (variant.image || []).map((img, imgIndex) => {
      const src = typeof img === "string" ? img : img?.url;
      if (!src) return "";

      return `
        <div style="position:relative; width:80px; height:80px;">
          <img 
            src="${escapeHtml(src)}" 
            alt="" 
            style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #ddd;display:block;"
          >
          <button
            type="button"
            class="remove-variant-image"
            data-variant-index="${index}"
            data-img-index="${imgIndex}"
            style="
              position:absolute;
              top:2px;
              right:2px;
              border:none;
              background:#fff;
              cursor:pointer;
              border-radius:50%;
              width:22px;
              height:22px;
              display:flex;
              align-items:center;
              justify-content:center;
              box-shadow:0 1px 4px rgba(0,0,0,0.2);
            "
          >✕</button>
        </div>
      `;
    }).join("");

    variantContentArea.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <label style="margin:0;"></label>
        ${index === 0 ? `<span class="default-tag">Default Variant</span>` : ""}
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label>Color</label>
          <input
            type="text"
            class="form-control variant-input"
            data-index="${index}"
            data-field="color"
            value="${escapeHtml(variant.color || "")}"
            placeholder="Enter color"
          >
        </div>

        <div class="form-group">
          <label>SKU</label>
          <input
            type="text"
            class="form-control variant-input"
            data-index="${index}"
            data-field="sku"
            value="${escapeHtml(variant.sku || "")}"
            placeholder="Enter SKU"
          >
        </div>

        <div class="form-group">
          <label>Color code <span class="required">*</span></label>
          <input type="color" id="variantColorCode" class="form-control color-picker variant-input" value="${escapeHtml(variant.colorCode)}" data-field="colorCode" data-index="${index}" >
        </div>
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label>Price</label>
          <input
            type="number"
            class="form-control variant-input"
            data-index="${index}"
            data-field="price"
            value="${variant.price || 0}"
            placeholder="0"
          >
        </div>

        <div class="form-group">
          <label>Stock Quantity</label>
          <input
            type="number"
            class="form-control variant-input"
            data-index="${index}"
            data-field="stock"
            value="${variant.stock || 0}"
            placeholder="0"
          >
        </div>
      </div>

      

      <div class="variant-images" style="margin-top:8px;">
        <label>Variant Images</label>
        <input
          type="file"
          class="variant-image-input"
          data-index="${index}"
          accept="image/*"
          hidden
        >
        <div class="variant-img-upload" id="variantUploadBox" data-index="${index}" style="cursor:pointer;">
          <div class="variant-img-icon">
            <span class="material-symbols-outlined">add</span>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          ${imagesHtml || `<span style="color:#64748b;">No images</span>`}
        </div>
      </div>
    `;
  }

  function openVariant(index) {
    if (!variants[index]) return;
    renderVariantTabs(index);
    renderVariantContent(variants[index], index);
  }

  renderSpecifications();
  renderVariantTabs();

  if (variants.length > 0) {
    renderVariantContent(variants[0], 0);
  } else {
    variantContentArea.innerHTML = `<p style="color:#64748b;">No variants available</p>`;
  }

  // Add specification
  if (addSpecBtn) {
    addSpecBtn.addEventListener("click", () => {
      const label = specificationNameInput.value.trim();
      const value = specificationValueInput.value.trim();

      if (!label || !value) {
        showToast?.("Please enter specification name and value", "error");
        return;
      }

      specifications.push({ label, value });
      renderSpecifications();

      specificationNameInput.value = "";
      specificationValueInput.value = "";
      specificationNameInput.focus();
    });
  }

  // Add variant
  if (addVariantBtn) {
    addVariantBtn.addEventListener("click", () => {
      const newVariant = createEmptyVariant();
      variants.push(newVariant);
      openVariant(variants.length - 1);
    });
  }

  // Remove spec / remove image
  document.addEventListener("click", (e) => {
    const removeSpecBtn = e.target.closest(".remove-spec-btn");
    if (removeSpecBtn) {
      const index = Number(removeSpecBtn.dataset.index);
      if (!Number.isNaN(index)) {
        specifications.splice(index, 1);
        renderSpecifications();
      }
      return;
    }

    const removeImgBtn = e.target.closest(".remove-variant-image");
    if (removeImgBtn) {
      const variantIndex = Number(removeImgBtn.dataset.variantIndex);
      const imgIndex = Number(removeImgBtn.dataset.imgIndex);
    
      if (!Number.isNaN(variantIndex) && !Number.isNaN(imgIndex) && variants[variantIndex]) {
        const removed = variants[variantIndex].image.splice(imgIndex, 1)[0];
      
        if (removed && typeof removed === "object" && removed.isNew && removed.tempId) {
          variants[variantIndex]._newImageFiles =
            (variants[variantIndex]._newImageFiles || []).filter(
              (item) => item.tempId !== removed.tempId
            );
          
          if (removed.url?.startsWith("blob:")) {
            URL.revokeObjectURL(removed.url);
          }
        }
      
        renderVariantContent(variants[variantIndex], variantIndex);
      }
      return;
    }
  });

  // Edit variant fields live
  document.addEventListener("input", (e) => {
    const input = e.target.closest(".variant-input");
    if (!input) return;

    const index = Number(input.dataset.index);
    const field = input.dataset.field;

    if (Number.isNaN(index) || !variants[index]) return;

    const value = input.value;

    if (field === "color") {
      variants[index] = variants[index] || {};
      variants[index].color = value;
    } else if(field === "colorCode"){  
      variants[index].colorCode = value
    }else if (field === "sku") {
      variants[index].sku = value;
    } else if (field === "price") {
      variants[index].price = Number(value) || 0;
    } else if (field === "stock") {
      variants[index].stock = Number(value) || 0;
    }
    renderVariantTabs(index);
  });

  // Variant tab click / remove variant
  variantTabsContainer.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".variant-tab-close");
    if (closeBtn) {
      const index = Number(closeBtn.dataset.remove);
      if (!Number.isNaN(index)) {
        variants.splice(index, 1);

        if (variants.length > 0) {
          openVariant(Math.max(0, index - 1));
        } else {
          renderVariantTabs(0);
          variantContentArea.innerHTML = `<p style="color:#64748b;">No variants available</p>`;
        }
      }
      return;
    }

    const tab = e.target.closest(".variant-tab");
    if (!tab) return;

    const index = Number(tab.dataset.index);
    if (!variants[index]) return;

    openVariant(index);
  });

  // Image uploads
  
  document.addEventListener("click", (e) => {
    const uploadBox = e.target.closest(".variant-img-upload");
    if (!uploadBox) return;
  
    const variantIndex = Number(uploadBox.dataset.index);
    if (Number.isNaN(variantIndex)) return;
  
    const fileInput = document.querySelector(`.variant-image-input[data-index="${variantIndex}"]`);
    if (!fileInput) return;
  
    fileInput.click();
  });

  document.addEventListener("change", (e) => {
  const fileInput = e.target.closest(".variant-image-input");
  if (!fileInput) return;

  const variantIndex = Number(fileInput.dataset.index);
  const file = fileInput.files?.[0];

  if (Number.isNaN(variantIndex) || !file) return;
  if (!file.type.startsWith("image/")) {
    showToast?.("Please select a valid image", "error");
    fileInput.value = "";
    return;
  }
  const   MAX_SIZE = 2 * 1024 * 1024
      if(file.size > MAX_SIZE){
        showToast("Image size must be less than 2MB","error")
        fileInput.value = ""
        return 
      }

  activeVariantIndex = variantIndex;
  pendingInput = fileInput;

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  currentObjectUrl = URL.createObjectURL(file);
  cropImage.src = currentObjectUrl;
  cropModal.style.display = "flex";

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  cropImage.onload = () => {
    cropper = new Cropper(cropImage, {
        aspectRatio: NaN, // free crop
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 0.9,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false
      });
  };
});

function closeCropModal() {
  cropModal.style.display = "none";

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  if (pendingInput) {
    pendingInput.value = "";
    pendingInput = null;
  }

  activeVariantIndex = null;
}

cropCloseBtn?.addEventListener("click", closeCropModal);
cropCancelBtn?.addEventListener("click", closeCropModal);


cropSaveBtn?.addEventListener("click", async () => {
  if (!cropper || activeVariantIndex === null || !variants[activeVariantIndex]) return;

  const canvas = cropper.getCroppedCanvas({
    width: 800,
    height: 800,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });

  if (!canvas) {
    showToast?.("Failed to crop image", "error");
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      showToast?.("Failed to process cropped image", "error");
      return;
    }

    const fileName = `variant-${Date.now()}.jpg`;
    const croppedFile = new File([blob], fileName, { type: "image/jpeg" });

    const tempId = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    const previewUrl = URL.createObjectURL(croppedFile);

    variants[activeVariantIndex]._newImageFiles = variants[activeVariantIndex]._newImageFiles || [];
    variants[activeVariantIndex]._newImageFiles.push({
      tempId,
      file: croppedFile
    });

    variants[activeVariantIndex].image = variants[activeVariantIndex].image || [];
    variants[activeVariantIndex].image.push({
      url: previewUrl,
      isNew: true,
      tempId
    });

    renderVariantContent(variants[activeVariantIndex], activeVariantIndex);
    closeCropModal();
  }, "image/jpeg", 0.9);
});

function clearFieldError(el) {
  if (!el) return;
  el.classList.remove("error");

  const oldErr = el.parentElement?.querySelector(".error-message");
  if (oldErr) oldErr.remove();
}

function setFieldError(el, message) {
  if (!el) return;
  clearFieldError(el);

  el.classList.add("error");

  const err = document.createElement("small");
  err.className = "error-message";
  err.style.color = "red";
  err.style.display = "block";
  err.style.marginTop = "6px";
  err.textContent = message;

  el.parentElement?.appendChild(err);
}

function clearAllErrors() {
  document.querySelectorAll(".error-message").forEach((el) => el.remove());
  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));
}

function isValidSku(value) {
  return /^[A-Za-z0-9_-]{3,30}$/.test(String(value || "").trim());
}

function validateVariants() {
  if (!variants.length) {
    showToast?.("Please add at least one variant", "error");
    return false;
  }

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i] || {};
    const color = variant?.color?.trim() || "";
    const colorCode = variant?.colorCode?.trim() || ""
    const sku = String(variant.sku || "").trim();
    const price = Number(variant.price);
    const stock = Number(variant.stock);
    const images = Array.isArray(variant.image) ? variant.image : [];

    if (!color) {
      showToast?.(`Variant ${i + 1}: color is required`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="color"]');
        setFieldError(el, "Color is required");
        el?.focus();
      }, 0);
      return false;
    }

    if(!colorCode){
      showToast?.(`Variant ${i + 1}: colorCode is required`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="colorCode"]');
        setFieldError(el, "Please select an color");
        el?.focus();
      }, 0);
      return false;
    }

    if (!sku) {
      showToast?.(`Variant ${i + 1}: SKU is required`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="sku"]');
        setFieldError(el, "SKU is required");
        el?.focus();
      }, 0);
      return false;
    }

    if (!isValidSku(sku)) {
      showToast?.(`Variant ${i + 1}: invalid SKU`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="sku"]');
        setFieldError(el, "SKU must be 3-30 chars and only letters, numbers, _ or -");
        el?.focus();
      }, 0);
      return false;
    }

    if (!Number.isFinite(price) || price <= 0) {
      showToast?.(`Variant ${i + 1}: price must be greater than 0`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="price"]');
        setFieldError(el, "Price must be greater than 0");
        el?.focus();
      }, 0);
      return false;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      showToast?.(`Variant ${i + 1}: stock must be 0 or more`, "error");
      openVariant(i);
      setTimeout(() => {
        const el = variantContentArea.querySelector('.variant-input[data-field="stock"]');
        setFieldError(el, "Stock must be 0 or more");
        el?.focus();
      }, 0);
      return false;
    }

    if (images.length < 1) {
      showToast?.(`Variant ${i + 1}: add at least one image`, "error");
      openVariant(i);
      setTimeout(() => {
        const uploadBox = variantContentArea.querySelector(".variant-img-upload");
        setFieldError(uploadBox, "At least one image is required");
      }, 0);
      return false;
    }
  }

  return true;
}

function validateForm() {
  clearAllErrors();

  const nameEl = document.getElementById("name");
  const categoryEl = document.getElementById("category");
  const brandEl = document.getElementById("brand");
  const statusEl = document.getElementById("status");
  const shortDescEl = document.getElementById("shortDescription");
  const fullDescEl = document.getElementById("fullDescription");

  const name = nameEl?.value.trim() || "";
  const categoryId = categoryEl?.value || "";
  const brand = brandEl?.value || "";
  const status = statusEl?.value || "";
  const shortDescription = shortDescEl?.value.trim() || "";
  const fullDescription = fullDescEl?.value.trim() || "";

  if (!name) {
    setFieldError(nameEl, "Product name is required");
    nameEl?.focus();
    showToast?.("Please enter product name", "error");
    return false;
  }

  if (name.length < 2) {
    setFieldError(nameEl, "Product name must be at least 2 characters");
    nameEl?.focus();
    showToast?.("Invalid product name", "error");
    return false;
  }

  if (!categoryId) {
    setFieldError(categoryEl, "Please select a category");
    categoryEl?.focus();
    showToast?.("Please select category", "error");
    return false;
  }

  if (!brand) {
    setFieldError(brandEl, "Please select a brand");
    brandEl?.focus();
    showToast?.("Please select brand", "error");
    return false;
  }

  if (!status) {
    setFieldError(statusEl, "Please select product status");
    statusEl?.focus();
    showToast?.("Please select status", "error");
    return false;
  }

  if (shortDescription && shortDescription.length > 200) {
    setFieldError(shortDescEl, "Short description must be 200 characters or less");
    shortDescEl?.focus();
    showToast?.("Short description is too long", "error");
    return false;
  }

  if (fullDescription && fullDescription.length > 3000) {
    setFieldError(fullDescEl, "Full description is too long");
    fullDescEl?.focus();
    showToast?.("Full description is too long", "error");
    return false;
  }

  return validateVariants();
}

document.addEventListener("input", (e) => {
  if (e.target.matches("#name, #shortDescription, #fullDescription, .variant-input")) {
    clearFieldError(e.target);
  }
});

document.addEventListener("change", (e) => {
  if (e.target.matches("#category, #brand, #status")) {
    clearFieldError(e.target);
  }

  if (e.target.closest(".variant-image-input")) {
    const uploadBox = variantContentArea.querySelector(".variant-img-upload");
    clearFieldError(uploadBox);
  }
});

  addProductForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateForm()) return;
    const originalText = saveButton.textContent
    saveButton.textContent = "Updating..."
  try {

    const formData = new FormData();

    formData.append("name", document.getElementById("name").value.trim());
    formData.append("categoryId", document.getElementById("category").value);
    formData.append("brand", document.getElementById("brand").value);
    formData.append("status", document.getElementById("status").value);
    formData.append("shortDescription", document.getElementById("shortDescription").value.trim());
    formData.append("fullDescription", document.getElementById("fullDescription").value.trim());
    formData.append("specifications", JSON.stringify(specifications));

    const cleanVariants = variants.map((variant) => ({
      ...variant,
      image: (variant.image || []).filter((img) => typeof img === "string"),
      _newImageFiles: undefined
    }));

    formData.append("variants", JSON.stringify(cleanVariants));

    variants.forEach((variant, variantIndex) => {
      (variant._newImageFiles || []).forEach((item) => {
        formData.append(`variantImages_${variantIndex}`, item.file);
      });
    });
    
    const res = await axios.patch(`/admin/products/${productId}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    showToast?.(res.data.message || "Product updated successfully");
    setTimeout(() => {
      window.location.href = "/admin/products";
    }, 800);
  } catch (error) {
    showToast?.(error.response?.data?.message || "Failed to update product", "error");
    saveButton.textContent = originalText

  }finally{
    saveButton.textContent = originalText
  }
});
});
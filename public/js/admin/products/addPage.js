document.addEventListener("DOMContentLoaded", () => {
  let cropper = null;

  const form = document.getElementById("addProductForm");
  const saveButton = document.getElementById("saveButton")

  const nameInput = document.getElementById("name");
  const categoryInput = document.getElementById("category");
  const brandInput = document.getElementById("brand");
  const statusInput = document.getElementById("status");
  const shortDescriptionInput = document.getElementById("shortDescription");
  const fullDescriptionInput = document.getElementById("fullDescription");

  const addVariantBtn = document.getElementById("addVariantBtn");
  const variantTabsContainer = document.getElementById("variantTabsContainer");
  const variantContentArea = document.getElementById("variantContentArea");

  const specAddBtn = document.querySelector(".spec-input-row .btn");
  const specInputs = document.querySelectorAll(".spec-input-row .form-control");
  const specTableBody = document.querySelector(".spec-table tbody");

  // crop modal
  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropCloseBtn = document.getElementById("cropCloseBtn");
  const cropCancelBtn = document.getElementById("cropCancelBtn");
  const cropSaveBtn = document.getElementById("cropSaveBtn");

  let specifications = [];
  let variants = [];
  let activeVariantIndex = 0;

  function showToast(message, type = "error") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      alert(message);
    }
  }

  function createVariant() {
    return {
      color: "Black",
      colorCode : "",
      storage: "",
      sku: "",
      price: "",
      stock: "",
      images: [] // File objects
    };
  }

  function renderSpecifications() {
    if (!specifications.length) {
      specTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center;">No specifications added</td>
        </tr>
      `;
      return;
    }

    specTableBody.innerHTML = specifications
      .map(
        (spec, index) => `
          <tr>
            <td>${spec.label}</td>
            <td>${spec.value}</td>
            <td style="text-align:right;">
              <button type="button" class="remove-spec-btn" data-index="${index}">Remove</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  specAddBtn?.addEventListener("click", () => {
    const label = (specInputs[0]?.value || "").trim();
    const value = (specInputs[1]?.value || "").trim();

    if (!label || !value) {
      showToast("Enter specification name and value");
      return;
    }

    specifications.push({ label, value });
    specInputs[0].value = "";
    specInputs[1].value = "";
    renderSpecifications();
  });

  specTableBody?.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-spec-btn");
    if (!btn) return;

    const index = Number(btn.dataset.index);
    specifications.splice(index, 1);
    renderSpecifications();
  });

  function renderVariantTabs() {
    variantTabsContainer.innerHTML = variants
      .map(
        (variant, index) => `
          <div class="variant-tab ${index === activeVariantIndex ? "active" : ""}" data-index="${index}">
            <div class="variant-tab-text">
              <span class="variant-tab-title">
                ${variant.color || "Color"} ${variant.storage ? "/ " + variant.storage : ""}
              </span>
              <span class="variant-tab-price">
                +$${Number(variant.price || 0).toFixed(2)}
              </span>
            </div>
            ${
              variants.length > 1
                ? `
                  <div class="variant-tab-close" data-remove="${index}">
                    <span class="material-symbols-outlined" style="font-size:14px;">close</span>
                  </div>
                `
                : ""
            }
          </div>
        `
      )
      .join("");
  }

  function renderVariantImages(variant) {
    return `
      <div id="variantImagePreview" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
        ${variant.images
          .map((img, imgIndex) => {
            const previewUrl =
              img instanceof File ? URL.createObjectURL(img) : String(img);

            return `
              <div style="position:relative; width:80px; height:80px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
                <img src="${previewUrl}" style="width:100%; height:100%; object-fit:cover;">
                <button
                  type="button"
                  class="remove-variant-image"
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
                  "
                >✕</button>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderVariantContent() {
    const variant = variants[activeVariantIndex];
    if (!variant) return;

    variantContentArea.innerHTML = `
      <div class="grid-3">
        <div class="form-group">
          <label>Color <span class="required">*</span></label>
          <input id="variantColor" type="text" class="form-control" placeholder="Enter color" value="${variant.color}">
          
        </div>
    

        <div class="form-group">
          <label>SKU <span class="required">*</span></label>
          <input id="variantSku" type="text" class="form-control" placeholder="Enter SKU" value="${variant.sku}">
        </div>
        <div class="form-group">
          <label>Color code <span class="required">*</span></label>
          <input type="color" id="variantColorCode" class="form-control color-picker" value="${variant.colorCode}" placeholder="Enter SKU">
        </div>
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label>Price <span class="required">*</span></label>
          <input id="variantPrice" type="number" class="form-control" placeholder="0.00" value="${variant.price}">
        </div>

        <div class="form-group">
          <label>Stock Quantity <span class="required">*</span></label>
          <input id="variantStock" type="number" class="form-control" placeholder="0" value="${variant.stock}">
        </div>
      </div>

      <div class="variant-images" style="margin-top:8px;">
        <label>Variant Images</label>

        <div class="variant-img-upload" id="variantUploadBox" style="cursor:pointer;">
          <div class="variant-img-icon">
            <span class="material-symbols-outlined">add</span>
          </div>
        </div>

        ${renderVariantImages(variant)}

        <input type="file" id="variantImageInput" accept="image/*" hidden>
      </div>
    `;

    bindVariantContentEvents();
  }

  function renderVariants() {
    renderVariantTabs();
    renderVariantContent();
  }

  function openCropModal(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
      cropImage.src = event.target.result;
      cropModal.style.display = "flex";

      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

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

    reader.readAsDataURL(file);
  }

  function closeCropModal() {
    cropModal.style.display = "none";
    cropImage.src = "";

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  function bindVariantContentEvents() {
    const variant = variants[activeVariantIndex];
    if (!variant) return;

    const colorInput = document.getElementById("variantColor");
    const colorCode = document.getElementById("variantColorCode")
    const skuInput = document.getElementById("variantSku");
    const priceInput = document.getElementById("variantPrice");
    const stockInput = document.getElementById("variantStock");
    const uploadBox = document.getElementById("variantUploadBox");
    const imageInput = document.getElementById("variantImageInput");

    colorInput.addEventListener("change", () => {
      variant.color = colorInput.value;
      renderVariantTabs();
    });

    skuInput.addEventListener("input", () => {
      variant.sku = skuInput.value;
    });

    priceInput.addEventListener("input", () => {
      variant.price = priceInput.value;
      renderVariantTabs();
    });

    stockInput.addEventListener("input", () => {
      variant.stock = stockInput.value;
    });

    uploadBox.addEventListener("click", () => {
      imageInput.click();
    });

    colorCode.addEventListener("input", ()=>{
      variant.colorCode = colorCode.value
    })

    imageInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const   MAX_SIZE = 2 * 1024 * 1024
      if (!file.type.startsWith("image/")) {
        showToast("Please select an image");
        imageInput.value = "";
        return;
      }

      if(file.size > MAX_SIZE){
        showToast("Image size must be less than 2MB")
        imageInput.value = ""
        return 
      }

      openCropModal(file);
      imageInput.value = "";
    });

    variantContentArea.querySelectorAll(".remove-variant-image").forEach((btn) => {
      btn.addEventListener("click", () => {
        const imgIndex = Number(btn.dataset.imgIndex);
        variant.images.splice(imgIndex, 1);
        renderVariantContent();
      });
    });
  }

  // modal listeners (only once)
  cropCloseBtn?.addEventListener("click", closeCropModal);
  cropCancelBtn?.addEventListener("click", closeCropModal);

  cropSaveBtn?.addEventListener("click", () => {
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
      width: 800,
      height: 800
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const croppedFile = new File([blob], `variant-${Date.now()}.jpg`, {
          type: "image/jpeg"
        });

        variants[activeVariantIndex].images.push(croppedFile);
        closeCropModal();
        renderVariantContent();
      },
      "image/jpeg",
      0.9
    );
  });

addVariantBtn?.addEventListener("click", () => {
  const currentVariant = variants[activeVariantIndex];

  if (currentVariant) {
    if (!currentVariant.sku.trim()) {
      showToast(`Variant ${activeVariantIndex + 1}: SKU is required`);
      return;
    }

    if (currentVariant.price === "" || Number(currentVariant.price) < 0) {
      showToast(`Variant ${activeVariantIndex + 1}: Enter valid price`);
      return;
    }
  }

  variants.push(createVariant());
  activeVariantIndex = variants.length - 1;
  renderVariants();
});

  variantTabsContainer?.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".variant-tab-close");
    if (closeBtn) {
      const removeIndex = Number(closeBtn.dataset.remove);
      variants.splice(removeIndex, 1);

      if (activeVariantIndex >= variants.length) {
        activeVariantIndex = variants.length - 1;
      }
      if (activeVariantIndex < 0) {
        activeVariantIndex = 0;
      }

      renderVariants();
      return;
    }

    const tab = e.target.closest(".variant-tab");
    if (!tab) return;

    activeVariantIndex = Number(tab.dataset.index);
    renderVariants();
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!nameInput.value.trim()) {
      showToast("Product name is required");
      return;
    }

    if (!categoryInput.value) {
      showToast("Category is required");
      return;
    }

    if (!brandInput.value) {
      showToast("Brand is required");
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];

      if (!v.sku.trim()) {
        showToast(`Variant ${i + 1}: SKU is required`);
        return;
      }

      if (v.price === "" || Number(v.price) < 0) {
        showToast(`Variant ${i + 1}: Enter valid price`);
        return;
      }

      if (v.stock === "" || Number(v.stock) < 0) {
        showToast(`Variant ${i + 1}: Enter valid stock`);
        return;
      }
    }

    const formData = new FormData();

    formData.append("name", nameInput.value.trim());
    formData.append("categoryId", categoryInput.value);
    formData.append("brand", brandInput.value);
    formData.append("status", statusInput.value);
    formData.append("shortDescription", shortDescriptionInput.value.trim());
    formData.append("fullDescription", fullDescriptionInput.value.trim());
    formData.append("specifications", JSON.stringify(specifications));
    
    const finalVariants = variants.map((v) => ({
      color: v.color,
      colorCode : v.colorCode,
      sku: v.sku.trim(),
      price: Number(v.price),
      stock: Number(v.stock),
      status: "Active"
    }));

    formData.append("variants", JSON.stringify(finalVariants));

    const imageMap = [];

    variants.forEach((variant, variantIndex) => {
      variant.images.forEach((file) => {
        formData.append("variantImages", file); // same field name for all files
        imageMap.push(variantIndex);            // remember which variant owns this file
      });
    });

formData.append("imageMap", JSON.stringify(imageMap));

const originalText = saveButton.textContent
    try {
      saveButton.disabled = true
      saveButton.textContent = "Saving..."
      const res = await axios.post("/admin/products/add", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      showToast(res.data?.message || "Product added successfully", "success");
      setTimeout(() => {
        window.location.href = "/admin/products";
      }, 800);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to add product");
    }finally{
      saveButton.disabled = false
      saveButton.textContent = originalText
    }
  });

  variants.push(createVariant());
  renderSpecifications();
  renderVariants();
});
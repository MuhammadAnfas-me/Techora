// /js/admin/products/addProduct.js
document.addEventListener("DOMContentLoaded", () => {
  // -----------------------
  // Helpers
  // -----------------------
  const toast = (msg, type = "success") => {
    if (typeof window.showToast === "function") return window.showToast(msg, type);
    alert(msg);
  };

  const isImage = (file) => file && file.type && file.type.startsWith("image/");
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB

  function makeId() {
    return (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
  }

  function setError(el, message) {
    if (!el) return;
    el.classList.add("error");

    // attach / update error text
    let err = el.parentElement?.querySelector(".error-message");
    if (!err) {
      err = document.createElement("small");
      err.style.color = "red"
      err.className = "error-message";
      el.parentElement?.appendChild(err);
    }
    err.textContent = message;
    err.style.display = "block";
  }

  function clearErrors(form) {
    form.querySelectorAll(".form-control.error").forEach((el) => el.classList.remove("error"));
    form.querySelectorAll(".error-message").forEach((el) => {
      el.textContent = "";
      el.style.display = "none";
    });
  }

  function validateFiles(files, maxCount = 10) {
    const out = [];
    for (const f of files) {
      if (!isImage(f)) {
        toast("Only image files are allowed (jpg/png/webp).", "error");
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast(`"${f.name}" is larger than 2MB.`, "error");
        continue;
      }
      out.push(f);
      if (out.length >= maxCount) break;
    }
    return out;
  }

  function renderThumb(container, file, onRemove) {
    const wrap = document.createElement("div");
    wrap.className = "image-preview";

    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";

    const url = URL.createObjectURL(file);
    img.src = url;

    const remove = document.createElement("div");
    remove.className = "remove-img";
    remove.textContent = "✕";
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(url);
      onRemove();
    });

    wrap.appendChild(img);
    wrap.appendChild(remove);
    container.appendChild(wrap);
  }

  // -----------------------
  // Grab important DOM
  // -----------------------
  const form = document.getElementById("addProductForm");
  if (!form) return;

  // Basic Info card elements (based on your exact markup order)
  const basicCard = document.querySelector(".form-card"); // first .form-card = Basic Information
  const productNameEl = basicCard?.querySelector('input[type="text"]');
  const basicSelects = basicCard?.querySelectorAll("select.form-control") || [];
  const categoryEl = basicSelects[0];
  const brandEl = basicSelects[1];
  const productStatusEl = basicSelects[2];

  // Description
  const shortDescEl = form.querySelector('input.form-control[placeholder="Brief product description"]');
  const fullDescEl = form.querySelector('textarea.form-control[placeholder="Detailed product description"]');

  // Base Images UI
  const baseUploadContainer = document.querySelector(".upload-container");
  const baseUploadBox = baseUploadContainer?.querySelector(".upload-box");

  // Specs UI
  const specRow = document.querySelector(".spec-input-row");
  const specNameEl = specRow?.querySelectorAll("input.form-control")?.[0];
  const specValueEl = specRow?.querySelectorAll("input.form-control")?.[1];
  const specAddBtn = specRow?.querySelector('button[type="button"]');
  const specTbody = document.querySelector(".spec-table tbody");

  // Variants UI
  const tabsContainer = document.getElementById("variantTabsContainer");
  const contentArea = document.getElementById("variantContentArea");
  const addVariantBtn = document.getElementById("addVariantBtn");

  // Variant fields (inside contentArea)
  const vColorEl = contentArea?.querySelector(".grid-3 select.form-control");
  const vSkuEl = contentArea?.querySelector('input.form-control[placeholder="Enter SKU"]');
  const vActiveEl = contentArea?.querySelector('.switch input[type="checkbox"]');
  const vPriceEl = contentArea?.querySelector('.grid-3 input[type="number"][placeholder="0.00"]'); // first 0.00
  const vDiscountEl = contentArea?.querySelectorAll('.grid-3 input[type="number"][placeholder="0.00"]')?.[1];
  const vStockEl = contentArea?.querySelector('input.form-control[placeholder="0"]');

  const variantImagesSection = contentArea?.querySelector(".variant-images");
  const variantUploadBox = contentArea?.querySelector(".variant-img-upload");

  // create a separate preview list dynamically
  let variantPreviewList = contentArea?.querySelector(".variant-preview-list");
  if (!variantPreviewList && variantImagesSection && variantUploadBox) {
    variantPreviewList = document.createElement("div");
    variantPreviewList.className = "variant-preview-list";
    variantImagesSection.insertBefore(variantPreviewList, variantUploadBox);
  }
  // Hidden JSON fields (created by JS)
  const specsHidden = document.createElement("input");
  specsHidden.type = "hidden";
  specsHidden.name = "specificationJson";
  form.appendChild(specsHidden);

  const variantsHidden = document.createElement("input");
  variantsHidden.type = "hidden";
  variantsHidden.name = "variantsJson";
  form.appendChild(variantsHidden);

  // -----------------------
  // Base Images: hidden file input + state
  // -----------------------
  const baseFileInput = document.createElement("input");
  baseFileInput.type = "file";
  baseFileInput.accept = "image/*";
  baseFileInput.multiple = true;
  baseFileInput.style.display = "none";
  form.appendChild(baseFileInput);

  let baseFiles = [];

  function renderBaseImages() {
    if (!baseUploadContainer) return;

    // Remove old previews (keep upload box)
    baseUploadContainer.querySelectorAll(".image-preview").forEach((el) => el.remove());

    baseFiles.forEach((file, idx) => {
      renderThumb(baseUploadContainer, file, () => {
        baseFiles.splice(idx, 1);
        renderBaseImages();
      });
    });
  }

  baseUploadBox?.addEventListener("click", () => baseFileInput.click());

  baseFileInput.addEventListener("change", async () => {
  const picked = validateFiles(baseFileInput.files, 10);

  for (const file of picked) {
    try {
      const cropped = await openCropper(file, { aspectRatio: 1, outWidth: 900, outHeight: 900 });
      baseFiles.push(cropped);
    } catch (e) {
      // user cancelled -> skip
    }
  }

  renderBaseImages();
  baseFileInput.value = "";
});

  // -----------------------
  // Specifications: state + table
  // -----------------------
  let specs = [];

  function syncSpecsHidden() {
    specsHidden.value = JSON.stringify(specs);
  }

  function renderSpecsTable() {
    if (!specTbody) return;

    specTbody.innerHTML = "";
    if (specs.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3" style="height: 40px;"></td>`;
      specTbody.appendChild(tr);
      return;
    }

    specs.forEach((s, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(s.label)}</td>
        <td>${escapeHtml(s.value)}</td>
        <td style="text-align:right;">
          <button type="button" class="btn btn-secondary" data-remove-spec="${i}" style="padding:6px 10px;">Remove</button>
        </td>
      `;
      specTbody.appendChild(tr);
    });

    specTbody.querySelectorAll("[data-remove-spec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-remove-spec"));
        specs.splice(idx, 1);
        syncSpecsHidden();
        renderSpecsTable();
      });
    });
  }

  specAddBtn?.addEventListener("click", () => {
    const label = (specNameEl?.value || "").trim();
    const value = (specValueEl?.value || "").trim();

    if (!label && !value) return; // nothing typed
    if (!label) return toast("Enter specification name.", "error");
    if (!value) return toast("Enter specification value.", "error");

    specs.push({ label, value });
    specNameEl.value = "";
    specValueEl.value = "";
    syncSpecsHidden();
    renderSpecsTable();
  });

  // prevent HTML injection in table
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // -----------------------
  // Variants: state + tabs + images
  // -----------------------
  let variants = [
    {
      id: makeId(),
      color: "",
      sku: "",
      isActive: true,
      price: "",
      discountPrice: "",
      stock: "",
      images: [], // File[]
    },
  ];
  let activeVariantIndex = 0;

  // hidden file input for variant images
  const variantFileInput = document.createElement("input");
  variantFileInput.type = "file";
  variantFileInput.accept = "image/*";
  variantFileInput.multiple = true;
  variantFileInput.style.display = "none";
  form.appendChild(variantFileInput);

  function saveActiveVariantFields() {
    const v = variants[activeVariantIndex];
    if (!v) return;

    v.color = (vColorEl?.value || "").trim();
    v.sku = (vSkuEl?.value || "").trim();
    v.isActive = Boolean(vActiveEl?.checked);
    v.price = vPriceEl?.value ?? "";
    v.discountPrice = vDiscountEl?.value ?? "";
    v.stock = vStockEl?.value ?? "";
  }

  function loadVariantFields(index) {
    const v = variants[index];
    if (!v) return;

    if (vColorEl) vColorEl.value = v.color || (vColorEl.options?.[0]?.value ?? "");
    if (vSkuEl) vSkuEl.value = v.sku || "";
    if (vActiveEl) vActiveEl.checked = Boolean(v.isActive);
    if (vPriceEl) vPriceEl.value = v.price ?? "";
    if (vDiscountEl) vDiscountEl.value = v.discountPrice ?? "";
    if (vStockEl) vStockEl.value = v.stock ?? "";

    renderVariantImages();
    updateTabsUI();
  }

  function updateTabsUI() {
    if (!tabsContainer) return;

    const tabs = tabsContainer.querySelectorAll(".variant-tab");
    tabs.forEach((tab, i) => {
      tab.classList.toggle("active", i === activeVariantIndex);

      const title = tab.querySelector(".variant-tab-title");
      const price = tab.querySelector(".variant-tab-price");

      const v = variants[i];
      if (!v) return;

      if (title) {
        const t = v.sku ? v.sku : (v.color ? v.color : `Variant ${i + 1}`);
        title.textContent = t;
      }
      if (price) {
        const p = v.price ? `+$${Number(v.price || 0).toFixed(2)}` : "+$0.00";
        price.textContent = p;
      }
    });
  }

  function renderTabsFromState() {
    if (!tabsContainer) return;

    tabsContainer.innerHTML = "";
    variants.forEach((v, i) => {
      const tab = document.createElement("div");
      tab.className = "variant-tab";
      tab.innerHTML = `
        <div class="variant-tab-text">
          <span class="variant-tab-title">Variant ${i + 1}</span>
          <span class="variant-tab-price">+$0.00</span>
        </div>
        <div class="variant-tab-close" title="Remove">
          <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
        </div>
      `;

      tab.addEventListener("click", (e) => {
        // if clicked close, ignore here
        if (e.target.closest(".variant-tab-close")) return;

        saveActiveVariantFields();
        activeVariantIndex = i;
        loadVariantFields(activeVariantIndex);
      });

      tab.querySelector(".variant-tab-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (variants.length === 1) return toast("At least 1 variant is required.", "error");

        // remove variant
        variants.splice(i, 1);
        if (activeVariantIndex >= variants.length) activeVariantIndex = variants.length - 1;

        renderTabsFromState();
        loadVariantFields(activeVariantIndex);
      });

      tabsContainer.appendChild(tab);
    });

    updateTabsUI();
  }

  function renderVariantImages() {
  if (!variantPreviewList) return;

  variantPreviewList.innerHTML = "";

  const v = variants[activeVariantIndex];
  if (!v) return;

  v.images.forEach((file, idx) => {
    renderThumb(variantPreviewList, file, () => {
      v.images.splice(idx, 1);
      renderVariantImages();
    });
  });
}

  variantUploadBox?.addEventListener("click", () => variantFileInput.click());
  variantFileInput.addEventListener("change", async () => {
  const picked = validateFiles(variantFileInput.files, 10);
  const v = variants[activeVariantIndex];
  if (!v) return;

  for (const file of picked) {
    try {
      const cropped = await openCropper(file, { aspectRatio: 1, outWidth: 900, outHeight: 900 });
      v.images.push(cropped);
    } catch (e) {}
  }

  renderVariantImages();
  variantFileInput.value = "";
});

  addVariantBtn?.addEventListener("click", () => {
    saveActiveVariantFields();

    variants.push({
      id: makeId(),
      color: "",
      sku: "",
      isActive: true,
      price: "",
      discountPrice: "",
      stock: "",
      images: [],
    });

    activeVariantIndex = variants.length - 1;
    renderTabsFromState();
    loadVariantFields(activeVariantIndex);
  });

  // init tabs + specs
  renderTabsFromState();
  renderSpecsTable();
  syncSpecsHidden();

  // -----------------------
  // Validation + Submit
  // -----------------------
  function validateForm() {
    clearErrors(form);

    let ok = true;

    const productName = (productNameEl?.value || "").trim();
    const category = (categoryEl?.value || "").trim();
    const brand = (brandEl?.value || "").trim();
    const pStatus = (productStatusEl?.value || "").trim();

    if (!productName) {
      setError(productNameEl, "• Product name is required.");
      ok = false;
    }
    if (!category) {
      setError(categoryEl, "• Please select.Category is required.");
      ok = false;
    }
    if (!brand) {
      setError(brandEl, "• Brand is required.");
      ok = false;
    }
    if (!pStatus) {
      setError(productStatusEl, "• Product status is required.");
      ok = false;
    }

    // base image is recommended; you can relax this if you want
    if (baseFiles.length === 0) {
      setError(baseUploadContainer,"• Please upload at least 1 base product image.");
      ok = false;
    }

    // variants
    saveActiveVariantFields();

    const skuSet = new Set();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];

      const sku = (v.sku || "").trim();
      const price = Number(v.price);
      const discount = v.discountPrice === "" ? null : Number(v.discountPrice);
      const stock = Number(v.stock);

      if (!sku) {
        toast(`Variant ${i + 1}: SKU is required.`, "error");
        ok = false;
      } else {
        const key = sku.toLowerCase();
        if (skuSet.has(key)) {
          toast(`Duplicate SKU found: "${sku}". SKU must be unique.`, "error");
          ok = false;
        }
        skuSet.add(key);
      }

      if (!Number.isFinite(price) || price <= 0) {
        toast(`Variant ${i + 1}: Price must be greater than 0.`, "error");
        ok = false;
      }

      if (discount !== null) {
        if (!Number.isFinite(discount) || discount < 0) {
          toast(`Variant ${i + 1}: Discount price must be 0 or more.`, "error");
          ok = false;
        }
        if (Number.isFinite(price) && discount > price) {
          toast(`Variant ${i + 1}: Discount price can't be more than price.`, "error");
          ok = false;
        }
      }

      if (!Number.isFinite(stock) || stock < 0) {
        toast(`Variant ${i + 1}: Stock must be 0 or more.`, "error");
        ok = false;
      }
    }

    return ok;
  }

  function syncVariantsHidden() {
    // don't store File objects in JSON
    const payload = variants.map((v) => ({
      id: v.id,
      color: v.color,
      sku: v.sku,
      isActive: v.isActive,
      price: v.price,
      discountPrice: v.discountPrice,
      stock: v.stock,
      // images uploaded separately via FormData
    }));
    variantsHidden.value = JSON.stringify(payload);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    syncSpecsHidden();
    syncVariantsHidden();

    // Build FormData
    const fd = new FormData();

    // Basic
    fd.append("productName", (productNameEl?.value || "").trim());
    fd.append("category", (categoryEl?.value || "").trim());
    fd.append("brand", (brandEl?.value || "").trim());
    fd.append("status", (productStatusEl?.value || "").trim());

    // Description
    fd.append("shortDescription", (shortDescEl?.value || "").trim());
    fd.append("fullDescription", (fullDescEl?.value || "").trim());

    // JSON
    fd.append("specificationJson", specsHidden.value);
    fd.append("variantsJson", variantsHidden.value);

    // Base images
    baseFiles.forEach((f) => fd.append("productImage", f)); // field name: productImage

    // Variant images with ownership mapping (same index order)
    // Server can read variantImageOwner[i] for variantImages[i]
    variants.forEach((v) => {
      v.images.forEach((file) => {
        fd.append("variantImages", file);
        fd.append("variantImageOwner", v.id);
      });
    });

    const submitBtn = form.querySelector('button[type="submit"]');
    const oldText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
    }

    try {
      console.log(fd)
      const res = await axios.post("/admin/products/add", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast(res.data?.message || "Product created successfully");
      // redirect if backend sends redirect
      if (res.data?.redirect) return window.location.assign(res.data.redirect);

      // fallback redirect
      // setTimeout(() => window.location.assign("/admin/products"), 600);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to save product", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = oldText || "Save Changes";
      }
    }
  });
});

// ---- Cropper modal setup ----
let cropper = null;

async function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return;

  if (typeof img.decode === "function") {
    try {
      await img.decode();
      return;
    } catch (_) {
      // fallback below
    }
  }

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });
}

function openCropper(file, { aspectRatio = 1, outWidth = 900, outHeight = 900 } = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      if (typeof window.Cropper !== "function") {
        throw new Error("Cropper.js not loaded properly.");
      }

      const cropModal = document.getElementById("cropModal");
      const cropImgEl = document.getElementById("cropImage");
      const cropSaveBtn = document.getElementById("cropSaveBtn");
      const cropCancelBtn = document.getElementById("cropCancelBtn");
      const cropCloseBtn = document.getElementById("cropCloseBtn");

      if (!cropModal || !cropImgEl || !cropSaveBtn || !cropCancelBtn || !cropCloseBtn) {
        throw new Error("Crop modal elements not found.");
      }

      cropSaveBtn.disabled = true;
      cropModal.classList.add("active");

      if (cropper) {
        cropper.destroy();
        cropper = null;
      }

      const url = URL.createObjectURL(file);

      const cleanup = () => {
        cropModal.classList.remove("active");

        if (cropper) {
          cropper.destroy();
          cropper = null;
        }

        cropImgEl.onload = null;
        cropImgEl.onerror = null;
        cropImgEl.src = "";

        URL.revokeObjectURL(url);

        cropSaveBtn.onclick = null;
        cropCancelBtn.onclick = null;
        cropCloseBtn.onclick = null;
      };

      const cancel = () => {
        cleanup();
        reject(new Error("Crop cancelled"));
      };

      cropCancelBtn.onclick = cancel;
      cropCloseBtn.onclick = cancel;

      // 1) set source
      cropImgEl.src = url;

      // 2) wait until image is really ready
      await waitForImage(cropImgEl);

      // 3) let modal paint once
      await new Promise((r) => requestAnimationFrame(r));

      // 4) create cropper
      cropper = new window.Cropper(cropImgEl, {
        aspectRatio: Number(aspectRatio) || 1,
        viewMode: 1,
        dragMode: "static",
        autoCrop: true,
        autoCropArea: 0.9,
        responsive:true,
        background: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        ready() {
          cropSaveBtn.disabled = false;
        }
      });

      cropSaveBtn.onclick = () => {
        try {
          if (!cropper) return;

          const canvas = cropper.getCroppedCanvas({
            width: outWidth,
            height: outHeight,
            imageSmoothingQuality: "high",
          });

          canvas.toBlob(
            (blob) => {
              if (!blob) return cancel();

              const newFile = new File([blob], "cropped.jpg", {
                type: "image/jpeg",
              });

              cleanup();
              resolve(newFile);
            },
            "image/jpeg",
            0.9
          );
        } catch (err) {
          console.error("Crop save error:", err);
          cleanup();
          reject(err);
        }
      };
    } catch (err) {
      console.error("openCropper error:", err);
      reject(err);
    }
  });
}

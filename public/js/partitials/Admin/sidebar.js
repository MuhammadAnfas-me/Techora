// Get elements
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const collapseBtn = document.getElementById("collapseBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebarClose = document.getElementById("sidebarClose");

// ✅ Prevent animation on first paint
document.body.classList.add("preload");

// ✅ Apply saved collapsed state ONCE
const shouldCollapse = localStorage.getItem("sidebarCollapsed") === "true";
if (sidebar) {
  sidebar.classList.toggle("collapsed", shouldCollapse);
}
document.body.classList.toggle("sidebar-collapsed", shouldCollapse);

// ✅ Enable transitions after first frame
requestAnimationFrame(() => {
  document.body.classList.remove("preload");
});

// ✅ Desktop collapse toggle
if (collapseBtn && sidebar) {
  collapseBtn.addEventListener("click", () => {
    const isCollapsed = !sidebar.classList.contains("collapsed");
    sidebar.classList.toggle("collapsed", isCollapsed);
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    localStorage.setItem("sidebarCollapsed", String(isCollapsed));
  });
}

// ✅ Mobile menu open
if (mobileMenuBtn && sidebar && sidebarOverlay) {
  mobileMenuBtn.addEventListener("click", () => {
    sidebar.classList.add("show");
    sidebarOverlay.classList.add("active");
  });
}

// ✅ Mobile menu close button
if (sidebarClose && sidebar && sidebarOverlay) {
  sidebarClose.addEventListener("click", () => {
    sidebar.classList.remove("show");
    sidebarOverlay.classList.remove("active");
  });
}

// ✅ Close sidebar when clicking overlay
if (sidebarOverlay && sidebar) {
  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("show");
    sidebarOverlay.classList.remove("active");
  });
}

// ✅ Close sidebar when clicking a link on mobile
document.querySelectorAll(".sidebar-nav .nav-item").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 1023 && sidebar && sidebarOverlay) {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("active");
    }
  });
});

// ✅ Always reset mobile open state on page load
if (sidebar) sidebar.classList.remove("show");
if (sidebarOverlay) sidebarOverlay.classList.remove("active");

function restUser() {
  window.location.href = "/admin/users";
}





let confirmCallback = null;

function showConfirm(message, callback) {
  const overlay = document.getElementById("confirmOverlay");
  const msg = document.getElementById("confirmMessage");
  const ok = document.getElementById("confirmOk");
  const cancel = document.getElementById("confirmCancel");

  if (!overlay || !msg || !ok || !cancel) {
    console.error("Confirm modal elements not found on this page");
    return;
  }

  msg.innerText = message;
  overlay.classList.add("active");
  confirmCallback = callback;

  cancel.onclick = () => {
    overlay.classList.remove("active");
    confirmCallback = null;
  };

  ok.onclick = async () => {
    overlay.classList.remove("active");
    const cb = confirmCallback;
    confirmCallback = null;
    if (cb) await cb();
  };
}

function applySidebarState(collapsed) {
  // ✅ always use body (consistent with your CSS: body.sidebar-collapsed ...)
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  // (optional) if any old code added it to <html>, remove it to avoid confusion
  document.documentElement.classList.remove("sidebar-collapsed");
}

document.addEventListener("DOMContentLoaded", () => {
  const collapsed = localStorage.getItem("sidebarCollapsed") === "true";
  applySidebarState(collapsed);

  const minimizeBtn = document.getElementById("minimizeBtn");
  minimizeBtn?.addEventListener("click", () => {
    const next = !document.body.classList.contains("sidebar-collapsed");
    localStorage.setItem("sidebarCollapsed", String(next));
    applySidebarState(next);
  });
});





// Initialize collapsed state on desktop if needed
// Uncomment the lines below to start with collapsed sidebar on desktop
// document.body.classList.add('sidebar-collapsed');
// sidebar.classList.add('collapsed');
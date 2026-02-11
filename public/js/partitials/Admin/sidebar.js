// Sidebar and Header functionality

// Get elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const collapseBtn = document.getElementById('collapseBtn');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarClose = document.getElementById('sidebarClose');

// Desktop collapse/expand
if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
    });
}

// Mobile menu open
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('show');
        sidebarOverlay.classList.add('active');
    });
}

// Mobile menu close
if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.remove('active');
    });
}

// Close sidebar when clicking overlay
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.remove('active');
    });
}

function restUser(){
    window.location.href = "/admin/users"
}

const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearSearch");

if (searchInput && clearBtn) {

  function toggleClearBtn() {
    clearBtn.style.display = searchInput.value.trim() ? "block" : "none";
  }

  // Run on page load
  toggleClearBtn();

  // Run when typing or deleting
  searchInput.addEventListener("input", toggleClearBtn);

  // Clear only input
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    toggleClearBtn();
    searchInput.focus();
  });

}



  const overlay = document.getElementById("confirmOverlay");
  const confirmOk = document.getElementById("confirmOk");
  const confirmCancel = document.getElementById("confirmCancel");

  let confirmCallback = null;

  function showConfirm(message, callback) {
    document.getElementById("confirmMessage").innerText = message;
    overlay.classList.add("active");
    confirmCallback = callback;
  }

  confirmCancel.onclick = () => {
    overlay.classList.remove("active");
  };

  confirmOk.onclick = () => {
    overlay.classList.remove("active");
    if (confirmCallback) confirmCallback();
  };



// Initialize collapsed state on desktop if needed
// Uncomment the lines below to start with collapsed sidebar on desktop
// document.body.classList.add('sidebar-collapsed');
// sidebar.classList.add('collapsed');
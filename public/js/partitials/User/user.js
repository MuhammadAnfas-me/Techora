
        document.addEventListener('DOMContentLoaded', function() {
            const categoriesDropdown = document.querySelector('.nav-link.dropdown');
            const categoriesMenu = document.querySelector('.categories-dropdown');
            
            const profileWrapper = document.querySelector('.profile-wrapper');
            const profileBtn = document.querySelector('.avatar');
            const profileMenu = document.querySelector('.profile-dropdown');
            
            if (categoriesDropdown && categoriesMenu) {
                categoriesDropdown.addEventListener('click', function(e) {
                    e.stopPropagation();
                    categoriesMenu.classList.toggle('show');
                    if (profileMenu) {
                        profileMenu.classList.remove('show');
                    }
                });
            }
            
            if (profileBtn && profileMenu) {
                profileBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    profileMenu.classList.toggle('show');
                    if (categoriesMenu) {
                        categoriesMenu.classList.remove('show');
                    }
                });
            }
            
            document.addEventListener('click', function(e) {
                if (categoriesMenu && !categoriesDropdown.contains(e.target)) {
                    categoriesMenu.classList.remove('show');
                }
                if (profileMenu && profileWrapper && !profileWrapper.contains(e.target)) {
                    profileMenu.classList.remove('show');
                }
            });
            
            if (categoriesMenu) {
                categoriesMenu.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
            }
            
            if (profileMenu) {
                profileMenu.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
            }
        });

window.addEventListener('load', function() {
    hideLoader();
});

window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
        hideLoader();
    }
});
function showLoader() {
  document.getElementById("loaderOverlay").style.display = "flex";
}

function hideLoader() {
  document.getElementById("loaderOverlay").style.display = "none";
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = "Loading...";
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText;
  }
}

function openCart(){
    showLoader()
    window.location.href = '/cart'
}

function openWishlist(){
    showLoader()
    window.location.href = '/wishlist'
}
// Dropdown functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Categories dropdown
            const categoriesDropdown = document.querySelector('.nav-link.dropdown');
            const categoriesMenu = document.querySelector('.categories-dropdown');
            
            // Profile dropdown
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
            
            // Close dropdowns when clicking outside
            document.addEventListener('click', function(e) {
                if (categoriesMenu && !categoriesDropdown.contains(e.target)) {
                    categoriesMenu.classList.remove('show');
                }
                if (profileMenu && profileWrapper && !profileWrapper.contains(e.target)) {
                    profileMenu.classList.remove('show');
                }
            });
            
            // Prevent dropdown menus from closing when clicking inside them
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
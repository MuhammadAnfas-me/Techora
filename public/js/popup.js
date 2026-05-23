
function showToast(title, type = 'success', sub = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // remove classes first
    toast.classList.remove('show', 'toast-success', 'toast-error');

    void toast.offsetWidth;

    // set type
    if (type === 'success') toast.classList.add('toast-success');
    if (type === 'error')   toast.classList.add('toast-error');

    const icons = {
        success : '&#10003;',
        error   : '&#10005;',
        default : '&#9432;'
    };

    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastSub').textContent = sub;
    document.getElementById('toastIcon').innerHTML = icons[type] || icons.default;

    // show again (animation restarts)
    toast.classList.add('show');

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => closeToast(), 2800);
}

function closeToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
        toast.classList.remove('hide');
    }, 250);
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = "Loading...";
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}
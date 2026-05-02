// function showToast (message, type = 'success') {
//   const toast = document.getElementById('toast')

//   toast.textContent = message
//   toast.className = `toast show ${type}`

//   setTimeout(() => {
//     toast.className = 'toast'
//   }, 1500)
// }

// function showToast(msg, type = 'success') {
//     const toast = document.getElementById('toast');
//     toast.textContent = msg;
//   console.log("Working",msg)
//     // Remove any previous type classes
//     toast.classList.remove('toast-success', 'toast-error');

//     if (type === 'default') toast.classList.add('show');
//     if (type === 'error')   toast.classList.add('toast-error');

//     toast.classList.add('show');
//     toast.classList.add('toast-success');
//     setTimeout(() => {
//         toast.classList.remove('show', 'toast-success', 'toast-error');
//     }, 2500);
// }

// function showToast(msg, type = 'success') {
//     const toast = document.getElementById('toast');
//     if (!toast) return;

//     const icons = {
//         success: '✓',
//         error:   '✕',
//         default: 'ℹ'
//     };

//     toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.default}</span> ${msg}`;

//     toast.classList.remove('toast-success', 'toast-error');
//     if (type === 'success') toast.classList.add('toast-success');
//     if (type === 'error')   toast.classList.add('toast-error');

//     toast.classList.add('show');
//     setTimeout(() => {
//         toast.classList.remove('show', 'toast-success', 'toast-error');
//     }, 2800);
// }
function showToast(title, type = 'success', sub = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // remove classes first
    toast.classList.remove('show', 'toast-success', 'toast-error');

    // 🔥 force reflow to restart animation
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
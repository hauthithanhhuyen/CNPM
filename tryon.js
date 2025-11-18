// tryon.js - Logic cho trang Thử Đồ

// ----------------------------------------------------------------------
// BIẾN TOÀN CỤC VÀ HÀM TRỢ GIÚP
// ----------------------------------------------------------------------
let G_USER_DATA = null; // Lưu thông tin người dùng
let G_TRYON_VIDEO_STREAM = null;

const tryOnVideo = document.getElementById('tryon-video');
const tryOnUserPhoto = document.getElementById('tryon-user-photo'); // canvas
const tryOnResultCanvas = document.getElementById('tryon-result-canvas');
const tryOnPlaceholder = document.getElementById('tryon-placeholder');

// Hàm hiển thị thông báo (lấy từ shop.html)
function showMessage(containerId, message, type) {
    const container = document.getElementById(containerId);
    if (container) {
        container.textContent = message;
        container.className = `message ${type}`;
        container.style.display = 'block';
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

// ----------------------------------------------------------------------
// QUẢN LÝ SESSION (Lấy từ shop.html, rút gọn)
// ----------------------------------------------------------------------
async function checkSession_Customer() {
    try {
        const response = await fetch('/api/check-session');
        const result = await response.json();
        
        if (result.success && result.user.role === 'Khách hàng') {
            G_USER_DATA = result.user;
            document.getElementById('user-links').style.display = 'flex';
            document.getElementById('guest-links').style.display = 'none';
            document.getElementById('welcome-user').textContent = `Chào, ${result.user.hoTen}`;
            loadCartCount(); 
        } else {
            G_USER_DATA = null;
            document.getElementById('user-links').style.display = 'none';
            document.getElementById('guest-links').style.display = 'flex';
        }
    } catch (error) {
        G_USER_DATA = null;
        document.getElementById('user-links').style.display = 'none';
        document.getElementById('guest-links').style.display = 'flex';
    }
}

// Tải số lượng giỏ hàng (Rút gọn)
function loadCartCount() {
    const storedCart = localStorage.getItem('myShopCart');
    const cart = storedCart ? JSON.parse(storedCart) : [];
    let count = 0;
    cart.forEach(item => {
        count += (item.SoLuong || 1); // Thêm || 1 để an toàn
    });
    document.getElementById('cart-count').textContent = count;
}

// Chuyển hướng nút Giỏ hàng và Tài khoản
document.getElementById('cart-button').addEventListener('click', () => {
    window.location.href = 'shop.html'; // Quay về shop để xem giỏ
});

document.getElementById('nav-account-link').addEventListener('click', (e) => {
    e.preventDefault();
    // Lưu trạng thái "muốn xem tài khoản" vào localStorage
    localStorage.setItem('viewOnLoad', 'account-view');
    window.location.href = 'shop.html';
});


// ----------------------------------------------------------------------
// LOGIC AI TRY-ON (MÔ PHỎNG)
// ----------------------------------------------------------------------

// Bật Camera (Step 1)
async function startCamera() {
    try {
        if (G_TRYON_VIDEO_STREAM) {
            G_TRYON_VIDEO_STREAM.getTracks().forEach(track => track.stop());
        }
        G_TRYON_VIDEO_STREAM = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400 }, audio: false });
        tryOnVideo.srcObject = G_TRYON_VIDEO_STREAM;
        
        tryOnVideo.style.display = 'block';
        tryOnUserPhoto.style.display = 'none';
        tryOnPlaceholder.style.display = 'none';
        
        document.getElementById('tryon-take-photo-btn').style.display = 'inline-block';
        document.getElementById('tryon-start-camera-btn').textContent = 'Đổi Camera';
    } catch (err) {
        showMessage('tryon-message-container', 'Lỗi: Không thể truy cập camera.', 'error');
        console.error("Lỗi Camera:", err);
    }
}

// Dừng Camera (khi chuyển trang)
window.addEventListener('beforeunload', () => {
    if (G_TRYON_VIDEO_STREAM) {
        G_TRYON_VIDEO_STREAM.getTracks().forEach(track => track.stop());
    }
});

// Chụp Ảnh (Step 1)
function takePhoto() {
    const ctx = tryOnUserPhoto.getContext('2d');
    tryOnUserPhoto.width = tryOnVideo.videoWidth;
    tryOnUserPhoto.height = tryOnVideo.videoHeight;
    ctx.drawImage(tryOnVideo, 0, 0, tryOnUserPhoto.width, tryOnUserPhoto.height);
    
    tryOnVideo.style.display = 'none';
    tryOnUserPhoto.style.display = 'block';
    
    document.getElementById('tryon-take-photo-btn').style.display = 'none';
    document.getElementById('tryon-start-camera-btn').textContent = 'Chụp Lại';
}

// Tải ảnh lên (Step 1)
function handleUploadImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const ctx = tryOnUserPhoto.getContext('2d');
            tryOnUserPhoto.width = 400; 
            tryOnUserPhoto.height = 400;

            const hRatio = tryOnUserPhoto.width / img.width;
            const vRatio = tryOnUserPhoto.height / img.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShift_x = (tryOnUserPhoto.width - img.width * ratio) / 2;
            const centerShift_y = (tryOnUserPhoto.height - img.height * ratio) / 2;
            
            ctx.clearRect(0, 0, tryOnUserPhoto.width, tryOnUserPhoto.height);
            ctx.drawImage(img, 0, 0, img.width, img.height, 
                          centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

            tryOnVideo.style.display = 'none';
            tryOnUserPhoto.style.display = 'block';
            tryOnPlaceholder.style.display = 'none';
            document.getElementById('tryon-take-photo-btn').style.display = 'none';
            document.getElementById('tryon-start-camera-btn').textContent = 'Bật Camera';
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

// Tải danh sách quần áo (Step 2 - API 31 từ server.js)
async function loadTryOnClothes() {
    const container = document.getElementById('tryon-clothes-list');
    container.innerHTML = '<p>Đang tải...</p>';
    try {
        const response = await fetch('/api/public/products');
        const result = await response.json();
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            container.innerHTML = '';
            result.data.forEach(product => {
                if (!product.HinhAnhURL) return;
                const img = document.createElement('img');
                img.src = product.HinhAnhURL;
                img.title = product.TenSanPham;
                img.dataset.url = product.HinhAnhURL;
                img.classList.add('tryon-clothing-item');
                container.appendChild(img);
            });
        } else {
            container.innerHTML = '<p>Không có sản phẩm để thử (CSDL trống).</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Lỗi tải sản phẩm.</p>';
    }
}

// "AI" Ghép ảnh (Step 3 - Mô phỏng)
function applyOverlay(clothingImageUrl) {
    if (tryOnUserPhoto.style.display === 'none') {
        showMessage('tryon-message-container', 'Vui lòng chụp ảnh hoặc tải ảnh của bạn lên trước!', 'error');
        return;
    }

    document.getElementById('tryon-result-area').style.display = 'block';
    const ctx = tryOnResultCanvas.getContext('2d');
    tryOnResultCanvas.width = tryOnUserPhoto.width;
    tryOnResultCanvas.height = tryOnUserPhoto.height;
        ctx.clearRect(0, 0, tryOnResultCanvas.width, tryOnResultCanvas.height);
        ctx.drawImage(tryOnUserPhoto, 0, 0);
    
        const clothingImg = new Image();
        clothingImg.crossOrigin = "anonymous";
        clothingImg.onload = function() {
            // Vẽ áo nhỏ lại và đặt ở vùng thân trên (giả lập mặc áo)
            const canvasW = tryOnResultCanvas.width;
            const canvasH = tryOnResultCanvas.height;
            // Tùy chỉnh các thông số này để phù hợp với ảnh của bạn
            const overlayW = canvasW * 0.6; // Áo rộng 60% ảnh
            const overlayH = canvasH * 0.35; // Áo cao 35% ảnh
            const overlayX = (canvasW - overlayW) / 2; // Căn giữa ngang
            const overlayY = canvasH * 0.23; // Đặt ở 23% chiều cao (thân trên)
            ctx.drawImage(clothingImg, overlayX, overlayY, overlayW, overlayH);
            showMessage('tryon-message-container', 'Đã ghép xong!', 'success');
        };
        clothingImg.onerror = function() {
            showMessage('tryon-message-container', 'Lỗi khi tải ảnh sản phẩm.', 'error');
        };
        clothingImg.src = clothingImageUrl + '?t=' + new Date().getTime();

    const overlayClothingImg = new Image();
    overlayClothingImg.crossOrigin = "anonymous";
    overlayClothingImg.onload = function() {
        // Vẽ áo nhỏ lại và đặt ở vùng thân trên (giả lập mặc áo)
        const canvasW = tryOnResultCanvas.width;
        const canvasH = tryOnResultCanvas.height;
        // Tùy chỉnh các thông số này để phù hợp với ảnh của bạn
        const overlayW = canvasW * 0.6; // Áo rộng 60% ảnh
        const overlayH = canvasH * 0.35; // Áo cao 35% ảnh
        const overlayX = (canvasW - overlayW) / 2; // Căn giữa ngang
        const overlayY = canvasH * 0.23; // Đặt ở 23% chiều cao (thân trên)
        ctx.drawImage(overlayClothingImg, overlayX, overlayY, overlayW, overlayH);
        showMessage('tryon-message-container', 'Đã ghép xong!', 'success');
    };
    overlayClothingImg.onerror = function() {
        showMessage('tryon-message-container', 'Lỗi khi tải ảnh sản phẩm.', 'error');
    };
    overlayClothingImg.src = clothingImageUrl + '?t=' + new Date().getTime();
}

// Lưu về máy (Step 3)
function saveTryOnToDisk() {
    const link = document.createElement('a');
    link.download = `my-try-on-${Date.now()}.jpg`;
    link.href = tryOnResultCanvas.toDataURL('image/jpeg', 0.9);
    link.click();
}

// Lưu vào tài khoản (Step 3 - API 33 từ server.js)
async function saveTryOnToAccount() {
    if (!G_USER_DATA) {
        showMessage('tryon-message-container', 'Bạn phải đăng nhập để lưu ảnh vào tài khoản.', 'error');
        return;
    }
    
    const imageDataUrl = tryOnResultCanvas.toDataURL('image/jpeg', 0.9);
    const btn = document.getElementById('tryon-save-account-btn');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
        const response = await fetch('/api/customer/tryon', { //
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageDataUrl })
        });
        const result = await response.json();
        
        if (result.success) {
            showMessage('tryon-message-container', 'Đã lưu ảnh vào tài khoản! Bạn có thể xem ở mục Tài Khoản.', 'success');
        } else {
            showMessage('tryon-message-container', result.message, 'error');
        }
    } catch (error) {
         showMessage('tryon-message-container', 'Lỗi kết nối khi lưu ảnh.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Lưu vào tài khoản';
    }
}

// Reset Try-On
function resetTryOn() {
    tryOnVideo.style.display = 'none';
    tryOnUserPhoto.style.display = 'none';
    tryOnPlaceholder.style.display = 'block';
    
    if (G_TRYON_VIDEO_STREAM) {
        G_TRYON_VIDEO_STREAM.getTracks().forEach(track => track.stop());
        G_TRYON_VIDEO_STREAM = null;
    }
    
    document.getElementById('tryon-take-photo-btn').style.display = 'none';
    document.getElementById('tryon-start-camera-btn').textContent = 'Bật Camera';
    
    document.getElementById('tryon-result-area').style.display = 'none';
    const ctx1 = tryOnUserPhoto.getContext('2d');
    ctx1.clearRect(0, 0, tryOnUserPhoto.width, tryOnUserPhoto.height);
    const ctx2 = tryOnResultCanvas.getContext('2d');
    ctx2.clearRect(0, 0, tryOnResultCanvas.width, tryOnResultCanvas.height);
}

// ----------------------------------------------------------------------
// KHỞI TẠO KHI TẢI TRANG
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải dữ liệu cơ bản
    checkSession_Customer(); 
    loadTryOnClothes();

    // 2. Gán sự kiện
    
    // Step 1: Controls
    document.getElementById('tryon-start-camera-btn').addEventListener('click', startCamera);
    document.getElementById('tryon-take-photo-btn').addEventListener('click', takePhoto);
    document.getElementById('tryon-upload-btn').addEventListener('click', () => {
        document.getElementById('tryon-upload-input').click();
    });
    document.getElementById('tryon-upload-input').addEventListener('change', handleUploadImage);
    
    // Step 2: Chọn quần áo
    document.getElementById('tryon-clothes-list').addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            applyOverlay(e.target.dataset.url);
        }
    });
    
    // Step 3: Lưu/Reset
    document.getElementById('tryon-save-disk-btn').addEventListener('click', saveTryOnToDisk);
    document.getElementById('tryon-save-account-btn').addEventListener('click', saveTryOnToAccount);
    document.getElementById('tryon-reset-btn').addEventListener('click', resetTryOn);
});
/**
 * Xử lý Responsive Sidebar cho ICB Vietnam
 */
document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    // Hàm mở menu
    const openMenu = () => {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden'); // Chặn cuộn trang khi mở menu
    };

    // Hàm đóng menu
    const closeMenu = () => {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    // Sự kiện click
    if (openBtn) openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // Tự động đóng menu nếu người dùng xoay ngang màn hình hoặc phóng to trình duyệt
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) { // 768px là breakpoint 'md' của Tailwind
            closeMenu();
        }
    });
});
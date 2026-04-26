/**
 * MAIN.JS - HỆ THỐNG QUẢN LÝ DÙNG CHUNG
 * 1. Quản lý biểu đồ Dashboard
 * 2. Bộ máy phân trang (Pagination Engine) dùng chung
 */

// --- Biến trạng thái phân trang toàn cục ---
let paginationState = {
    allData: [],
    currentPage: 1,
    rowsPerPage: 10,
    renderCallback: null 
};

document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. LOGIC CHO BIỂU ĐỒ (DASHBOARD)
    // ==========================================
    initDashboardCharts();

    // ==========================================
    // 2. KHỞI TẠO SỰ KIỆN PHÂN TRANG (NẾU CÓ)
    // ==========================================
    const rowSelect = document.getElementById('rows-per-page');
    if (rowSelect) {
        rowSelect.addEventListener('change', function() {
            paginationState.rowsPerPage = parseInt(this.value);
            paginationState.currentPage = 1; // Reset về trang đầu
            executePaginationRender();
        });
    }
});

/**
 * Khởi tạo biểu đồ trang chủ (Static data hoặc Placeholder)
 */
function initDashboardCharts() {
    const chart1Canvas = document.getElementById('chart1');
    if (chart1Canvas) {
        new Chart(chart1Canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Tài chính', 'Công nghiệp', 'Tiêu dùng', 'Vật liệu', 'BĐS', 'Khác'],
                datasets: [{
                    label: 'Số lượng công ty',
                    data: [450, 320, 280, 210, 190, 400],
                    backgroundColor: '#1e3a8a',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const chart3Canvas = document.getElementById('chart3');
    if (chart3Canvas) {
        new Chart(chart3Canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['HOSE', 'HNX', 'UPCOM'],
                datasets: [{
                    data: [410, 330, 1110],
                    backgroundColor: ['#22c55e', '#eab308', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

/**
 * HÀM PHÂN TRANG DÙNG CHUNG
 * Gọi hàm này từ icb.js hoặc company.js
 */
function initPagination(data, renderFunc) {
    paginationState.allData = data;
    paginationState.renderCallback = renderFunc;
    paginationState.currentPage = 1;
    executePaginationRender();
}

/**
 * Tính toán cắt dữ liệu và gọi hàm vẽ giao diện
 */
function executePaginationRender() {
    if (!paginationState.renderCallback) return;

    const start = (paginationState.currentPage - 1) * paginationState.rowsPerPage;
    const end = start + paginationState.rowsPerPage;
    const paginatedData = paginationState.allData.slice(start, end);

    // Thực hiện vẽ bảng ở file icb.js / company.js
    paginationState.renderCallback(paginatedData);

    // Vẽ bộ điều hướng trang
    renderPaginationControls();
}

/**
 * Hiển thị các nút điều khiển: Trang trước, Trang sau, Số trang
 */
function renderPaginationControls() {
    const container = document.getElementById('pagination-controls');
    if (!container) return;

    const totalPages = Math.ceil(paginationState.allData.length / paginationState.rowsPerPage) || 1;
    
    container.innerHTML = `
        <div class="flex items-center gap-4">
            <button onclick="changePage(-1)" ${paginationState.currentPage === 1 ? 'disabled' : ''} 
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-30 transition">
                <i class="fa-solid fa-chevron-left mr-1"></i> Trước
            </button>
            
            <span class="text-sm font-semibold text-gray-700">
                Trang ${paginationState.currentPage} <span class="text-gray-400 font-normal">/ ${totalPages}</span>
            </span>
            
            <button onclick="changePage(1)" ${paginationState.currentPage === totalPages ? 'disabled' : ''} 
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-30 transition">
                Sau <i class="fa-solid fa-chevron-right ml-1"></i>
            </button>
        </div>
    `;
}

/**
 * Chuyển đổi trang
 */
function changePage(step) {
    paginationState.currentPage += step;
    executePaginationRender();
    
    // Tự động cuộn lên đầu bảng sau khi chuyển trang
    const mainArea = document.querySelector('main');
    if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
}
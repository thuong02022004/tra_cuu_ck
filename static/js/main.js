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
 * Khởi tạo biểu đồ trang chủ (Dữ liệu mẫu cho Dashboard)
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
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
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
                plugins: { 
                    legend: { position: 'bottom' } 
                }
            }
        });
    }
}

/**
 * HÀM PHÂN TRANG DÙNG CHUNG
 * Gọi hàm này từ các file nghiệp vụ (icb.js, company.js, tra_cuu.js...)
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

    // Thực hiện callback để vẽ bảng ở file nghiệp vụ tương ứng
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
    
    // Đảm bảo không vượt quá tổng số trang nếu dữ liệu bị thay đổi
    if (paginationState.currentPage > totalPages) paginationState.currentPage = totalPages;

    container.innerHTML = `
        <div class="flex items-center gap-4">
            <button onclick="changePage(-1)" ${paginationState.currentPage === 1 ? 'disabled' : ''} 
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-30 transition flex items-center">
                <i class="fa-solid fa-chevron-left mr-2 text-[10px]"></i> Trước
            </button>
            
            <div class="text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-1 rounded-md border">
                Trang ${paginationState.currentPage} <span class="text-gray-400 font-normal mx-1">/</span> ${totalPages}
            </div>
            
            <button onclick="changePage(1)" ${paginationState.currentPage === totalPages ? 'disabled' : ''} 
                class="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-30 transition flex items-center">
                Sau <i class="fa-solid fa-chevron-right ml-2 text-[10px]"></i>
            </button>
        </div>
    `;
}

/**
 * Chuyển đổi trang
 */
function changePage(step) {
    const totalPages = Math.ceil(paginationState.allData.length / paginationState.rowsPerPage) || 1;
    const nextPage = paginationState.currentPage + step;

    if (nextPage >= 1 && nextPage <= totalPages) {
        paginationState.currentPage = nextPage;
        executePaginationRender();
        
        // Tự động cuộn lên đầu bảng sau khi chuyển trang để người dùng dễ quan sát
        const mainArea = document.querySelector('main') || window;
        mainArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
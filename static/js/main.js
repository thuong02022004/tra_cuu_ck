/**
 * MAIN.JS - HỆ THỐNG QUẢN LÝ DÙNG CHUNG
 * 1. Quản lý biểu đồ Dashboard & Thống kê thực tế (Công ty, Ngành L1, Ngành L4)
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
    // 1. LOGIC CHO BIỂU ĐỒ & THỐNG KÊ THỰC TẾ
    // ==========================================
    initRealtimeDashboard();

    // ==========================================
    // 2. KHỞI TẠO SỰ KIỆN PHÂN TRANG (NẾU CÓ)
    // ==========================================
    const rowSelect = document.getElementById('rows-per-page');
    if (rowSelect) {
        rowSelect.addEventListener('change', function() {
            paginationState.rowsPerPage = parseInt(this.value);
            paginationState.currentPage = 1; 
            executePaginationRender();
        });
    }
});

/**
 * Hàm lấy dữ liệu thực từ API để cập nhật Dashboard
 */
async function initRealtimeDashboard() {
    try {
        // --- PHẦN 1: THỐNG KÊ CÔNG TY & BIỂU ĐỒ SÀN ---
        const resStocks = await fetch('/api/get-stocks');
        const stocks = await resStocks.json();

        if (Array.isArray(stocks)) {
            // Cập nhật Tổng công ty
            const totalCompanyElement = document.getElementById('total-companies-count');
            if (totalCompanyElement) {
                totalCompanyElement.innerText = stocks.length.toLocaleString();
            }

            // Xử lý dữ liệu biểu đồ sàn
            const exchangeCounts = stocks.reduce((acc, s) => {
                const ex = s.exchange || 'Khác';
                acc[ex] = (acc[ex] || 0) + 1;
                return acc;
            }, {});
            renderDashboardCharts(exchangeCounts);
        }

        // --- PHẦN 2: THỐNG KÊ NGÀNH (ICB) ---
        const resIcb = await fetch('/api/get-icb');
        const icbData = await resIcb.json();

        if (Array.isArray(icbData)) {
            // Đếm ngành cấp 1 (level 1)
            const countL1 = icbData.filter(item => parseInt(item.level) === 1).length;
            const l1Element = document.getElementById('total-l1-count');
            if (l1Element) l1Element.innerText = countL1.toLocaleString();

            // Đếm ngành cấp 4 (level 4)
            const countL4 = icbData.filter(item => parseInt(item.level) === 4).length;
            const l4Element = document.getElementById('total-l4-count');
            if (l4Element) l4Element.innerText = countL4.toLocaleString();
        }

    } catch (err) {
        console.error("Lỗi khi tải dữ liệu Dashboard:", err);
        // Fallback dữ liệu mẫu nếu API lỗi
        renderDashboardCharts({ 'HOSE': 410, 'HNX': 330, 'UPCOM': 1110 });
    }
}

/**
 * Vẽ biểu đồ với dữ liệu được truyền vào
 */
function renderDashboardCharts(exchangeData) {
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const chart3Canvas = document.getElementById('chart3');
    if (chart3Canvas) {
        new Chart(chart3Canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(exchangeData),
                datasets: [{
                    data: Object.values(exchangeData),
                    backgroundColor: ['#22c55e', '#eab308', '#64748b', '#ef4444', '#a855f7'],
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
 * HÀM PHÂN TRANG DÙNG CHUNG (GIỮ NGUYÊN LOGIC CŨ)
 */
function initPagination(data, renderFunc) {
    paginationState.allData = data;
    paginationState.renderCallback = renderFunc;
    paginationState.currentPage = 1;
    executePaginationRender();
}

function executePaginationRender() {
    if (!paginationState.renderCallback) return;
    const start = (paginationState.currentPage - 1) * paginationState.rowsPerPage;
    const end = start + paginationState.rowsPerPage;
    const paginatedData = paginationState.allData.slice(start, end);
    paginationState.renderCallback(paginatedData);
    renderPaginationControls();
}

function renderPaginationControls() {
    const container = document.getElementById('pagination-controls');
    if (!container) return;
    const totalPages = Math.ceil(paginationState.allData.length / paginationState.rowsPerPage) || 1;
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

function changePage(step) {
    const totalPages = Math.ceil(paginationState.allData.length / paginationState.rowsPerPage) || 1;
    const nextPage = paginationState.currentPage + step;
    if (nextPage >= 1 && nextPage <= totalPages) {
        paginationState.currentPage = nextPage;
        executePaginationRender();
        const mainArea = document.querySelector('main') || window;
        mainArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
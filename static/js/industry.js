let allData = [];
const BASE_URL = 'http://127.0.0.1:5000';

document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();
    loadExchanges();

    // Toggle Menu Lọc
    const btnFilter = document.getElementById('btn-toggle-filter');
    const menuFilter = document.getElementById('filter-menu');
    
    btnFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        menuFilter.classList.toggle('hidden');
    });

    // Đóng menu khi bấm ra ngoài
    document.addEventListener('click', () => menuFilter.classList.add('hidden'));
    menuFilter.addEventListener('click', (e) => e.stopPropagation());

    // Nút áp dụng lọc
    document.getElementById('btn-apply-filter').addEventListener('click', () => {
        menuFilter.classList.add('hidden');
        executeFilterAndRender();
    });
});

async function fetchInitialData() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-stocks-with-hierarchy`);
        allData = await res.json();
        initPagination(allData, renderIndustryRows);
    } catch (e) { console.error(e); }
}

async function loadExchanges() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-exchanges`);
        const exchanges = await res.json();
        const select = document.getElementById('filter-exchange');
        exchanges.forEach(ex => {
            if(ex) select.insertAdjacentHTML('beforeend', `<option value="${ex}">${ex}</option>`);
        });
    } catch (e) { console.error(e); }
}

function executeFilterAndRender() {
    const exchange = document.getElementById('filter-exchange').value;
    let filtered = allData;
    
    if (exchange !== 'all') {
        filtered = allData.filter(d => d.exchange === exchange);
    }
    
    // Khởi tạo lại phân trang với dữ liệu đã lọc
    initPagination(filtered, renderIndustryRows);
}

function renderIndustryRows(displayData) {
    const tbody = document.getElementById('industry-table-body');
    const levelMode = document.getElementById('display-level-mode').value;
    if (!tbody) return;

    tbody.innerHTML = '';
    displayData.forEach(item => {
        let icbCellContent = '';
        let levelLabel = '';

        if (levelMode === 'all') {
            icbCellContent = `
                <div class="py-1 space-y-1">
                    <div class="text-[10px] text-gray-400">L1: ${item.l1}</div>
                    <div class="text-[10px] text-gray-500">L2: ${item.l2}</div>
                    <div class="text-[10px] text-blue-500">L3: ${item.l3}</div>
                    <div class="text-xs font-bold text-navy">L4: ${item.l4}</div>
                </div>`;
            levelLabel = 'Full';
        } else {
            // Mặc định l4 hoặc l1, l2, l3 theo chọn
            icbCellContent = `<span class="font-medium text-navy">${item[levelMode] || item.l4}</span>`;
            levelLabel = levelMode.toUpperCase();
        }

        const row = `
            <tr class="hover:bg-blue-50 transition-colors border-b">
                <td class="px-6 py-4">${icbCellContent}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100">
                        ${levelLabel}
                    </span>
                </td>
                <td class="px-6 py-4 font-mono font-bold text-gray-800">${item.stock_code}</td>
                <td class="px-6 py-4 font-medium text-gray-600">${item.company_name}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 bg-gray-100 border rounded text-[10px] font-bold text-gray-600">
                        ${item.exchange}
                    </span>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const info = document.getElementById('pagination-info');
    if (info) info.innerHTML = `Tổng số: ${paginationState.allData.length} mã`;
}
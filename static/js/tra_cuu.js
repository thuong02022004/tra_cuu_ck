// SỬA TẠI ĐÂY: Để trống để tự động nhận diện domain hiện tại (Local hoặc Render)
const BASE_URL = ''; 
let allLookupData = []; 

document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();

    // Toggle Menu Filter
    const btnFilter = document.getElementById('btn-toggle-filter');
    const menuFilter = document.getElementById('filter-menu');
    
    if (btnFilter && menuFilter) {
        btnFilter.addEventListener('click', (e) => {
            e.stopPropagation();
            menuFilter.classList.toggle('hidden');
        });
        document.addEventListener('click', () => menuFilter.classList.add('hidden'));
        menuFilter.addEventListener('click', (e) => e.stopPropagation());
    }

    // Nút Áp dụng lọc kết hợp
    document.getElementById('btn-apply-lookup').addEventListener('click', () => {
        menuFilter.classList.add('hidden');
        executeCombinedFilter();
    });

    // Nút Đặt lại
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-exchange').value = 'all';
        document.getElementById('filter-user-group').value = 'all';
        document.getElementById('filter-level-icb').value = 'l4';
        document.getElementById('global-search').value = '';
        executeCombinedFilter();
    });
});

async function fetchInitialData() {
    try {
        // Sử dụng BASE_URL tương đối để tương thích môi trường Production (Render)
        const res = await fetch(`${BASE_URL}/api/lookup-stocks`);
        allLookupData = await res.json();
        
        // 1. Tự động đổ dữ liệu vào các Select lọc
        populateDropdowns();
        
        // 2. Render lần đầu
        executeCombinedFilter();
    } catch (err) {
        console.error("Lỗi tải dữ liệu:", err);
    }
}

function populateDropdowns() {
    const exchangeSelect = document.getElementById('filter-exchange');
    const groupSelect = document.getElementById('filter-user-group');

    // Lấy danh sách sàn duy nhất
    const exchanges = [...new Set(allLookupData.map(item => item.exchange))];
    exchanges.sort().forEach(ex => {
        if(ex) exchangeSelect.insertAdjacentHTML('beforeend', `<option value="${ex}">${ex}</option>`);
    });

    // Lấy danh sách nhóm định nghĩa duy nhất
    let groupSet = new Set();
    allLookupData.forEach(item => {
        if (item.user_groups && item.user_groups !== 'Chưa phân nhóm') {
            item.user_groups.split(', ').forEach(g => groupSet.add(g));
        }
    });
    [...groupSet].sort().forEach(g => {
        groupSelect.insertAdjacentHTML('beforeend', `<option value="${g}">${g}</option>`);
    });
}

function executeCombinedFilter() {
    const exchangeFilter = document.getElementById('filter-exchange').value;
    const userGroupFilter = document.getElementById('filter-user-group').value;
    const searchTerm = document.getElementById('global-search').value.toLowerCase().trim();

    // LOGIC LỌC KẾT HỢP
    const filtered = allLookupData.filter(item => {
        const matchExchange = (exchangeFilter === 'all' || item.exchange === exchangeFilter);
        const matchUserGroup = (userGroupFilter === 'all' || item.user_groups.includes(userGroupFilter));
        const matchSearch = (item.stock_code.toLowerCase().includes(searchTerm) || 
                             item.company_name.toLowerCase().includes(searchTerm));

        return matchExchange && matchUserGroup && matchSearch;
    });

    initPagination(filtered, renderLookupRows);
}

function renderLookupRows(displayData) {
    const tbody = document.getElementById('lookup-table-body');
    const levelMode = document.getElementById('filter-level-icb').value;
    if (!tbody) return;

    tbody.innerHTML = '';
    displayData.forEach(item => {
        // Badge cho Nhóm
        let groupBadges = '<span class="text-gray-300 italic text-[10px]">Chưa gán</span>';
        if (item.user_groups && item.user_groups !== 'Chưa phân nhóm') {
            const groups = item.user_groups.split(', ');
            groupBadges = groups.map(g => 
                `<span class="inline-block px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-bold border border-purple-100 mr-1 mb-1">${g}</span>`
            ).join('');
        }

        const row = `
            <tr class="hover:bg-blue-50/50 transition-colors">
                <td class="px-6 py-4 font-mono font-bold text-navy uppercase">${item.stock_code}</td>
                <td class="px-6 py-4 font-semibold text-gray-800">${item.company_name}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-bold border">${item.exchange}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs text-blue-600 font-medium">${item[levelMode.toUpperCase()] || item.l4}</div>
                </td>
                <td class="px-6 py-4 whitespace-normal">${groupBadges}</td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const info = document.getElementById('pagination-info');
    if (info && typeof paginationState !== 'undefined') {
        info.innerHTML = `Tìm thấy ${paginationState.allData.length} kết quả`;
    }
}

function filterLookupTable() {
    executeCombinedFilter();
}
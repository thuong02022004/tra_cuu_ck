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
    const btnApply = document.getElementById('btn-apply-lookup');
    if (btnApply) {
        btnApply.addEventListener('click', () => {
            menuFilter.classList.add('hidden');
            executeCombinedFilter();
        });
    }

    // Nút Đặt lại
    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            document.getElementById('filter-exchange').value = 'all';
            document.getElementById('filter-user-group').value = 'all';
            document.getElementById('filter-level-icb').value = 'l4';
            document.getElementById('global-search').value = '';
            executeCombinedFilter();
        });
    }
});

/**
 * Lấy dữ liệu tra cứu tổng hợp
 */
async function fetchInitialData() {
    try {
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

/**
 * Đổ dữ liệu vào các ô lọc (Sàn, Nhóm)
 */
function populateDropdowns() {
    const exchangeSelect = document.getElementById('filter-exchange');
    const groupSelect = document.getElementById('filter-user-group');
    if (!exchangeSelect || !groupSelect) return;

    // Lấy danh sách sàn duy nhất
    const exchanges = [...new Set(allLookupData.map(item => item.exchange))];
    exchangeSelect.innerHTML = '<option value="all">Tất cả sàn</option>';
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
    groupSelect.innerHTML = '<option value="all">Tất cả nhóm</option>';
    [...groupSet].sort().forEach(g => {
        groupSelect.insertAdjacentHTML('beforeend', `<option value="${g}">${g}</option>`);
    });
}

/**
 * Logic lọc kết hợp
 */
function executeCombinedFilter() {
    const exchangeFilter = document.getElementById('filter-exchange').value;
    const userGroupFilter = document.getElementById('filter-user-group').value;
    const searchTerm = document.getElementById('global-search').value.toLowerCase().trim();

    const filtered = allLookupData.filter(item => {
        const matchExchange = (exchangeFilter === 'all' || item.exchange === exchangeFilter);
        const matchUserGroup = (userGroupFilter === 'all' || (item.user_groups && item.user_groups.includes(userGroupFilter)));
        const matchSearch = (item.stock_code.toLowerCase().includes(searchTerm) || 
                             item.company_name.toLowerCase().includes(searchTerm));

        return matchExchange && matchUserGroup && matchSearch;
    });

    if (typeof initPagination === 'function') {
        initPagination(filtered, renderLookupRows);
    } else {
        renderLookupRows(filtered);
    }
}

/**
 * Hàm vẽ bảng dữ liệu kèm nút XOÁ GỠ MÃ (Dành cho việc sửa lỗi gán nhầm)
 */
function renderLookupRows(displayData) {
    const tbody = document.getElementById('lookup-table-body');
    const levelMode = document.getElementById('filter-level-icb').value;
    if (!tbody) return;

    tbody.innerHTML = '';
    displayData.forEach(item => {
        // Tạo Badge cho Nhóm kèm nút gỡ mã (x)
        let groupBadges = '<span class="text-gray-300 italic text-[10px]">Chưa gán</span>';
        
        if (item.user_groups && item.user_groups !== 'Chưa phân nhóm') {
            const groups = item.user_groups.split(', ');
            groupBadges = groups.map(g => `
                <span class="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-bold border border-purple-100 mr-1 mb-1 shadow-sm">
                    ${g}
                    <button onclick="handleUnassign('${item.stock_code}', '${g}')" 
                            class="ml-1.5 text-purple-400 hover:text-red-500 transition-colors" 
                            title="Gỡ mã ${item.stock_code} khỏi nhóm ${g}">
                        <i class="fa-solid fa-circle-xmark"></i>
                    </button>
                </span>
            `).join('');
        }

        const row = `
            <tr class="hover:bg-blue-50/50 transition-colors border-b border-gray-50">
                <td class="px-6 py-4 font-mono font-bold text-navy uppercase text-sm">${item.stock_code}</td>
                <td class="px-6 py-4 font-semibold text-gray-800 text-sm">${item.company_name}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-bold border uppercase">${item.exchange}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs text-blue-600 font-medium">${item[levelMode.toLowerCase()] || item.l4}</div>
                </td>
                <td class="px-6 py-4 whitespace-normal">${groupBadges}</td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const info = document.getElementById('pagination-info');
    if (info && typeof paginationState !== 'undefined') {
        info.innerHTML = `Tìm thấy <span class="text-navy font-bold">${paginationState.allData.length}</span> kết quả`;
    }
}

/**
 * HÀM XỬ LÝ GỠ MÃ (Dùng khi bấm nút x trên Badge nhóm)
 */
async function handleUnassign(stockCode, groupName) {
    if (!confirm(`Thượng có chắc muốn gỡ ${stockCode} khỏi nhóm "${groupName}" không?`)) return;

    try {
        const res = await fetch(`${BASE_URL}/api/unassign-by-name`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stock_code: stockCode,
                group_name: groupName
            })
        });

        const result = await res.json();
        if (res.ok) {
            alert(result.message);
            // Tải lại dữ liệu sau khi gỡ thành công
            fetchInitialData(); 
        } else {
            alert("Lỗi: " + result.error);
        }
    } catch (err) {
        alert("Lỗi kết nối server!");
    }
}

function filterLookupTable() {
    executeCombinedFilter();
}
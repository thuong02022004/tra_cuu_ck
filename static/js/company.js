let currentEditId = null;
let allCompaniesData = []; // Lưu trữ toàn bộ dữ liệu để tìm kiếm nhanh
const BASE_URL = ''; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải dữ liệu ban đầu
    loadCompanies();
    loadExchangesToDropdown();

    // 2. Lắng nghe sự kiện Tìm kiếm (Mã CK hoặc Tên công ty)
    const searchInput = document.getElementById('search-company');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            executeSearch(this.value);
        });
    }

    // 3. Lắng nghe sự kiện click nút "Thêm công ty"
    const btnOpenForm = document.getElementById('btn-open-form');
    if (btnOpenForm) {
        btnOpenForm.onclick = () => {
            currentEditId = null; 
            document.getElementById('modal-company-title').textContent = "Thêm Công Ty Mới";
            document.getElementById('form-company').reset();
            const modal = document.getElementById('modal-form-company');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        };
    }

    // 4. Lắng nghe sự kiện lọc theo Sàn
    const filterExchange = document.getElementById('filter-exchange');
    if (filterExchange) {
        filterExchange.addEventListener('change', function() {
            const selectedEx = this.value;
            if (selectedEx === 'all') {
                initPagination(allCompaniesData, renderStockRows);
            } else {
                const filtered = allCompaniesData.filter(item => item.exchange === selectedEx);
                initPagination(filtered, renderStockRows);
            }
        });
    }

    // 5. Xử lý Submit Form (Thêm & Sửa)
    document.getElementById('form-company')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            stock_code: document.getElementById('cp-code').value.trim(),
            company_name: document.getElementById('cp-name').value.trim(),
            exchange: document.getElementById('cp-exchange').value,
            icb_code: document.getElementById('cp-icb-code').value.trim()
        };

        const method = currentEditId ? 'PUT' : 'POST';
        const url = currentEditId ? `${BASE_URL}/api/update-stock/${currentEditId}` : `${BASE_URL}/api/add-stock`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok) {
                alert(currentEditId ? "Cập nhật thành công!" : "Thêm mới thành công!");
                closeCompanyModal();
                loadCompanies(); 
            } else {
                alert("Lỗi: " + (result.error || "Không thể thao tác"));
            }
        } catch (error) {
            alert("Lỗi kết nối đến Server Flask!");
        }
    });
});

/**
 * Hàm thực hiện tìm kiếm kết hợp
 */
function executeSearch(keyword) {
    const term = keyword.toLowerCase().trim();
    
    // Lọc từ biến allCompaniesData
    const filtered = allCompaniesData.filter(item => 
        item.stock_code.toLowerCase().includes(term) || 
        item.company_name.toLowerCase().includes(term)
    );

    // Cập nhật lại phân trang với kết quả tìm kiếm
    if (typeof initPagination === "function") {
        initPagination(filtered, renderStockRows);
    }
}

async function loadExchangesToDropdown() {
    const select = document.getElementById('filter-exchange');
    if (!select) return;
    try {
        const res = await fetch(`${BASE_URL}/api/get-exchanges`);
        const exchanges = await res.json();
        select.innerHTML = '<option value="all">-- Tất cả các sàn --</option>';
        exchanges.forEach(ex => {
            if (ex) {
                const opt = document.createElement('option');
                opt.value = ex;
                opt.textContent = `Sàn ${ex}`;
                select.appendChild(opt);
            }
        });
    } catch (err) { console.error("Lỗi tải danh sách sàn:", err); }
}

async function loadCompanies() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-stocks`);
        allCompaniesData = await res.json(); // Lưu dữ liệu vào biến tổng
        
        if (typeof initPagination === "function") {
            initPagination(allCompaniesData, renderStockRows);
        }
    } catch (err) {
        console.error("Lỗi loadTable:", err);
        const tbody = document.getElementById('company-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Lỗi kết nối API</td></tr>';
    }
}

function renderStockRows(paginatedData) {
    const tbody = document.getElementById('company-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Không tìm thấy dữ liệu phù hợp</td></tr>';
        return;
    }

    paginatedData.forEach(item => {
        let badgeClass = 'bg-gray-100 text-gray-800';
        if (item.exchange === 'HOSE') badgeClass = 'bg-green-100 text-green-700';
        else if (item.exchange === 'HNX') badgeClass = 'bg-blue-100 text-blue-700';
        else if (item.exchange === 'UPCOM') badgeClass = 'bg-purple-100 text-purple-700';

        const row = `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="px-6 py-4 text-gray-400 font-mono">${item.id}</td>
                <td class="px-6 py-4 font-bold text-navy">${item.stock_code}</td>
                <td class="px-6 py-4 font-medium text-gray-700">${item.company_name}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-block whitespace-nowrap px-2 py-1 rounded text-[10px] font-bold ${badgeClass}">${item.exchange}</span>
                </td>
                <td class="px-6 py-4 font-mono text-emerald-600 font-bold">${item.icb_code || '-'}</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <button onclick="editCompany(${item.id})" class="text-blue-500 hover:text-blue-700 p-2 transition">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick="deleteCompany(${item.id})" class="text-red-500 hover:text-red-700 p-2 transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const info = document.getElementById('pagination-info');
    if (info) info.innerHTML = `<span class="text-xs text-gray-500 italic font-medium">Tìm thấy ${paginatedData.length} kết quả</span>`;
}

// Các hàm CRUD & Import
function closeCompanyModal() {
    const modal = document.getElementById('modal-form-company');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    currentEditId = null;
}

async function editCompany(id) {
    currentEditId = id;
    try {
        const res = await fetch(`${BASE_URL}/api/get-stock/${id}`);
        const stock = await res.json();
        document.getElementById('modal-company-title').textContent = "Sửa Thông Tin Công Ty";
        document.getElementById('cp-code').value = stock.stock_code;
        document.getElementById('cp-name').value = stock.company_name;
        document.getElementById('cp-exchange').value = stock.exchange;
        document.getElementById('cp-icb-code').value = stock.icb_code || '';
        const modal = document.getElementById('modal-form-company');
        modal.classList.remove('hidden'); modal.classList.add('flex');
    } catch (e) { alert("Không lấy được thông tin chi tiết!"); }
}

async function deleteCompany(id) {
    if (confirm("Xác nhận xóa mã cổ phiếu này?")) {
        try {
            const res = await fetch(`${BASE_URL}/api/delete-stock/${id}`, { method: 'DELETE' });
            if (res.ok) { alert("Đã xóa!"); loadCompanies(); }
        } catch (e) { alert("Lỗi khi xóa!"); }
    }
}

async function handleImportCompany() {
    const fileInput = document.getElementById('file-import');
    if (!fileInput.files.length) return;
    const modalProgress = document.getElementById('modal-progress');
    const progressBar = document.getElementById('progress-bar');
    modalProgress.classList.remove('hidden'); modalProgress.classList.add('flex');
    progressBar.style.width = '0%';
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
        const response = await fetch(`${BASE_URL}/api/import-stocks`, { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            progressBar.style.width = '100%';
            document.getElementById('progress-title').textContent = result.message || "Thành công!";
            document.getElementById('btn-close-progress').classList.remove('hidden');
            loadCompanies();
        } else { throw new Error(result.error); }
    } catch (error) {
        document.getElementById('progress-title').textContent = "Lỗi: " + error.message;
        document.getElementById('btn-close-progress').classList.remove('hidden');
    } finally { fileInput.value = ''; }
}
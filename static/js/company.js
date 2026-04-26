let currentEditId = null;
let allCompaniesData = []; // Lưu trữ dữ liệu gốc để tìm kiếm & lọc
const BASE_URL = ''; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải dữ liệu ban đầu
    loadCompanies();
    loadExchangesToDropdown();

    // 2. Sự kiện Tìm kiếm (Mã CK hoặc Tên công ty)
    const searchInput = document.getElementById('search-company');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            executeSearch(this.value);
        });
    }

    // 3. Sự kiện mở Form THÊM MỚI
    const btnOpenForm = document.getElementById('btn-open-form');
    if (btnOpenForm) {
        btnOpenForm.addEventListener('click', () => {
            currentEditId = null; // Reset ID về null để hiểu là thêm mới
            document.getElementById('modal-company-title').textContent = "Thêm Công Ty Mới";
            document.getElementById('form-company').reset();
            openCompanyModal();
        });
    }

    // 4. Sự kiện Lọc theo Sàn
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

    // 5. Xử lý SUBMIT FORM (Thêm & Sửa)
    const companyForm = document.getElementById('form-company');
    if (companyForm) {
        companyForm.addEventListener('submit', async (e) => {
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
                
                if (res.ok) {
                    alert(currentEditId ? "Cập nhật thành công!" : "Thêm mới thành công!");
                    closeCompanyModal();
                    loadCompanies(); // Tải lại bảng dữ liệu
                } else {
                    const result = await res.json();
                    alert("Lỗi: " + (result.error || "Không thể thao tác"));
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi kết nối đến Server!");
            }
        });
    }
});

// --- CÁC HÀM XỬ LÝ CHÍNH ---

function executeSearch(keyword) {
    const term = keyword.toLowerCase().trim();
    const filtered = allCompaniesData.filter(item => 
        item.stock_code.toLowerCase().includes(term) || 
        item.company_name.toLowerCase().includes(term)
    );
    if (typeof initPagination === "function") {
        initPagination(filtered, renderStockRows);
    }
}

async function loadCompanies() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-stocks`);
        allCompaniesData = await res.json();
        if (typeof initPagination === "function") {
            initPagination(allCompaniesData, renderStockRows);
        }
    } catch (err) {
        console.error("Lỗi loadTable:", err);
    }
}

// HÀM CHỈNH SỬA: Lấy thông tin chi tiết và đổ vào Modal
async function editCompany(id) {
    currentEditId = id;
    try {
        const res = await fetch(`${BASE_URL}/api/get-stock/${id}`);
        if (!res.ok) throw new Error("Không thể lấy dữ liệu");
        
        const stock = await res.json();
        
        // Đổ dữ liệu vào các ô input
        document.getElementById('modal-company-title').textContent = "Sửa Thông Tin Công Ty";
        document.getElementById('cp-code').value = stock.stock_code;
        document.getElementById('cp-name').value = stock.company_name;
        document.getElementById('cp-exchange').value = stock.exchange;
        document.getElementById('cp-icb-code').value = stock.icb_code || '';
        
        openCompanyModal();
    } catch (e) {
        console.error(e);
        alert("Không lấy được thông tin chi tiết!");
    }
}

// HÀM XÓA
async function deleteCompany(id) {
    if (!confirm("Xác nhận xóa mã cổ phiếu này?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/delete-stock/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Đã xóa!");
            loadCompanies();
        }
    } catch (e) {
        alert("Lỗi khi xóa!");
    }
}

// --- HÀM GIAO DIỆN (MODAL) ---

function openCompanyModal() {
    const modal = document.getElementById('modal-form-company');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeCompanyModal() {
    const modal = document.getElementById('modal-form-company');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentEditId = null;
    document.getElementById('form-company').reset();
}

// --- HÀM BỔ TRỢ ---

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
    } catch (err) { console.error(err); }
}

function renderStockRows(paginatedData) {
    const tbody = document.getElementById('company-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (paginatedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Không tìm thấy dữ liệu</td></tr>';
        return;
    }

    paginatedData.forEach(item => {
        let badgeClass = item.exchange === 'HOSE' ? 'bg-green-100 text-green-700' : 
                         (item.exchange === 'HNX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700');

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
}
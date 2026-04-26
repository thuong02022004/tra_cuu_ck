let currentEditId = null;
const BASE_URL = 'http://127.0.0.1:5000';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tải dữ liệu ban đầu và danh sách sàn vào dropdown lọc
    loadCompanies();
    loadExchangesToDropdown();

    // 2. Lắng nghe sự kiện click nút "Thêm công ty"
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

    // 3. Lắng nghe sự kiện lọc theo Sàn
    const filterExchange = document.getElementById('filter-exchange');
    if (filterExchange) {
        filterExchange.addEventListener('change', function() {
            const selectedEx = this.value;
            if (selectedEx === 'all') {
                loadCompanies(); // Load lại toàn bộ
            } else {
                filterStocksByExchange(selectedEx); // Lọc theo sàn cụ thể
            }
        });
    }

    // 4. Xử lý Submit Form (Thêm & Sửa)
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

// --- HÀM TẢI DANH SÁCH SÀN DUY NHẤT TỪ DATABASE ---
async function loadExchangesToDropdown() {
    const select = document.getElementById('filter-exchange');
    if (!select) return;
    try {
        const res = await fetch(`${BASE_URL}/api/get-exchanges`);
        const exchanges = await res.json();
        // Reset dropdown nhưng giữ option "Tất cả"
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

// --- HÀM LỌC CỔ PHIẾU THEO SÀN ---
async function filterStocksByExchange(exchangeName) {
    try {
        const res = await fetch(`${BASE_URL}/api/stocks-by-exchange/${exchangeName}`);
        const data = await res.json();
        // Gửi dữ liệu lọc được qua bộ máy phân trang của main.js
        if (typeof initPagination === "function") {
            initPagination(data, renderStockRows);
        }
    } catch (err) { console.error("Lỗi lọc sàn:", err); }
}

// 5. Hàm hiển thị danh sách Stock (Tích hợp phân trang)
async function loadCompanies() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-stocks`);
        const data = await res.json();
        if (typeof initPagination === "function") {
            initPagination(data, renderStockRows);
        }
    } catch (err) {
        console.error("Lỗi loadTable:", err);
        const tbody = document.getElementById('company-table-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-red-500">Lỗi kết nối API</td></tr>';
    }
}

// 6. Hàm render hàng (Được gọi bởi bộ máy phân trang)
function renderStockRows(paginatedData) {
    const tbody = document.getElementById('company-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (paginatedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Chưa có dữ liệu</td></tr>';
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
    // Cập nhật thông tin số lượng
    const info = document.getElementById('pagination-info');
    if (info) info.innerHTML = `<span class="text-xs text-gray-500 italic font-medium">Đang hiển thị dữ liệu lọc</span>`;
}

// 7. Các hàm CRUD & Import giữ nguyên logic của bạn
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
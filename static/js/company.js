let currentEditId = null;
let allCompaniesData = []; 
const BASE_URL = ''; 

document.addEventListener('DOMContentLoaded', () => {
    loadCompanies();
    loadExchangesToDropdown();

    const searchInput = document.getElementById('search-company');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            executeSearch(this.value);
        });
    }

    const btnOpenForm = document.getElementById('btn-open-form');
    if (btnOpenForm) {
        btnOpenForm.addEventListener('click', () => {
            currentEditId = null; 
            document.getElementById('modal-company-title').textContent = "Thêm Công Ty Mới";
            document.getElementById('form-company').reset();
            openCompanyModal();
        });
    }

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

    // --- XỬ LÝ SUBMIT FORM (Sửa & Thêm) ---
    const companyForm = document.getElementById('form-company');
    if (companyForm) {
        companyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Lấy dữ liệu từ các ô input
            const payload = {
                stock_code: document.getElementById('cp-code').value.trim(),
                company_name: document.getElementById('cp-name').value.trim(),
                exchange: document.getElementById('cp-exchange').value,
                icb_code: document.getElementById('cp-icb-code').value.trim()
            };

            // Quyết định URL và Method dựa trên việc có đang EDIT hay không
            const method = currentEditId ? 'PUT' : 'POST';
            const url = currentEditId 
                ? `${BASE_URL}/api/update-stock/${currentEditId}` 
                : `${BASE_URL}/api/add-stock`;

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
                    alert("Lỗi: " + (result.error || "Không thể thực hiện thao tác"));
                }
            } catch (error) {
                console.error("Fetch error:", error);
                alert("Lỗi kết nối đến Server!");
            }
        });
    }
});

// --- HÀM LOAD DỮ LIỆU ĐỂ SỬA ---
async function editCompany(id) {
    currentEditId = id; // Gán ID hiện tại để biết là đang EDIT
    try {
        const res = await fetch(`${BASE_URL}/api/get-stock/${id}`);
        if (!res.ok) throw new Error("Không thể lấy dữ liệu");
        const stock = await res.json();
        
        // Hiển thị dữ liệu cũ lên Form
        document.getElementById('modal-company-title').textContent = "Sửa Thông Tin Công Ty";
        document.getElementById('cp-code').value = stock.stock_code || '';
        document.getElementById('cp-name').value = stock.company_name || '';
        document.getElementById('cp-exchange').value = stock.exchange || '';
        document.getElementById('cp-icb-code').value = stock.icb_code || '';
        
        openCompanyModal();
    } catch (e) {
        alert("Không lấy được thông tin chi tiết!");
    }
}


// --- HÀM XỬ LÝ IMPORT VỚI THANH TIẾN TRÌNH & BÁO LỖI ---
async function handleImportCompany() {
    const fileInput = document.getElementById('file-import');
    if (!fileInput.files.length) return;

    // Lấy các thành phần UI Progress
    const modal = document.getElementById('modal-progress');
    const bar = document.getElementById('progress-bar-fill');
    const percentText = document.getElementById('progress-percent');
    const statusText = document.getElementById('progress-status-text');
    const iconContainer = document.getElementById('progress-icon-container');

    // 1. Reset trạng thái UI về ban đầu (Xanh dương)
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    bar.style.width = '0%';
    bar.classList.remove('from-red-500', 'to-red-600');
    bar.classList.add('from-blue-500', 'to-indigo-600');
    percentText.innerText = '0%';
    percentText.classList.remove('text-red-600');
    percentText.classList.add('text-blue-700');
    statusText.innerText = 'Đang tải file lên hệ thống...';
    statusText.classList.remove('text-red-500', 'font-bold');
    iconContainer.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin text-6xl text-blue-600"></i>';

    // Xóa nút đóng cũ nếu có
    const oldCloseBtn = document.getElementById('btn-close-error');
    if (oldCloseBtn) oldCloseBtn.remove();

    // 2. Chạy thanh tiến trình giả lập (0% -> 90%)
    let progress = 0;
    const timer = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 5; 
            if (progress > 90) progress = 90;
            bar.style.width = progress + '%';
            percentText.innerText = Math.round(progress) + '%';
            
            if (progress > 30) statusText.innerText = 'Đang phân tích cấu trúc file...';
            if (progress > 60) statusText.innerText = 'Đang đối soát dữ liệu với Database...';
        }
    }, 500);

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${BASE_URL}/api/import-stocks`, { method: 'POST', body: formData });
        const result = await res.json();

        clearInterval(timer);

        if (res.ok) {
            // --- THÀNH CÔNG ---
            bar.style.width = '100%';
            percentText.innerText = '100%';
            statusText.innerText = 'Hoàn tất: ' + result.message;
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check text-6xl text-emerald-500 animate-bounce"></i>';

            setTimeout(() => {
                location.reload();
            }, 1500);
        } else {
            // --- LỖI TỪ BACKEND ---
            throw new Error(result.error || "Dữ liệu file không hợp lệ hoặc sai định dạng.");
        }

    } catch (err) {
        // --- XỬ LÝ KHI CÓ LỖI ---
        clearInterval(timer);
        
        // Chuyển UI sang trạng thái lỗi (Đỏ)
        bar.classList.remove('from-blue-500', 'to-indigo-600');
        bar.classList.add('from-red-500', 'to-red-600');
        bar.style.width = '100%'; 

        percentText.innerText = 'LỖI!';
        percentText.classList.remove('text-blue-700');
        percentText.classList.add('text-red-600');
        
        statusText.innerText = err.message;
        statusText.classList.add('text-red-500', 'font-bold');
        iconContainer.innerHTML = '<i class="fa-solid fa-circle-exclamation text-6xl text-red-500 animate-pulse"></i>';

        // Tạo nút đóng để người dùng thoát khỏi modal lỗi
        const closeBtn = document.createElement('button');
        closeBtn.id = 'btn-close-error';
        closeBtn.innerHTML = 'Đóng và Kiểm tra lại file';
        closeBtn.className = 'mt-6 px-6 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-black transition-all';
        closeBtn.onclick = () => { modal.classList.add('hidden'); };
        modal.querySelector('.bg-white').appendChild(closeBtn);

    } finally {
        fileInput.value = ''; // Luôn reset input để có thể chọn lại file
    }
}

// --- CÁC HÀM XỬ LÝ CHÍNH KHÁC ---

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

async function editCompany(id) {
    currentEditId = id;
    try {
        const res = await fetch(`${BASE_URL}/api/get-stock/${id}`);
        if (!res.ok) throw new Error("Không thể lấy dữ liệu");
        const stock = await res.json();
        document.getElementById('modal-company-title').textContent = "Sửa Thông Tin Công Ty";
        document.getElementById('cp-code').value = stock.stock_code;
        document.getElementById('cp-name').value = stock.company_name;
        document.getElementById('cp-exchange').value = stock.exchange;
        document.getElementById('cp-icb-code').value = stock.icb_code || '';
        openCompanyModal();
    } catch (e) {
        alert("Không lấy được thông tin chi tiết!");
    }
}

async function deleteCompany(id) {
    if (!confirm("Xác nhận xóa mã cổ phiếu này?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/delete-stock/${id}`, { method: 'DELETE' });
        if (res.ok) { alert("Đã xóa!"); loadCompanies(); }
    } catch (e) { alert("Lỗi khi xóa!"); }
}

function openCompanyModal() {
    const modal = document.getElementById('modal-form-company');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCompanyModal() {
    const modal = document.getElementById('modal-form-company');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    currentEditId = null;
    document.getElementById('form-company').reset();
}

async function loadExchangesToDropdown() {
    const select = document.getElementById('filter-exchange');
    if (!select) return;
    try {
        const res = await fetch(`${BASE_URL}/api/get-exchanges`);
        const exchanges = await res.json();
        select.innerHTML = '<option value="all">Tất cả sàn</option>';
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500 italic">Không tìm thấy dữ liệu phù hợp</td></tr>';
        return;
    }
    paginatedData.forEach(item => {
        let badgeClass = item.exchange === 'HOSE' ? 'bg-green-100 text-green-700' : 
                         (item.exchange === 'HNX' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700');
        const row = `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="px-6 py-4 text-gray-400 font-mono text-xs">${item.id}</td>
                <td class="px-6 py-4 font-bold text-navy">${item.stock_code}</td>
                <td class="px-6 py-4 font-medium text-gray-700">${item.company_name}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-block px-2 py-1 rounded text-[10px] font-bold ${badgeClass}">${item.exchange}</span>
                </td>
                <td class="px-6 py-4 font-mono text-emerald-600 font-bold">${item.icb_code || '-'}</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <button onclick="editCompany(${item.id})" class="text-blue-500 hover:text-blue-700 p-2 transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteCompany(${item.id})" class="text-red-500 hover:text-red-700 p-2 transition"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}
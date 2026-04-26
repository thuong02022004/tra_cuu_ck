const BASE_URL = 'http://127.0.0.1:5000';
let currentEditId = null;
let allGroups = [];
let allStocksForAssign = []; 
let selectedStockIds = new Set(); // Dùng Set để lưu tạm các ID đã tích chọn

document.addEventListener('DOMContentLoaded', () => {
    loadGroups();

    // 1. Xử lý Form Thêm/Sửa NHÓM
    const groupForm = document.getElementById('form-stock-group');
    if (groupForm) {
        groupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const codeInput = document.getElementById('group-code');
            const nameInput = document.getElementById('group-name');
            const descInput = document.getElementById('group-desc');

            let groupCodeValue = codeInput ? codeInput.value.trim() : "";
            const payload = {
                group_code: groupCodeValue !== "" ? groupCodeValue : null, 
                group_name: nameInput ? nameInput.value.trim() : "",
                group_type: null, 
                description: descInput ? descInput.value.trim() : "",
                is_active: 1
            };

            const method = currentEditId ? 'PUT' : 'POST';
            const url = currentEditId 
                ? `${BASE_URL}/api/update-stock-group/${currentEditId}` 
                : `${BASE_URL}/api/add-stock-group`;

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    closeGroupModal();
                    loadGroups();
                    alert(currentEditId ? "Cập nhật thành công!" : "Thêm nhóm thành công!");
                } else {
                    const err = await res.json();
                    alert("Lỗi: " + err.error);
                }
            } catch (err) { alert("Lỗi kết nối Server!"); }
        });
    }
});

// ---------------------------------------------------------
// LOGIC QUẢN LÝ DANH SÁCH NHÓM (GIỮ NGUYÊN)
// ---------------------------------------------------------

async function loadGroups() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-stock-groups`);
        allGroups = await res.json();
        if (typeof initPagination === 'function') {
            initPagination(allGroups, renderGroupRows);
        } else {
            renderGroupRows(allGroups);
        }
    } catch (err) { console.error("Lỗi tải nhóm:", err); }
}

function renderGroupRows(displayData) {
    const tbody = document.getElementById('group-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (displayData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-16 text-center text-gray-400">Chưa có nhóm nào</td></tr>`;
        return;
    }
    displayData.forEach(g => {
        const row = `
            <tr class="hover:bg-blue-50 transition">
                <td class="px-6 py-4 font-mono font-bold text-navy uppercase">${g.GroupCode || '-'}</td>
                <td class="px-6 py-4 font-semibold text-gray-800">${g.GroupName}</td>
                <td class="px-6 py-4 text-gray-500 italic text-xs">${g.Description || '-'}</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <button onclick="editGroup(${g.Id})" class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteGroup(${g.Id})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// ---------------------------------------------------------
// LOGIC GÁN MÃ CHỨNG KHOÁN (CẬP NHẬT LƯU TẠM & LỌC CHỮ ĐẦU)
// ---------------------------------------------------------

async function openAssignStockModal() {
    const groupSelect = document.getElementById('assign-group-id');
    groupSelect.innerHTML = allGroups.map(g => `<option value="${g.Id}">${g.GroupName}</option>`).join('');

    // Reset lưu tạm khi mở modal
    selectedStockIds.clear();

    if (allStocksForAssign.length === 0) {
        try {
            const res = await fetch(`${BASE_URL}/api/get-stocks-for-assign`);
            allStocksForAssign = await res.json();
        } catch (err) { console.error("Lỗi tải cổ phiếu:", err); }
    }

    // Mặc định lọc theo ký tự trống (hiện tất cả)
    renderStockCheckboxList(allStocksForAssign);
    document.getElementById('modal-assign-stock').classList.replace('hidden', 'flex');
}

// Hàm render kèm kiểm tra trạng thái đã tích chọn
function renderStockCheckboxList(data) {
    const container = document.getElementById('stock-list-container');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Không tìm thấy mã bắt đầu bằng ký tự này</div>`;
        return;
    }

    container.innerHTML = data.map(s => {
        // Kiểm tra xem ID này có trong danh sách lưu tạm không
        const isChecked = selectedStockIds.has(s.id) ? 'checked' : '';
        return `
        <label class="flex items-center gap-2 p-2 hover:bg-white rounded border border-transparent hover:border-emerald-200 cursor-pointer transition shadow-sm">
            <input type="checkbox" value="${s.id}" ${isChecked} 
                   onchange="handleTempSelect(this)" 
                   class="stock-assign-cb w-4 h-4 accent-emerald-600">
            <div class="flex flex-col">
                <span class="font-bold text-navy text-xs">${s.code}</span>
                <span class="text-[10px] text-gray-500 truncate w-32">${s.name}</span>
            </div>
        </label>`;
    }).join('');
}

// Hàm lưu tạm ID khi người dùng click vào checkbox
function handleTempSelect(checkbox) {
    const id = parseInt(checkbox.value);
    if (checkbox.checked) {
        selectedStockIds.add(id);
    } else {
        selectedStockIds.delete(id);
    }
}

// Tìm kiếm lọc theo KÝ TỰ ĐẦU TIÊN
function filterStockList() {
    const term = document.getElementById('search-stock-assign').value.trim().toLowerCase();
    
    let filtered = allStocksForAssign;
    if (term !== "") {
        // Lọc các mã cổ phiếu bắt đầu bằng ký tự nhập vào
        filtered = allStocksForAssign.filter(s => 
            s.code.toLowerCase().startsWith(term)
        );
    }
    
    renderStockCheckboxList(filtered);
}

// LƯU VÀO DATABASE (Chỉ khi bấm nút này mới gọi API)
async function saveStockAssignment() {
    const groupId = document.getElementById('assign-group-id').value;
    const note = document.getElementById('assign-note').value.trim();
    
    // Chuyển Set lưu tạm thành mảng để gửi API
    const stockIds = Array.from(selectedStockIds);

    if (!groupId) { alert("Vui lòng chọn nhóm!"); return; }
    if (stockIds.length === 0) { alert("Bạn chưa tích chọn mã nào!"); return; }

    try {
        const res = await fetch(`${BASE_URL}/api/add-stocks-to-group`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                group_id: groupId,
                stock_ids: stockIds,
                note: note
            })
        });

        if (res.ok) {
            const result = await res.json();
            alert(result.message);
            closeAssignStockModal();
        } else {
            alert("Lỗi khi lưu gán mã!");
        }
    } catch (err) { console.error(err); }
}

// ---------------------------------------------------------
// CÁC HÀM PHỤ (GIỮ NGUYÊN)
// ---------------------------------------------------------

function openGroupModal() {
    currentEditId = null;
    document.getElementById('modal-title').textContent = "Thêm Nhóm Cổ Phiếu";
    document.getElementById('form-stock-group').reset();
    document.getElementById('modal-group').classList.replace('hidden', 'flex');
}

function closeGroupModal() {
    document.getElementById('modal-group').classList.replace('flex', 'hidden');
}

function closeAssignStockModal() {
    document.getElementById('modal-assign-stock').classList.replace('flex', 'hidden');
    document.getElementById('search-stock-assign').value = "";
    document.getElementById('assign-note').value = "";
    selectedStockIds.clear();
}

async function editGroup(id) {
    currentEditId = id;
    const g = allGroups.find(x => x.Id === id);
    if (g) {
        document.getElementById('modal-title').textContent = "Cập nhật Nhóm Cổ Phiếu";
        document.getElementById('group-code').value = g.GroupCode || '';
        document.getElementById('group-name').value = g.GroupName;
        document.getElementById('group-desc').value = g.Description || '';
        document.getElementById('modal-group').classList.replace('hidden', 'flex');
    }
}

async function deleteGroup(id) {
    if (!confirm("Thượng có chắc chắn muốn xóa nhóm này không?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/delete-stock-group/${id}`, { method: 'DELETE' });
        if (res.ok) loadGroups();
    } catch (e) { console.error(e); }
}
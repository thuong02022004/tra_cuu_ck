// SỬA TẠI ĐÂY: Để trống để tự động nhận diện domain hiện tại (Local hoặc Render)
const BASE_URL = ''; 
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
// CHỨC NĂNG MỚI: GỠ MÃ KHỎI NHÓM (DÀNH CHO TRƯỜNG HỢP GÁN NHẦM)
// ---------------------------------------------------------

/**
 * Hàm xóa gán sai dựa trên Tên mã và Tên nhóm
 * Dùng cho trường hợp: gán cho Masan nhưng lại đồng thời gán nhầm Vin thì xoá Vin đi
 */
async function unassignStockByName(stockCode, groupName) {
    const confirmMsg = `Thượng có chắc chắn muốn gỡ mã [${stockCode}] khỏi nhóm [${groupName}] không?`;
    if (!confirm(confirmMsg)) return;

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
            // Nếu Thượng đang xem danh sách tra cứu thì cập nhật lại bảng
            if (typeof loadLookupData === 'function') {
                loadLookupData(); 
            } else {
                // Hoặc load lại trang để cập nhật dữ liệu mới nhất
                location.reload();
            }
        } else {
            alert("Lỗi: " + (result.error || "Không thể gỡ mã"));
        }
    } catch (err) {
        console.error("Lỗi gỡ mã:", err);
        alert("Lỗi kết nối server khi gỡ mã!");
    }
}

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
                    <button onclick="editGroup(${g.Id})" class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg" title="Sửa thông tin nhóm"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteGroup(${g.Id})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg" title="Xóa toàn bộ nhóm"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// ---------------------------------------------------------
// LOGIC GÁN MÃ CHỨNG KHOÁN (LỌC CHỮ ĐẦU & LƯU TẠM)
// ---------------------------------------------------------

async function openAssignStockModal() {
    const groupSelect = document.getElementById('assign-group-id');
    groupSelect.innerHTML = allGroups.map(g => `<option value="${g.Id}">${g.GroupName}</option>`).join('');

    // Reset lưu tạm khi mở modal để tránh gán nhầm từ lần trước
    selectedStockIds.clear();

    if (allStocksForAssign.length === 0) {
        try {
            const res = await fetch(`${BASE_URL}/api/get-stocks-for-assign`);
            allStocksForAssign = await res.json();
        } catch (err) { console.error("Lỗi tải cổ phiếu:", err); }
    }

    renderStockCheckboxList(allStocksForAssign);
    document.getElementById('modal-assign-stock').classList.replace('hidden', 'flex');
}

function renderStockCheckboxList(data) {
    const container = document.getElementById('stock-list-container');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-xs">Không tìm thấy mã bắt đầu bằng ký tự này</div>`;
        return;
    }

    container.innerHTML = data.map(s => {
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

function handleTempSelect(checkbox) {
    const id = parseInt(checkbox.value);
    if (checkbox.checked) {
        selectedStockIds.add(id);
    } else {
        selectedStockIds.delete(id);
    }
}

function filterStockList() {
    const term = document.getElementById('search-stock-assign').value.trim().toLowerCase();
    let filtered = allStocksForAssign;
    if (term !== "") {
        filtered = allStocksForAssign.filter(s => s.code.toLowerCase().startsWith(term));
    }
    renderStockCheckboxList(filtered);
}

async function saveStockAssignment() {
    const groupId = document.getElementById('assign-group-id').value;
    const note = document.getElementById('assign-note').value.trim();
    const stockIds = Array.from(selectedStockIds);

    if (!groupId) { alert("Vui lòng chọn nhóm!"); return; }
    if (stockIds.length === 0) { alert("Thượng chưa tích chọn mã nào!"); return; }

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
            // Nếu có trang tra cứu tổng hợp thì nên reload lại để cập nhật cột nhóm
            if (window.location.pathname.includes('tra-cuu')) location.reload();
        } else {
            alert("Lỗi khi lưu gán mã!");
        }
    } catch (err) { console.error(err); }
}

// ---------------------------------------------------------
// CÁC HÀM PHỤ (MODAL & EDIT/DELETE NHÓM)
// ---------------------------------------------------------

function openGroupModal() {
    currentEditId = null;
    document.getElementById('modal-title').textContent = "Thêm Nhóm Cổ Phiếu";
    const form = document.getElementById('form-stock-group');
    if (form) form.reset();
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
    if (!confirm("Thượng có chắc chắn muốn xóa TOÀN BỘ nhóm này không? (Các mã đã gán sẽ bị gỡ hết)")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/delete-stock-group/${id}`, { method: 'DELETE' });
        if (res.ok) loadGroups();
    } catch (e) { console.error(e); }
}
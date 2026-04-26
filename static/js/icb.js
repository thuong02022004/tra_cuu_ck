let currentEditId = null;
const BASE_URL = 'http://127.0.0.1:5000'; // Flask đóng vai trò trung gian gọi Supabase

// --- HÀM TOÀN CỤC ---
function confirmDelete(id, code) {
    const m = document.getElementById('modal-delete');
    const targetSpan = document.getElementById('delete-target-code');
    const confirmBtn = document.getElementById('btn-confirm-delete');
    
    if (targetSpan) targetSpan.textContent = code;
    if (confirmBtn) confirmBtn.setAttribute('data-id', id);
    
    m.classList.remove('hidden');
    m.classList.add('flex');
}

async function editIcb(id) {
    currentEditId = id;
    try {
        // Gọi API lấy danh sách ICB từ Supabase thông qua backend
        const res = await fetch(`${BASE_URL}/api/get-icb`);
        const items = await res.json();
        const item = items.find(x => x.id === id);
        
        if (item) {
            document.getElementById('modal-form-title').textContent = "Cập nhật ICB";
            document.getElementById('icb-level').value = item.level;
            document.getElementById('icb-code').value = item.code; // Key từ API Backend đã map
            document.getElementById('icb-name-vi').value = item.name_vi;
            document.getElementById('icb-name-en').value = item.name_en;
            document.getElementById('icb-desc').value = item.description || '';
            
            // Cập nhật danh sách cha trước khi gán giá trị parent_id
            await updateParentList(item.level);
            document.getElementById('icb-parent').value = item.parent_id || '';

            const f = document.getElementById('modal-form-icb');
            f.classList.remove('hidden');
            f.classList.add('flex');
        }
    } catch (err) {
        console.error("Lỗi khi lấy dữ liệu sửa:", err);
    }
}

async function updateParentList(level) {
    const wp = document.getElementById('wrapper-parent');
    const parentSelect = document.getElementById('icb-parent');
    
    if (level <= 1) {
        wp.classList.add('hidden');
        parentSelect.innerHTML = '<option value="">-- Chọn ngành cha --</option>';
    } else {
        wp.classList.remove('hidden');
        try {
            const res = await fetch(`${BASE_URL}/api/get-parents/${level - 1}`);
            const parents = await res.json();
            let opt = '<option value="">-- Chọn ngành cha --</option>';
            parents.forEach(p => {
                opt += `<option value="${p.id}">[${p.code}] ${p.name}</option>`;
            });
            parentSelect.innerHTML = opt;
        } catch (err) {
            console.error("Lỗi load ngành cha:", err);
        }
    }
}

// --- HÀM TẠO HIỆU ỨNG ACCORDION (Giữ nguyên logic) ---
function toggleRow(id) {
    const btn = document.querySelector(`button[data-toggle-id="${id}"] i`);
    if (!btn) return;
    
    const isExpanding = btn.classList.contains('fa-plus-square') || btn.classList.contains('fa-regular');
    
    if (isExpanding) {
        btn.classList.remove('fa-plus-square', 'fa-regular');
        btn.classList.add('fa-minus-square', 'fa-solid');
        document.querySelectorAll(`tr[data-parent-id="${id}"]`).forEach(el => el.classList.remove('hidden'));
    } else {
        btn.classList.remove('fa-minus-square', 'fa-solid');
        btn.classList.add('fa-plus-square', 'fa-regular');
        document.querySelectorAll(`tr[data-parent-path*="|${id}|"]`).forEach(el => {
            if (el.getAttribute('data-id') != id) {
                el.classList.add('hidden');
                const childBtn = el.querySelector('.toggle-btn i');
                if (childBtn) {
                    childBtn.classList.remove('fa-minus-square', 'fa-solid');
                    childBtn.classList.add('fa-plus-square', 'fa-regular');
                }
            }
        });
    }
}

// --- LOGIC CHÍNH KHI LOAD TRANG ---
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-icb');
    const inputVi = document.getElementById('icb-name-vi');
    const inputEn = document.getElementById('icb-name-en');

    document.getElementById('btn-open-form')?.addEventListener('click', () => {
        currentEditId = null;
        document.getElementById('modal-form-title').textContent = "Thêm Danh Mục ICB";
        if(form) form.reset();
        document.getElementById('wrapper-parent').classList.add('hidden');
        const f = document.getElementById('modal-form-icb');
        f.classList.remove('hidden');
        f.classList.add('flex');
    });

    const closeModals = () => {
        document.getElementById('modal-form-icb').classList.add('hidden');
        document.getElementById('modal-form-icb').classList.remove('flex');
        document.getElementById('modal-delete').classList.add('hidden');
        document.getElementById('modal-delete').classList.remove('flex');
        if(form) form.reset();
        currentEditId = null;
    };

    document.getElementById('btn-close-form')?.addEventListener('click', closeModals);
    document.getElementById('btn-cancel-form')?.addEventListener('click', closeModals);
    document.getElementById('btn-cancel-delete')?.addEventListener('click', closeModals);

    if (inputVi) {
        inputVi.addEventListener('blur', async function() {
            const text = this.value.trim();
            if (text.length < 2 || (inputEn && inputEn.value !== "")) return;
            try {
                const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=vi|en`);
                const d = await res.json();
                if (inputEn) inputEn.value = d.responseData.translatedText.replace(/[^\w\s]/gi, '');
            } catch (err) { console.error("Lỗi dịch:", err); }
        });
    }

    document.getElementById('icb-level')?.addEventListener('change', function() {
        updateParentList(this.value);
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            level: document.getElementById('icb-level').value,
            parent_id: document.getElementById('icb-parent').value || null,
            code: document.getElementById('icb-code').value.trim(),
            name_vi: document.getElementById('icb-name-vi').value.trim(),
            name_en: document.getElementById('icb-name-en').value.trim(),
            description: document.getElementById('icb-desc').value.trim()
        };
        
        const method = currentEditId ? 'PUT' : 'POST';
        const url = currentEditId ? `${BASE_URL}/api/update-icb/${currentEditId}` : `${BASE_URL}/api/add-icb`;
        
        try {
            const res = await fetch(url, { 
                method, 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(payload) 
            });
            if (res.ok) {
                closeModals();
                loadTable();
            } else {
                const err = await res.json();
                alert("Lỗi: " + err.error);
            }
        } catch (err) { alert("Lỗi kết nối server!"); }
    });

    document.getElementById('btn-confirm-delete')?.addEventListener('click', async function() {
        const id = this.getAttribute('data-id');
        try {
            const res = await fetch(`${BASE_URL}/api/delete-icb/${id}`, { method: 'DELETE' });
            if (res.ok) {
                closeModals();
                loadTable();
            } else {
                const errorData = await res.json();
                alert(errorData.error);
            }
        } catch (err) { alert("Lỗi server!"); }
    });

    loadTable();
});

// --- VẼ BẢNG CÂY (Đồng bộ Supabase keys) ---
let globalIcbData = []; 

async function loadTable() {
    try {
        const res = await fetch(`${BASE_URL}/api/get-icb`);
        globalIcbData = await res.json();
        
        // Giả sử Thượng có script pagination riêng, nếu không nó sẽ chạy render mặc định
        if (window.initPagination) {
            initPagination(globalIcbData, renderIcbRows);
        } else {
            renderIcbRows(globalIcbData);
        }
    } catch (err) { console.error("Lỗi load bảng:", err); }
}

function renderIcbRows(displayData) {
    const tbody = document.getElementById('icb-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const pathMap = {};
    globalIcbData.forEach(i => { 
        pathMap[i.id] = `${i.parent_id ? pathMap[i.parent_id] : ''}|${i.id}|`;
    });

    displayData.forEach(i => {
        const hasChild = globalIcbData.some(x => x.parent_id === i.id);
        const parentPath = i.parent_id ? pathMap[i.parent_id] : '';

        const row = `
            <tr class="${i.level > 1 ? 'hidden' : ''} border-b text-sm hover:bg-gray-50 transition-all" 
                data-id="${i.id}" 
                data-parent-id="${i.parent_id || ''}" 
                data-parent-path="${parentPath}">
                <td class="px-6 py-4 text-gray-400 font-mono">${i.id}</td>
                <td class="px-6 py-4 font-bold text-navy">${i.code}</td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-block whitespace-nowrap bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">Cấp ${i.level}</span>
                </td>
                <td class="px-6 py-4">
                    <div style="margin-left: ${(i.level-1)*20}px" class="flex items-center">
                        ${hasChild ? 
                            `<button onclick="toggleRow(${i.id})" data-toggle-id="${i.id}" class="mr-2 text-blue-600 toggle-btn">
                                <i class="fa-regular fa-plus-square"></i>
                            </button>` : 
                            '<span class="mr-2 text-gray-300 ml-1">└─</span>'}
                        <span class="${i.level==1?'font-bold':''}">${i.name_vi}</span>
                    </div>
                </td>
                <td class="px-6 py-4 italic text-gray-400 hidden md:table-cell">${i.name_en || ''}</td>
                <td class="px-6 py-4 text-center font-semibold text-gray-600">${i.parent_code || '-'}</td>
                <td class="px-6 py-4 text-center whitespace-nowrap">
                    <button onclick="editIcb(${i.id})" class="text-blue-500 mr-2 hover:text-blue-700 transition"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="confirmDelete(${i.id}, '${i.code}')" class="text-red-500 hover:text-red-700 transition"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const info = document.getElementById('pagination-info');
    if (info) info.innerHTML = `<span class="text-xs text-gray-500 italic font-medium">Tổng số: ${globalIcbData.length} danh mục</span>`;
}

// --- HÀM IMPORT (Supabase hóa qua backend) ---
async function handleImport() {
    const fileInput = document.getElementById('file-import');
    if (!fileInput || !fileInput.files.length) return;

    const modalProgress = document.getElementById('modal-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const progressTitle = document.getElementById('progress-title');
    const btnClose = document.getElementById('btn-close-progress');
    
    modalProgress.classList.remove('hidden');
    modalProgress.classList.add('flex');
    if(btnClose) btnClose.classList.add('hidden');

    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) clearInterval(interval);
        else {
            width += Math.random() * 10;
            if(progressBar) progressBar.style.width = width + '%';
            if(progressPercent) progressPercent.textContent = Math.round(width) + '%';
        }
    }, 400);

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${BASE_URL}/api/import-icb-full`, { method: 'POST', body: formData });
        const result = await res.json();
        clearInterval(interval); 

        if (res.ok) {
            if(progressBar) progressBar.style.width = '100%';
            if(progressPercent) progressPercent.textContent = '100%';
            if(progressTitle) progressTitle.textContent = "Thành công!";
            if(btnClose) btnClose.classList.remove('hidden');
            loadTable();
        } else { throw new Error(result.error); }
    } catch (error) {
        clearInterval(interval);
        if(progressTitle) progressTitle.textContent = "Lỗi: " + error.message;
        if(btnClose) btnClose.classList.remove('hidden');
    } finally {
        fileInput.value = '';
    }
}
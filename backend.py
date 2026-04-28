import os
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

# =========================================================
# 1. KHỞI TẠO HỆ THỐNG & KẾT NỐI DATABASE
# =========================================================

load_dotenv()

base_dir = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.join(base_dir, 'static', 'templates')

app = Flask(__name__, template_folder=template_dir)
CORS(app)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ LỖI: Thiếu cấu hình Supabase!")
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Kết nối Supabase thành công!")
    except Exception as e:
        print(f"❌ Lỗi Supabase: {e}")
        supabase = None

def check_db():
    if supabase is None:
        return jsonify({"error": "Chưa kết nối được với Database."}), 500
    return None

def get_val(row, *keys):
    """Hàm lấy giá trị an toàn hỗ trợ cả tên cột viết Hoa/thường"""
    if not row: return None
    for k in keys:
        if k in row: return row[k]
    return None

# =========================================================
# 2. LOGIC MAPPING PHÂN CẤP (BUILD HIERARCHY)
# =========================================================

def build_icb_hierarchy():
    """Tải dữ liệu ICB và tạo hàm tra cứu từ dưới lên trên"""
    res = supabase.table('icb_levels').select("*").execute()
    icb_map = {get_val(r, 'id', 'Id'): r for r in res.data}
    
    def get_chain(icb_id):
        chain = {1: None, 2: None, 3: None, 4: None}
        current = icb_map.get(icb_id)
        while current:
            lvl = int(get_val(current, 'level', 'Level'))
            if lvl in chain:
                chain[lvl] = f"{get_val(current, 'icb_code', 'ICB_Code')} - {get_val(current, 'name_vn', 'Name_VN')}"
            parent_id = get_val(current, 'parent_id', 'Parent_Id')
            current = icb_map.get(parent_id) if parent_id else None
        return chain
    
    return icb_map, get_chain

# =========================================================
# 3. ROUTE GIAO DIỆN (FRONTEND VIEWS)
# =========================================================

@app.route('/')
@app.route('/index.html')
def index(): return render_template('index.html')

@app.route('/icb.html')
@app.route('/quan-ly-icb.html') 
def manage_icb(): return render_template('icb.html')

@app.route('/quan-ly-ck.html')
def manage_company(): return render_template('quan-ly-ck.html')

@app.route('/nhomcongty.html')
def nhom_cong_ty(): return render_template('nhomcongty.html')

@app.route('/tra-cuu.html')
def tra_cuu(): return render_template('tra-cuu.html')

@app.route('/nhom-nganh.html')
def nhom_nganh(): return render_template('nhom-nganh.html')

# =========================================================
# 4. API QUẢN LÝ NGÀNH ICB (LEVELS)
# =========================================================

@app.route('/api/get-icb', methods=['GET'])
def get_icb():
    err = check_db()
    if err: return err
    try:
        res = supabase.table('icb_levels').select("*").execute()
        data = res.data
        data.sort(key=lambda x: get_val(x, 'icb_code', 'ICB_Code') or "")
        
        # Build map để lấy parent_code
        id_to_code = {get_val(r, 'id', 'Id'): get_val(r, 'icb_code', 'ICB_Code') for r in data}
        
        results = []
        for r in data:
            p_id = get_val(r, 'parent_id', 'Parent_Id')
            results.append({
                "id": get_val(r, 'id', 'Id'),
                "code": get_val(r, 'icb_code', 'ICB_Code'),
                "level": get_val(r, 'level', 'Level'),
                "name_vi": get_val(r, 'name_vn', 'Name_VN'),
                "parent_id": p_id,
                "parent_code": id_to_code.get(p_id)
            })
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/import-icb-full', methods=['POST'])
def import_icb_full():
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    try:
        df = pd.read_csv(file, dtype=str) if file.filename.endswith('.csv') else pd.read_excel(file, dtype=str)
        df = df.where(pd.notnull(df), None)
        df['Level'] = pd.to_numeric(df['Level'])
        df = df.sort_values('Level')

        existing = supabase.table('icb_levels').select("id, icb_code").execute()
        existing_codes = {str(get_val(r, 'icb_code', 'ICB_Code')).strip() for r in existing.data}
        code_to_id = {str(get_val(r, 'icb_code', 'ICB_Code')).strip(): get_val(r, 'id', 'Id') for r in existing.data}

        added = 0
        for _, row in df.iterrows():
            level = int(row['Level'])
            clean_code = str(row['Ma_ICB']).strip().split('.')[0].zfill(3 if level == 1 else 4)
            
            if clean_code in existing_codes: continue

            p_id = None
            if row.get('Parent_Ma_ICB'):
                p_code = str(row['Parent_Ma_ICB']).strip().split('.')[0].zfill(3 if level == 2 else 4)
                p_id = code_to_id.get(p_code)

            res = supabase.table('icb_levels').insert({
                "level": level, "icb_code": clean_code, 
                "name_vn": str(row['Ten_ICB']).strip(), "parent_id": p_id
            }).execute()
            
            if res.data:
                new_id = get_val(res.data[0], 'id', 'Id')
                code_to_id[clean_code] = new_id
                existing_codes.add(clean_code)
                added += 1
        return jsonify({"message": f"Đã thêm {added} ngành ICB mới."}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# =========================================================
# 5. API QUẢN LÝ CỔ PHIẾU (STOCKS)
# =========================================================

@app.route('/api/get-stocks', methods=['GET'])
def get_stocks():
    try:
        res_s = supabase.table('stocks').select("*").execute()
        res_i = supabase.table('icb_levels').select("id, icb_code").execute()
        i_map = {get_val(r, 'id', 'Id'): get_val(r, 'icb_code', 'ICB_Code') for r in res_i.data}
        
        results = []
        for r in res_s.data:
            results.append({
                "id": get_val(r, 'id', 'Id'),
                "stock_code": get_val(r, 'stockcode', 'StockCode'),
                "company_name": get_val(r, 'companyname', 'CompanyName'),
                "exchange": get_val(r, 'exchange', 'Exchange'),
                "icb_code": i_map.get(get_val(r, 'icb_level_id', 'ICB_Level_Id')) or "-",
                "status": get_val(r, 'status', 'Status')
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/import-stocks', methods=['POST'])
def import_stocks():
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    try:
        df = pd.read_excel(file, dtype=str) if file.filename.endswith(('.xlsx', '.xls')) else pd.read_csv(file, dtype=str)
        df = df.where(pd.notnull(df), None)

        res_icb = supabase.table('icb_levels').select("id, icb_code").execute()
        icb_map = {str(get_val(r, 'icb_code', 'ICB_Code')).strip().zfill(4): get_val(r, 'id', 'Id') for r in res_icb.data}

        # Lọc trùng ngay trong file Excel để tránh lỗi "Affect row a second time"
        clean_dict = {}
        for _, row in df.iterrows():
            s_code = str(row['MÃ CHỨNG KHOÁN']).strip().upper()
            raw_icb = str(row['Ma_ICB_Level4']).strip().split('.')[0].zfill(4)
            icb_id = icb_map.get(raw_icb)
            
            if s_code and icb_id:
                clean_dict[s_code] = {
                    "stockcode": s_code,
                    "companyname": str(row['TÊN CÔNG TY']).strip(),
                    "exchange": str(row['Sàn giao dịch']).strip(),
                    "icb_level_id": icb_id,
                    "status": "Active",
                    "updateddate": "now()"
                }
        
        prepared_data = list(clean_dict.values())
        if prepared_data:
            supabase.table('stocks').upsert(prepared_data, on_conflict="stockcode").execute()
        
        return jsonify({"message": f"Đã xử lý {len(prepared_data)} mã chứng khoán."}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- API CRUD STOCKS ---
@app.route('/api/get-stock/<int:id>', methods=['GET'])
def get_stock_detail(id):
    res = supabase.table('stocks').select("*").eq('id', id).execute()
    if not res.data: return jsonify({"error": "Not found"}), 404
    r = res.data[0]
    icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
    i_res = supabase.table('icb_levels').select("icb_code").eq('id', icb_id).execute() if icb_id else None
    return jsonify({
        "id": get_val(r, 'id', 'Id'), "stock_code": get_val(r, 'stockcode', 'StockCode'),
        "company_name": get_val(r, 'companyname', 'CompanyName'), "exchange": get_val(r, 'exchange', 'Exchange'),
        "icb_code": get_val(i_res.data[0], 'icb_code') if i_res and i_res.data else None
    }), 200

@app.route('/api/delete-stock/<int:id>', methods=['DELETE'])
def delete_stock(id):
    supabase.table('stock_stockgroups').delete().eq('stock_id', id).execute()
    supabase.table('stocks').delete().eq('id', id).execute()
    return jsonify({"message": "Deleted"}), 200

# --- API CẬP NHẬT THÔNG TIN CỔ PHIẾU (Dán vào phần 5 của file Python) ---
@app.route('/api/update-stock/<int:id>', methods=['PUT'])
def update_stock(id):
    err = check_db()
    if err: return err
    
    data = request.get_json(force=True)
    update_fields = {}

    # Map dữ liệu từ Frontend gửi về đúng tên cột Database của bạn
    if 'stock_code' in data:
        update_fields['stockcode'] = data['stock_code'].upper().strip()
    if 'company_name' in data:
        update_fields['companyname'] = data['company_name'].strip()
    if 'exchange' in data:
        update_fields['exchange'] = data['exchange'].strip()

    # Xử lý cập nhật mã ngành ICB nếu có gửi icb_code
    if 'icb_code' in data and data['icb_code']:
        icb_code = str(data['icb_code']).strip().zfill(4)
        res_icb = supabase.table('icb_levels').select("id").eq('icb_code', icb_code).execute()
        if res_icb.data:
            update_fields['icb_level_id'] = res_icb.data[0]['id']
        else:
            return jsonify({"error": f"Mã ICB {icb_code} không tồn tại trong hệ thống"}), 400

    if not update_fields:
        return jsonify({"error": "Không có dữ liệu thay đổi"}), 400

    try:
        # Thực hiện cập nhật vào bảng 'stocks' theo ID
        res = supabase.table('stocks').update(update_fields).eq('id', id).execute()
        
        if res.data:
            return jsonify({"message": "Cập nhật thành công!", "data": res.data}), 200
        else:
            return jsonify({"error": "Không tìm thấy cổ phiếu để cập nhật"}), 404
            
    except Exception as e:
        print(f"❌ Lỗi Update: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# =========================================================
# 6. API QUẢN LÝ NHÓM CÔNG TY (STOCK GROUPS)
# =========================================================

@app.route('/api/get-stock-groups', methods=['GET'])
def get_stock_groups():
    res = supabase.table('stockgroups').select("*").execute()
    return jsonify([{
        "Id": get_val(r, 'id', 'Id'), "GroupCode": get_val(r, 'groupcode', 'GroupCode'),
        "GroupName": get_val(r, 'groupname', 'GroupName'), "Description": get_val(r, 'description', 'Description')
    } for r in res.data]), 200

@app.route('/api/add-stocks-to-group', methods=['POST'])
def add_stocks_to_group():
    data = request.get_json(force=True)
    g_id = data.get('group_id')
    s_ids = data.get('stock_ids')
    if not g_id or not s_ids: return jsonify({"error": "Missing data"}), 400
    
    # Lấy các mã đã gán để tránh trùng
    existing = supabase.table('stock_stockgroups').select("stock_id").eq('stockgroup_id', g_id).execute()
    ex_ids = {get_val(r, 'stock_id', 'Stock_Id') for r in existing.data}
    
    recs = [{"stock_id": sid, "stockgroup_id": g_id, "assigneddate": "now()"} for sid in s_ids if sid not in ex_ids]
    if recs: supabase.table('stock_stockgroups').insert(recs).execute()
    return jsonify({"message": f"Đã gán thành công {len(recs)} mã."}), 200

# =========================================================
# 7. API THỐNG KÊ & TRA CỨU TỔNG HỢP (MAPPING L1-L4)
# =========================================================

@app.route('/api/lookup-stocks', methods=['GET'])
def lookup_stocks():
    try:
        _, get_chain = build_icb_hierarchy()
        res_s = supabase.table('stocks').select("*").execute()
        res_links = supabase.table('stock_stockgroups').select("*").execute()
        res_g = supabase.table('stockgroups').select("id, groupname").execute()
        g_map = {get_val(r, 'id', 'Id'): get_val(r, 'groupname', 'GroupName') for r in res_g.data}
        
        s_to_g = {}
        for link in res_links.data:
            sid = get_val(link, 'stock_id', 'Stock_Id')
            gn = g_map.get(get_val(link, 'stockgroup_id', 'StockGroup_Id'))
            if gn:
                if sid not in s_to_g: s_to_g[sid] = []
                s_to_g[sid].append(gn)
        
        results = []
        for s in res_s.data:
            chain = get_chain(get_val(s, 'icb_level_id', 'ICB_Level_Id'))
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'),
                "company_name": get_val(s, 'companyname', 'CompanyName'),
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", "l3": chain[3] or "N/A", "l2": chain[2] or "N/A", "l1": chain[1] or "N/A",
                "user_groups": ", ".join(s_to_g.get(get_val(s, 'id', 'Id'), [])) or "Chưa phân nhóm"
            })
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/get-exchanges', methods=['GET'])
def get_exchanges():
    res = supabase.table('stocks').select("exchange").execute()
    exs = sorted(list(set(get_val(r, 'exchange') for r in res.data if get_val(r, 'exchange'))))
    return jsonify(exs), 200

@app.route('/api/stats/level/<int:target_level>', methods=['GET'])
def get_level_stats(target_level):
    try:
        icb_map, _ = build_icb_hierarchy()
        res_s = supabase.table('stocks').select("exchange, icb_level_id").execute()
        
        stats = {}
        for s in res_s.data:
            exch = get_val(s, 'exchange') or "Khác"
            curr = icb_map.get(get_val(s, 'icb_level_id'))
            target_name = None
            
            while curr:
                if int(get_val(curr, 'level')) == target_level:
                    target_name = f"[{get_val(curr, 'icb_code')}] {get_val(curr, 'name_vn')}"
                    break
                curr = icb_map.get(get_val(curr, 'parent_id'))
            
            if target_name:
                if target_name not in stats: stats[target_name] = {"total": 0, "exchanges": {}}
                stats[target_name]["exchanges"][exch] = stats[target_name]["exchanges"].get(exch, 0) + 1
                stats[target_name]["total"] += 1
        return jsonify(stats), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# API này dành riêng cho trang Phân loại Nhóm ngành (L1 -> L4)
@app.route('/api/get-stocks-with-hierarchy', methods=['GET'])
def api_stocks_hierarchy():
    err = check_db()
    if err: return err
    try:
        # Sử dụng hàm build_icb_hierarchy đã viết ở phần trước của file
        _, get_chain = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        results = []
        for s in res_stocks.data:
            icb_id = get_val(s, 'icb_level_id', 'ICB_Level_Id')
            chain = get_chain(icb_id)
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'),
                "company_name": get_val(s, 'companyname', 'CompanyName'),
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", 
                "l3": chain[3] or "N/A", 
                "l2": chain[2] or "N/A", 
                "l1": chain[1] or "N/A"
            })
        
        # Sắp xếp theo mã chứng khoán cho dễ nhìn
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# API lấy danh sách cổ phiếu gọn nhẹ để hiển thị trong Modal chọn của trang Nhóm công ty
@app.route('/api/get-stocks-for-assign', methods=['GET'])
def get_stocks_for_assign():
    err = check_db()
    if err: return err
    try:
        # Chỉ lấy ID, Mã CK và Tên để tối ưu tốc độ load
        res = supabase.table('stocks').select("id, stockcode, companyname").execute()
        
        # Format lại dữ liệu cho Frontend dễ đọc
        results = []
        for r in res.data:
            results.append({
                "id": get_val(r, 'id', 'Id'),
                "code": get_val(r, 'stockcode', 'StockCode'),
                "name": get_val(r, 'companyname', 'CompanyName')
            })
            
        # Sắp xếp theo mã chứng khoán A-Z
        results.sort(key=lambda x: x['code'] or "")
        return jsonify(results), 200
    except Exception as e:
        print(f"❌ Lỗi get_stocks_for_assign: {e}")
        return jsonify({"error": str(e)}), 500
# 1. API: Gỡ bỏ một cổ phiếu khỏi nhóm (Xóa gán sai)
@app.route('/api/remove-stock-from-group', methods=['DELETE'])
def remove_stock_from_group():
    err = check_db()
    if err: return err
    
    data = request.get_json(force=True)
    group_id = data.get('group_id')
    stock_id = data.get('stock_id')

    if not group_id or not stock_id:
        return jsonify({"error": "Thiếu thông tin Nhóm hoặc Cổ phiếu để xóa"}), 400

    try:
        # Xóa dòng tương ứng trong bảng trung gian
        res = supabase.table('stock_stockgroups') \
            .delete() \
            .eq('stockgroup_id', group_id) \
            .eq('stock_id', stock_id) \
            .execute()
        
        return jsonify({"message": "Đã gỡ cổ phiếu khỏi nhóm thành công!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 2. API: Cập nhật thông tin gán (Ví dụ sửa ghi chú cho việc gán đó)
@app.route('/api/update-stock-assign', methods=['PUT'])
def update_stock_assign():
    err = check_db()
    if err: return err
    
    data = request.get_json(force=True)
    group_id = data.get('group_id')
    stock_id = data.get('stock_id')
    new_note = data.get('note', '') # Thường dùng để sửa ghi chú lý do gán nhóm

    try:
        res = supabase.table('stock_stockgroups') \
            .update({"note": new_note}) \
            .eq('stockgroup_id', group_id) \
            .eq('stock_id', stock_id) \
            .execute()
            
        return jsonify({"message": "Cập nhật thông tin gán thành công!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/unassign-by-name', methods=['DELETE'])
def unassign_by_name():
    err = check_db()
    if err: return err
    
    data = request.get_json(force=True)
    stock_code = data.get('stock_code') # Ví dụ: 'VIC'
    group_name = data.get('group_name') # Ví dụ: 'Nhóm Masan'

    if not stock_code or not group_name:
        return jsonify({"error": "Thiếu Tên Mã CK hoặc Tên Nhóm"}), 400

    try:
        # 1. Tìm ID của Cổ phiếu từ Tên (Mã CK)
        res_s = supabase.table('stocks').select("id").eq('stockcode', stock_code.upper()).execute()
        if not res_s.data:
            return jsonify({"error": f"Không tìm thấy mã {stock_code}"}), 404
        s_id = res_s.data[0]['id']

        # 2. Tìm ID của Nhóm từ Tên Nhóm
        res_g = supabase.table('stockgroups').select("id").eq('groupname', group_name).execute()
        if not res_g.data:
            return jsonify({"error": f"Không tìm thấy nhóm {group_name}"}), 404
        g_id = res_g.data[0]['id']

        # 3. Thực hiện xóa dòng kết nối trong bảng trung gian
        supabase.table('stock_stockgroups') \
            .delete() \
            .eq('stockgroup_id', g_id) \
            .eq('stock_id', s_id) \
            .execute()
            
        return jsonify({
            "message": f"Đã gỡ thành công mã {stock_code} khỏi nhóm {group_name}!"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)
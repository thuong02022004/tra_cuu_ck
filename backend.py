import os

from flask import Flask, request, jsonify, render_template

from flask_cors import CORS

from supabase import create_client, Client

from dotenv import load_dotenv

import pandas as pd

from tqdm import tqdm

from pathlib import Path

# =========================================================
# KHỞI TẠO HỆ THỐNG & KẾT NỐI DATABASE
# =========================================================

# 1. Nạp cấu hình (Chỉ dùng cho máy Local, trên Render nó sẽ tự bỏ qua)
load_dotenv()

# 2. Cấu hình đường dẫn thư mục chuẩn
base_dir = os.path.dirname(os.path.abspath(__file__))
# Ép Flask tìm templates trong static/templates
template_dir = os.path.join(base_dir, 'static', 'templates')

app = Flask(__name__, template_folder=template_dir)
CORS(app)

# 3. Kết nối Supabase (Lấy từ Environment Variables của Render hoặc file .env)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Kiểm tra kết nối để tránh lỗi 500 không rõ nguyên nhân
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ LỖI: Thiếu cấu hình SUPABASE_URL hoặc SUPABASE_KEY!")
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Đã kết nối Supabase thành công!")
    except Exception as e:
        print(f"❌ Lỗi khi khởi tạo Supabase Client: {e}")
        supabase = None

# Kiểm tra file .env để Thượng dễ debug trong Logs của Render
print(f"🔍 Trạng thái URL: {'Đã nhận' if SUPABASE_URL else 'Trống'}")


def check_db():
    if supabase is None:
        return jsonify({"error": "Chưa kết nối được với Database. Vui lòng kiểm tra file .env"}), 500
    return None

# Mẹo nhỏ: Hàm lấy giá trị an toàn không phân biệt hoa/thường của cột trong Database
def get_val(row, *keys):
    if not row: 
        return None
    for k in keys:
        if k in row: 
            return row[k]
    return None


# =========================================================
# ROUTE GIAO DIỆN (FRONTEND VIEWS)
# =========================================================
@app.route('/')
@app.route('/index.html')
def index(): 
    return render_template('index.html')

@app.route('/icb.html')
@app.route('/quan-ly-icb.html') 
def manage_icb(): 
    return render_template('icb.html')

@app.route('/quan-ly-ck.html')
def manage_company(): 
    return render_template('quan-ly-ck.html')

@app.route('/nhomcongty.html')
def nhom_cong_ty(): 
    return render_template('nhomcongty.html')

@app.route('/tra-cuu.html')
def tra_cuu(): 
    return render_template('tra-cuu.html')

@app.route('/nhom-nghanh.html')
def nhom_nghanh(): 
    return render_template('nhom-nghanh.html')
# =========================================================
# 2. API: QUẢN LÝ NGÀNH (ICB LEVELS)
# =========================================================
@app.route('/api/get-icb', methods=['GET'])
def get_icb():
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('icb_levels').select("*").execute()
        data = res.data
        data.sort(key=lambda x: get_val(x, 'icb_code', 'ICB_Code') or "")
        code_map = {get_val(item, 'id', 'Id'): get_val(item, 'icb_code', 'ICB_Code') for item in data}
        
        results = []
        for r in data:
            p_id = get_val(r, 'parent_id', 'Parent_Id')
            results.append({
                "id": get_val(r, 'id', 'Id'),
                "code": get_val(r, 'icb_code', 'ICB_Code'),
                "level": get_val(r, 'level', 'Level'),
                "name_vi": get_val(r, 'name_vn', 'Name_VN'),
                "name_en": get_val(r, 'name_en', 'Name_EN'),
                "parent_id": p_id,
                "parent_code": code_map.get(p_id) if p_id else None,
                "description": get_val(r, 'description', 'Description')
            })
        return jsonify(results), 200
    except Exception as e:
        print(f"❌ Lỗi get_icb: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-parents/<int:level>', methods=['GET'])
def get_parents(level):
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('icb_levels').select("*").execute()
        parents = [{
            "id": get_val(r, 'id', 'Id'), 
            "code": get_val(r, 'icb_code', 'ICB_Code'), 
            "name": get_val(r, 'name_vn', 'Name_VN')
        } for r in res.data if str(get_val(r, 'level', 'Level')) == str(level)]
        return jsonify(parents), 200
    except Exception as e:
        print(f"❌ Lỗi get_parents: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-icb', methods=['POST'])
def add_icb():
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        clean_code = str(data['code']).strip().zfill(4)
        payload = {
            "level": int(data['level']), "icb_code": clean_code,
            "name_vn": data['name_vi'], "name_en": data.get('name_en'),
            "parent_id": data.get('parent_id'), "description": data.get('description')
        }
        supabase.table('icb_levels').insert(payload).execute()
        return jsonify({"message": "Thêm mới thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/update-icb/<int:id>', methods=['PUT'])
def update_icb(id):
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        clean_code = str(data['code']).strip().zfill(4)
        payload = {
            "level": int(data['level']), "icb_code": clean_code,
            "name_vn": data['name_vi'], "name_en": data.get('name_en'),
            "parent_id": data.get('parent_id'), "description": data.get('description'),
            "updateddate": "now()"
        }
        supabase.table('icb_levels').update(payload).eq("id", id).execute()
        return jsonify({"message": "Cập nhật thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-icb/<int:id>', methods=['DELETE'])
def delete_icb(id):
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('icb_levels').select("*").execute()
        children = [r for r in res.data if str(get_val(r, 'parent_id', 'Parent_Id')) == str(id)]
        if len(children) > 0:
            return jsonify({"error": "Không thể xóa vì ngành này đang là Cấp Cha!"}), 400
            
        supabase.table('icb_levels').delete().eq("id", id).execute()
        return jsonify({"message": "Đã xóa thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/import-icb-full', methods=['POST'])
def import_icb_full():
    err = check_db()
    if err: 
        return err
        
    if 'file' not in request.files: 
        return jsonify({"error": "Chưa chọn file"}), 400
        
    file = request.files['file']
    try:
        df = pd.read_csv(file, dtype=str) if file.filename.lower().endswith('.csv') else pd.read_excel(file, dtype=str)
        df = df.where(pd.notnull(df), None)
        df['Level'] = pd.to_numeric(df['Level'])
        df = df.sort_values(by='Level')

        existing = supabase.table('icb_levels').select("*").execute()
        code_to_id = {str(get_val(r, 'icb_code', 'ICB_Code')).strip(): get_val(r, 'id', 'Id') for r in existing.data}

        count_added = 0
        for _, row in tqdm(df.iterrows(), total=len(df), desc="Importing ICB"):
            raw_code = str(row['Ma_ICB']).strip().split('.')[0]
            level = int(row['Level'])
            clean_code = raw_code.zfill(3 if level == 1 else 4)

            if clean_code in code_to_id: 
                continue

            p_id = None
            if row.get('Parent_Ma_ICB'):
                p_code_raw = str(row['Parent_Ma_ICB']).strip().split('.')[0]
                if p_code_raw and p_code_raw.lower() != 'none':
                    clean_p_code = p_code_raw.zfill(3 if level == 2 else 4)
                    p_id = code_to_id.get(clean_p_code)

            res = supabase.table('icb_levels').insert({
                "level": level, "icb_code": clean_code, 
                "name_vn": str(row['Ten_ICB']).strip(), "parent_id": p_id
            }).execute()
            
            if res.data:
                code_to_id[clean_code] = get_val(res.data[0], 'id', 'Id')
                count_added += 1

        return jsonify({"status": "success", "message": f"Đã import thành công {count_added} danh mục!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500


# =========================================================
# 3. API: QUẢN LÝ CỔ PHIẾU (STOCKS)
# =========================================================
@app.route('/api/get-stocks', methods=['GET'])
def get_stocks():
    err = check_db()
    if err: 
        return err
        
    try:
        res_stocks = supabase.table('stocks').select("*").execute()
        res_icb = supabase.table('icb_levels').select("*").execute()
        icb_dict = {get_val(r, 'id', 'Id'): get_val(r, 'icb_code', 'ICB_Code') for r in res_icb.data}
        
        results = []
        for r in res_stocks.data:
            icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
            results.append({
                "id": get_val(r, 'id', 'Id'), 
                "stock_code": get_val(r, 'stockcode', 'StockCode'), 
                "company_name": get_val(r, 'companyname', 'CompanyName'),
                "exchange": get_val(r, 'exchange', 'Exchange'), 
                "icb_code": icb_dict.get(icb_id),
                "status": get_val(r, 'status', 'Status')
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: 
        print(f"❌ Lỗi get_stocks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-stock/<int:id>', methods=['GET'])
def get_stock_detail(id):
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('stocks').select("*").eq('id', id).execute()
        if not res.data: 
            return jsonify({"error": "Không tìm thấy"}), 404
            
        r = res.data[0]
        icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
        icb_res = supabase.table('icb_levels').select("*").eq('id', icb_id).execute() if icb_id else None
        icb_code = get_val(icb_res.data[0], 'icb_code', 'ICB_Code') if icb_res and icb_res.data else None

        return jsonify({
            "id": get_val(r, 'id', 'Id'), "stock_code": get_val(r, 'stockcode', 'StockCode'), 
            "company_name": get_val(r, 'companyname', 'CompanyName'), "exchange": get_val(r, 'exchange', 'Exchange'), 
            "icb_code": icb_code
        }), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-stock', methods=['POST'])
def add_stock():
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        raw_icb = str(data['icb_code']).strip().zfill(4)
        res_icb = supabase.table('icb_levels').select("*").execute()
        target_icb = next((r for r in res_icb.data if str(get_val(r, 'icb_code', 'ICB_Code')) == raw_icb), None)
        
        if not target_icb: 
            return jsonify({"error": f"Mã ICB {raw_icb} không tồn tại!"}), 400
        
        supabase.table('stocks').insert({
            "stockcode": data['stock_code'].upper(), "companyname": data['company_name'],
            "icb_level_id": get_val(target_icb, 'id', 'Id'), "exchange": data['exchange'], "status": "Active"
        }).execute()
        return jsonify({"message": "Thêm cổ phiếu thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/update-stock/<int:id>', methods=['PUT'])
def update_stock(id):
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        raw_icb = str(data['icb_code']).strip().zfill(4)
        res_icb = supabase.table('icb_levels').select("*").execute()
        target_icb = next((r for r in res_icb.data if str(get_val(r, 'icb_code', 'ICB_Code')) == raw_icb), None)
        
        if not target_icb: 
            return jsonify({"error": "Mã ICB không hợp lệ!"}), 400

        supabase.table('stocks').update({
            "stockcode": data['stock_code'].upper(), "companyname": data['company_name'],
            "icb_level_id": get_val(target_icb, 'id', 'Id'), "exchange": data['exchange'], "updateddate": "now()"
        }).eq("id", id).execute()
        return jsonify({"message": "Cập nhật thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-stock/<int:id>', methods=['DELETE'])
def delete_stock(id):
    err = check_db()
    if err: 
        return err
        
    try:
        supabase.table('stock_stockgroups').delete().eq('stock_id', id).execute()
        supabase.table('stocks').delete().eq('id', id).execute()
        return jsonify({"message": "Xóa thành công"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/import-stocks', methods=['POST'])
def import_stocks():
    err = check_db()
    if err: 
        return err
        
    if 'file' not in request.files: 
        return jsonify({"error": "Chưa chọn file"}), 400
        
    file = request.files['file']
    try:
        df = pd.read_csv(file, dtype=str) if file.filename.lower().endswith('.csv') else pd.read_excel(file, dtype=str)
        df = df.where(pd.notnull(df), None)

        res_icb = supabase.table('icb_levels').select("*").execute()
        icb_map = {str(get_val(r, 'icb_code', 'ICB_Code')).strip(): get_val(r, 'id', 'Id') for r in res_icb.data}

        existing_stocks = supabase.table('stocks').select("*").execute()
        stock_map = {get_val(r, 'stockcode', 'StockCode'): get_val(r, 'id', 'Id') for r in existing_stocks.data}

        success_count = 0
        for _, row in df.iterrows():
            try:
                stock_code = str(row['MÃ CHỨNG KHOÁN']).strip().upper()
                company_name = str(row['TÊN CÔNG TY']).strip()
                exchange = str(row['Sàn giao dịch']).strip()
                raw_icb = str(row['Ma_ICB_Level4']).strip().split('.')[0].zfill(4)
                
                icb_id = icb_map.get(raw_icb)
                if not icb_id: 
                    continue 

                payload = {
                    "stockcode": stock_code, "companyname": company_name, 
                    "icb_level_id": icb_id, "exchange": exchange
                }

                if stock_code in stock_map:
                    payload["updateddate"] = "now()"
                    supabase.table('stocks').update(payload).eq('id', stock_map[stock_code]).execute()
                else:
                    supabase.table('stocks').insert(payload).execute()
                success_count += 1
            except: 
                continue

        return jsonify({"message": f"Đã xử lý thành công {success_count} dòng."}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500


# =========================================================
# 4. API: QUẢN LÝ NHÓM CÔNG TY (STOCK GROUPS)
# =========================================================
@app.route('/api/get-stock-groups', methods=['GET'])
def get_stock_groups():
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('stockgroups').select("*").execute()
        data = res.data
        data.sort(key=lambda x: get_val(x, 'groupname', 'GroupName') or "")
        formatted = [{
            "Id": get_val(r, 'id', 'Id'), "GroupCode": get_val(r, 'groupcode', 'GroupCode'), 
            "GroupName": get_val(r, 'groupname', 'GroupName'), "GroupType": get_val(r, 'grouptype', 'GroupType'),
            "Description": get_val(r, 'description', 'Description'), "IsActive": get_val(r, 'isactive', 'IsActive')
        } for r in data]
        return jsonify(formatted), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-stock-group', methods=['POST'])
def add_stock_group():
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        supabase.table('stockgroups').insert({
            "groupcode": data.get('group_code'), "groupname": data.get('group_name'),
            "grouptype": data.get('group_type'), "description": data.get('description'),
            "isactive": data.get('is_active', 1)
        }).execute()
        return jsonify({"message": "Thêm nhóm thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/update-stock-group/<int:id>', methods=['PUT'])
def update_stock_group(id):
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        supabase.table('stockgroups').update({
            "groupcode": data.get('group_code'), "groupname": data.get('group_name'),
            "grouptype": data.get('group_type'), "description": data.get('description'),
            "isactive": data.get('is_active'), "updateddate": "now()"
        }).eq("id", id).execute()
        return jsonify({"message": "Cập nhật thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete-stock-group/<int:id>', methods=['DELETE'])
def delete_stock_group(id):
    err = check_db()
    if err: 
        return err
        
    try:
        supabase.table('stock_stockgroups').delete().eq('stockgroup_id', id).execute()
        supabase.table('stockgroups').delete().eq('id', id).execute()
        return jsonify({"message": "Xóa nhóm cổ phiếu thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500


# =========================================================
# 5. API: GÁN MÃ CHỨNG KHOÁN VÀO NHÓM (MANY-TO-MANY CRUD)
# =========================================================
@app.route('/api/get-stocks-for-assign', methods=['GET'])
def get_stocks_for_assign():
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('stocks').select("*").execute()
        data = [{"id": get_val(r, 'id', 'Id'), "code": get_val(r, 'stockcode', 'StockCode'), "name": get_val(r, 'companyname', 'CompanyName')} for r in res.data]
        data.sort(key=lambda x: x['code'] or "")
        return jsonify(data), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-stocks-to-group', methods=['POST'])
def add_stocks_to_group():
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    group_id = data.get('group_id')
    stock_ids = data.get('stock_ids')
    note = data.get('note', '')

    if not group_id or not stock_ids: 
        return jsonify({"error": "Thiếu thông tin Nhóm hoặc Cổ phiếu"}), 400

    try:
        existing = supabase.table('stock_stockgroups').select("*").eq('stockgroup_id', group_id).execute()
        existing_ids = {get_val(r, 'stock_id', 'Stock_Id') for r in existing.data}
        
        recs_to_insert = []
        for sid in stock_ids:
            if sid not in existing_ids:
                recs_to_insert.append({"stock_id": sid, "stockgroup_id": group_id, "note": note, "assigneddate": "now()"})
        
        if recs_to_insert:
            supabase.table('stock_stockgroups').insert(recs_to_insert).execute()
            
        return jsonify({"message": f"Đã gán thành công {len(recs_to_insert)} cổ phiếu vào nhóm!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-stocks-in-group/<int:group_id>', methods=['GET'])
def get_stocks_in_group(group_id):
    err = check_db()
    if err: 
        return err
        
    try:
        res_links = supabase.table('stock_stockgroups').select("*").eq('stockgroup_id', group_id).execute()
        res_stocks = supabase.table('stocks').select("*").execute()
        stock_map = {get_val(s, 'id', 'Id'): s for s in res_stocks.data}
        
        results = []
        for link in res_links.data:
            s_id = get_val(link, 'stock_id', 'Stock_Id')
            s_data = stock_map.get(s_id)
            if s_data:
                results.append({
                    "Id": s_id, "StockCode": get_val(s_data, 'stockcode', 'StockCode'),
                    "CompanyName": get_val(s_data, 'companyname', 'CompanyName'),
                    "Note": get_val(link, 'note', 'Note'), "AssignedDate": get_val(link, 'assigneddate', 'AssignedDate')
                })
        results.sort(key=lambda x: x['StockCode'] or "")
        return jsonify(results), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/update-stock-in-group/<int:group_id>/<int:stock_id>', methods=['PUT'])
def update_stock_in_group(group_id, stock_id):
    err = check_db()
    if err: 
        return err
        
    data = request.get_json(force=True)
    try:
        supabase.table('stock_stockgroups').update({"note": data.get('note', '')}) \
            .eq("stockgroup_id", group_id).eq("stock_id", stock_id).execute()
        return jsonify({"message": "Đã cập nhật ghi chú thành công!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/remove-stock-from-group/<int:group_id>/<int:stock_id>', methods=['DELETE'])
def remove_stock_from_group(group_id, stock_id):
    err = check_db()
    if err: 
        return err
        
    try:
        supabase.table('stock_stockgroups').delete() \
            .eq("stockgroup_id", group_id).eq("stock_id", stock_id).execute()
        return jsonify({"message": "Đã xóa cổ phiếu khỏi nhóm!"}), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500


# =========================================================
# 6. API: TRA CỨU & THỐNG KÊ (XỬ LÝ DỮ LIỆU ĐỆ QUY BẰNG PYTHON)
# =========================================================

def build_icb_hierarchy():
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

@app.route('/api/stats/level/<int:target_level>', methods=['GET'])
def get_level_stats(target_level):
    if target_level not in [1, 2, 3, 4]: 
        return jsonify({"error": "Level không hợp lệ"}), 400
        
    err = check_db()
    if err: 
        return err
        
    try:
        icb_map, get_chain = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        stats = {}
        for s in res_stocks.data:
            icb_id = get_val(s, 'icb_level_id', 'ICB_Level_Id')
            exch = get_val(s, 'exchange', 'Exchange') or "Khác"
            if not icb_id: 
                continue
            
            current = icb_map.get(icb_id)
            target_industry = None
            while current:
                lvl = int(get_val(current, 'level', 'Level'))
                if lvl == target_level:
                    target_industry = f"[{get_val(current, 'icb_code', 'ICB_Code')}] {get_val(current, 'name_vn', 'Name_VN')}"
                    break
                parent_id = get_val(current, 'parent_id', 'Parent_Id')
                current = icb_map.get(parent_id) if parent_id else None
                
            if target_industry:
                if target_industry not in stats: 
                    stats[target_industry] = {"total": 0, "exchanges": {}}
                if exch not in stats[target_industry]["exchanges"]: 
                    stats[target_industry]["exchanges"][exch] = 0
                stats[target_industry]["exchanges"][exch] += 1
                stats[target_industry]["total"] += 1
                
        return jsonify(stats), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-exchanges', methods=['GET'])
def get_exchanges():
    err = check_db()
    if err: 
        return err
        
    try:
        res = supabase.table('stocks').select("*").execute()
        exchanges = list(set(get_val(r, 'exchange', 'Exchange') for r in res.data if get_val(r, 'exchange', 'Exchange')))
        exchanges.sort()
        return jsonify(exchanges), 200
    except Exception as e: 
        print(f"❌ Lỗi get_exchanges: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stocks-by-exchange/<string:exchange_name>', methods=['GET'])
def get_stocks_by_exchange(exchange_name):
    err = check_db()
    if err: 
        return err
        
    try:
        res_stocks = supabase.table('stocks').select("*").eq('exchange', exchange_name).execute()
        res_icb = supabase.table('icb_levels').select("*").execute()
        icb_dict = {get_val(r, 'id', 'Id'): get_val(r, 'icb_code', 'ICB_Code') for r in res_icb.data}
        
        results = [{
            "id": get_val(r, 'id', 'Id'), "stock_code": get_val(r, 'stockcode', 'StockCode'), 
            "company_name": get_val(r, 'companyname', 'CompanyName'), "exchange": get_val(r, 'exchange', 'Exchange'), 
            "icb_code": icb_dict.get(get_val(r, 'icb_level_id', 'ICB_Level_Id'))
        } for r in res_stocks.data]
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-stocks-with-hierarchy', methods=['GET'])
def get_stocks_with_hierarchy():
    err = check_db()
    if err: 
        return err
        
    try:
        _, get_chain = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        results = []
        for s in res_stocks.data:
            chain = get_chain(get_val(s, 'icb_level_id', 'ICB_Level_Id'))
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'), "company_name": get_val(s, 'companyname', 'CompanyName'), 
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", "l3": chain[3] or "N/A", "l2": chain[2] or "N/A", "l1": chain[1] or "N/A"
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/lookup-stocks', methods=['GET'])
def lookup_stocks():
    err = check_db()
    if err: 
        return err
        
    try:
        _, get_chain = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        res_links = supabase.table('stock_stockgroups').select("*").execute()
        res_groups = supabase.table('stockgroups').select("*").execute()
        group_map = {get_val(g, 'id', 'Id'): get_val(g, 'groupname', 'GroupName') for g in res_groups.data}
        
        stock_to_groups = {}
        for link in res_links.data:
            s_id = get_val(link, 'stock_id', 'Stock_Id')
            g_id = get_val(link, 'stockgroup_id', 'StockGroup_Id')
            g_name = group_map.get(g_id)
            if s_id and g_name:
                if s_id not in stock_to_groups: 
                    stock_to_groups[s_id] = []
                stock_to_groups[s_id].append(g_name)
        
        results = []
        for s in res_stocks.data:
            chain = get_chain(get_val(s, 'icb_level_id', 'ICB_Level_Id'))
            s_id = get_val(s, 'id', 'Id')
            groups = stock_to_groups.get(s_id, [])
            user_groups_str = ", ".join(groups) if groups else "Chưa phân nhóm"
            
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'), "company_name": get_val(s, 'companyname', 'CompanyName'), 
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", "l3": chain[3] or "N/A", "l2": chain[2] or "N/A", "l1": chain[1] or "N/A",
                "user_groups": user_groups_str
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
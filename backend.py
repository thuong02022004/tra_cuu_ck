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
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        supabase = None

def check_db():
    if supabase is None:
        return jsonify({"error": "Chưa kết nối được với Database."}), 500
    return None

def get_val(row, *keys):
    """Lấy giá trị an toàn từ dict, hỗ trợ nhiều biến thể tên cột"""
    if not row: return None
    for k in keys:
        if k in row: return row[k]
    return None

# =========================================================
# 2. LOGIC MAPPING PHÂN CẤP (RECURSIVE HELPER)
# =========================================================

def build_icb_hierarchy():
    """Lấy dữ liệu ICB và tạo hàm tra cứu từ con lên cha"""
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
# 3. ROUTE GIAO DIỆN
# =========================================================

@app.route('/')
@app.route('/index.html')
def index(): return render_template('index.html')

@app.route('/tra-cuu.html')
def tra_cuu(): return render_template('tra-cuu.html')

@app.route('/quan-ly-ck.html')
def manage_company(): return render_template('quan-ly-ck.html')

@app.route('/nhom-nganh.html')
def nhom_nganh(): return render_template('nhom-nganh.html')

@app.route('/nhomcongty.html')
def nhom_cong_ty(): return render_template('nhomcongty.html')

@app.route('/icb.html')
def manage_icb(): return render_template('icb.html')

# =========================================================
# 4. API: QUẢN LÝ CỔ PHIẾU (STOCKS) KÈM MAPPING
# =========================================================

@app.route('/api/get-stocks', methods=['GET'])
def get_stocks():
    err = check_db()
    if err: return err
    try:
        res_stocks = supabase.table('stocks').select("*").execute()
        res_icb = supabase.table('icb_levels').select("id, icb_code").execute()
        icb_dict = {get_val(r, 'id', 'Id'): get_val(r, 'icb_code', 'ICB_Code') for r in res_icb.data}
        
        results = []
        for r in res_stocks.data:
            icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
            results.append({
                "id": get_val(r, 'id', 'Id'),
                "stock_code": get_val(r, 'stockcode', 'StockCode'),
                "company_name": get_val(r, 'companyname', 'CompanyName'),
                "exchange": get_val(r, 'exchange', 'Exchange'),
                "icb_code": icb_dict.get(icb_id) or "-",
                "status": get_val(r, 'status', 'Status')
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/get-stocks-with-hierarchy', methods=['GET'])
def get_stocks_with_hierarchy():
    err = check_db()
    if err: return err
    try:
        _, get_chain = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        results = []
        for s in res_stocks.data:
            chain = get_chain(get_val(s, 'icb_level_id', 'ICB_Level_Id'))
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'),
                "company_name": get_val(s, 'companyname', 'CompanyName'),
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", "l3": chain[3] or "N/A", "l2": chain[2] or "N/A", "l1": chain[1] or "N/A"
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/lookup-stocks', methods=['GET'])
def lookup_stocks():
    err = check_db()
    if err: return err
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
                if s_id not in stock_to_groups: stock_to_groups[s_id] = []
                stock_to_groups[s_id].append(g_name)
        
        results = []
        for s in res_stocks.data:
            s_id = get_val(s, 'id', 'Id')
            chain = get_chain(get_val(s, 'icb_level_id', 'ICB_Level_Id'))
            groups = stock_to_groups.get(s_id, [])
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'),
                "company_name": get_val(s, 'companyname', 'CompanyName'),
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": chain[4] or "N/A", "l3": chain[3] or "N/A", "l2": chain[2] or "N/A", "l1": chain[1] or "N/A",
                "user_groups": ", ".join(groups) if groups else "Chưa phân nhóm"
            })
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# =========================================================
# 5. API: THỐNG KÊ (STATS)
# =========================================================

@app.route('/api/stats/level/<int:target_level>', methods=['GET'])
def get_level_stats(target_level):
    err = check_db()
    if err: return err
    try:
        icb_map, _ = build_icb_hierarchy()
        res_stocks = supabase.table('stocks').select("*").execute()
        
        stats = {}
        for s in res_stocks.data:
            icb_id = get_val(s, 'icb_level_id', 'ICB_Level_Id')
            exch = get_val(s, 'exchange', 'Exchange') or "Khác"
            if not icb_id: continue
            
            # Đệ quy tìm đúng Level yêu cầu
            current = icb_map.get(icb_id)
            target_industry = None
            while current:
                if int(get_val(current, 'level', 'Level')) == target_level:
                    target_industry = f"[{get_val(current, 'icb_code', 'ICB_Code')}] {get_val(current, 'name_vn', 'Name_VN')}"
                    break
                p_id = get_val(current, 'parent_id', 'Parent_Id')
                current = icb_map.get(p_id) if p_id else None
                
            if target_industry:
                if target_industry not in stats: 
                    stats[target_industry] = {"total": 0, "exchanges": {}}
                if exch not in stats[target_industry]["exchanges"]: 
                    stats[target_industry]["exchanges"][exch] = 0
                stats[target_industry]["exchanges"][exch] += 1
                stats[target_industry]["total"] += 1
                
        return jsonify(stats), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# =========================================================
# 6. API: QUẢN LÝ NGÀNH (ICB) & IMPORT
# =========================================================

@app.route('/api/import-icb-full', methods=['POST'])
def import_icb_full():
    err = check_db()
    if err: return err
    if 'file' not in request.files: return jsonify({"error": "Chưa chọn file"}), 400
    file = request.files['file']
    try:
        df = pd.read_csv(file, dtype=str) if file.filename.lower().endswith('.csv') else pd.read_excel(file, dtype=str)
        df = df.where(pd.notnull(df), None)
        df['Level'] = pd.to_numeric(df['Level'])
        df = df.sort_values(by='Level')

        existing = supabase.table('icb_levels').select("id, icb_code").execute()
        existing_codes = {str(get_val(r, 'icb_code', 'ICB_Code')).strip() for r in existing.data}
        code_to_id = {str(get_val(r, 'icb_code', 'ICB_Code')).strip(): get_val(r, 'id', 'Id') for r in existing.data}

        added, skipped = 0, 0
        for _, row in df.iterrows():
            level = int(row['Level'])
            clean_code = str(row['Ma_ICB']).strip().split('.')[0].zfill(3 if level == 1 else 4)
            if clean_code in existing_codes:
                skipped += 1
                continue

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
        return jsonify({"message": f"Thành công! Thêm: {added}, Bỏ qua: {skipped}"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/import-stocks', methods=['POST'])
def import_stocks():
    err = check_db()
    if err: return err
    if 'file' not in request.files: return jsonify({"error": "Chưa chọn file"}), 400
    
    file = request.files['file']
    try:
        df = pd.read_excel(file, dtype=str) if file.filename.endswith(('.xlsx', '.xls')) else pd.read_csv(file, dtype=str)
        df = df.where(pd.notnull(df), None)

        # 1. Lấy bản đồ ICB để ánh xạ ID
        res_icb = supabase.table('icb_levels').select("id, icb_code").execute()
        icb_map = {str(get_val(r, 'icb_code', 'ICB_Code')).strip().zfill(4): get_val(r, 'id', 'Id') for r in res_icb.data}

        prepared_data = []
        for _, row in df.iterrows():
            s_code = str(row['MÃ CHỨNG KHOÁN']).strip().upper()
            raw_icb = str(row['Ma_ICB_Level4']).strip().split('.')[0].zfill(4)
            icb_id = icb_map.get(raw_icb)
            
            if icb_id and s_code:
                prepared_data.append({
                    "stockcode": s_code,
                    "companyname": str(row['TÊN CÔNG TY']).strip(),
                    "exchange": str(row['Sàn giao dịch']).strip(),
                    "icb_level_id": icb_id,
                    "status": "Active",
                    "updateddate": "now()" # Đánh dấu thời điểm cập nhật
                })

        if prepared_data:
            # SỬ DỤNG UPSERT: Nếu trùng 'stockcode', Supabase sẽ tự Update thay vì báo lỗi
            # 'on_conflict' chỉ định cột dùng để kiểm tra trùng lặp
            supabase.table('stocks').upsert(prepared_data, on_conflict="stockcode").execute()

        return jsonify({"message": f"Xử lý thành công {len(prepared_data)} mã chứng khoán."}), 200

    except Exception as e:
        # Trả về thông báo lỗi chi tiết cho Frontend hiển thị lên thanh Progress đỏ
        error_msg = str(e)
        if "duplicate key" in error_msg:
            error_msg = "Lỗi: Phát hiện mã chứng khoán trùng lặp không thể xử lý."
        return jsonify({"error": error_msg}), 500

# =========================================================
# 7. CÁC API KHÁC (GET, ADD, UPDATE, DELETE) - GIỮ NGUYÊN
# =========================================================

@app.route('/api/get-stock/<int:id>', methods=['GET'])
def get_stock_detail(id):
    try:
        res = supabase.table('stocks').select("*").eq('id', id).execute()
        if not res.data: return jsonify({"error": "Không tìm thấy"}), 404
        r = res.data[0]
        icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
        icb_res = supabase.table('icb_levels').select("icb_code").eq('id', icb_id).execute() if icb_id else None
        return jsonify({
            "id": get_val(r, 'id', 'Id'), "stock_code": get_val(r, 'stockcode', 'StockCode'), 
            "company_name": get_val(r, 'companyname', 'CompanyName'), "exchange": get_val(r, 'exchange', 'Exchange'), 
            "icb_code": get_val(icb_res.data[0], 'icb_code') if icb_res and icb_res.data else None
        }), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/add-stock', methods=['POST'])
def add_stock():
    data = request.get_json(force=True)
    try:
        raw_icb = str(data['icb_code']).strip().zfill(4)
        res_icb = supabase.table('icb_levels').select("id").eq('icb_code', raw_icb).execute()
        if not res_icb.data: return jsonify({"error": "Mã ICB không tồn tại"}), 400
        supabase.table('stocks').insert({
            "stockcode": data['stock_code'].upper(), "companyname": data['company_name'],
            "icb_level_id": res_icb.data[0]['id'], "exchange": data['exchange'], "status": "Active"
        }).execute()
        return jsonify({"message": "Thêm thành công!"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/update-stock/<int:id>', methods=['PUT'])
def update_stock(id):
    data = request.get_json(force=True)
    try:
        raw_icb = str(data['icb_code']).strip().zfill(4)
        res_icb = supabase.table('icb_levels').select("id").eq('icb_code', raw_icb).execute()
        if not res_icb.data: return jsonify({"error": "Mã ICB không hợp lệ"}), 400
        supabase.table('stocks').update({
            "stockcode": data['stock_code'].upper(), "companyname": data['company_name'],
            "icb_level_id": res_icb.data[0]['id'], "exchange": data['exchange']
        }).eq("id", id).execute()
        return jsonify({"message": "Cập nhật thành công!"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/delete-stock/<int:id>', methods=['DELETE'])
def delete_stock(id):
    try:
        supabase.table('stock_stockgroups').delete().eq('stock_id', id).execute()
        supabase.table('stocks').delete().eq('id', id).execute()
        return jsonify({"message": "Xóa thành công"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/get-exchanges', methods=['GET'])
def get_exchanges():
    try:
        res = supabase.table('stocks').select("exchange").execute()
        exchanges = list(set(get_val(r, 'exchange', 'Exchange') for r in res.data if get_val(r, 'exchange', 'Exchange')))
        exchanges.sort()
        return jsonify(exchanges), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
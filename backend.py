import os
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
from tqdm import tqdm

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
    print("❌ LỖI: Thiếu cấu hình SUPABASE_URL hoặc SUPABASE_KEY!")
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Đã kết nối Supabase thành công!")
    except Exception as e:
        print(f"❌ Lỗi kết nối Supabase: {e}")
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
# 2. ROUTE GIAO DIỆN (FRONTEND VIEWS)
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
# 3. API: QUẢN LÝ NGÀNH (ICB LEVELS)
# =========================================================

@app.route('/api/get-icb', methods=['GET'])
def get_icb():
    err = check_db()
    if err: return err
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
                "parent_id": p_id,
                "parent_code": code_map.get(p_id) if p_id else None
            })
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

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

        # Lấy dữ liệu hiện có để kiểm tra trùng
        existing = supabase.table('icb_levels').select("id, icb_code").execute()
        existing_codes = {str(get_val(r, 'icb_code', 'ICB_Code')).strip() for r in existing.data}
        code_to_id = {str(get_val(r, 'icb_code', 'ICB_Code')).strip(): get_val(r, 'id', 'Id') for r in existing.data}

        added, skipped = 0, 0
        for _, row in df.iterrows():
            raw_code = str(row['Ma_ICB']).strip().split('.')[0]
            level = int(row['Level'])
            clean_code = raw_code.zfill(3 if level == 1 else 4)

            # LOGIC: NẾU ĐÃ CÓ THÌ BỎ QUA
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

        return jsonify({"message": f"Import ICB xong! Thêm mới: {added}, Bỏ qua: {skipped}."}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# =========================================================
# 4. API: QUẢN LÝ CỔ PHIẾU (STOCKS)
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
                "icb_code": icb_dict.get(icb_id) or "-"
            })
        results.sort(key=lambda x: x['stock_code'] or "")
        return jsonify(results), 200
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

        res_icb = supabase.table('icb_levels').select("id, icb_code").execute()
        icb_map = {str(get_val(r, 'icb_code', 'ICB_Code')).strip().zfill(4): get_val(r, 'id', 'Id') for r in res_icb.data}

        existing = supabase.table('stocks').select("stockcode").execute()
        existing_codes = {str(get_val(r, 'stockcode', 'StockCode')).strip().upper() for r in existing.data}

        new_recs = []
        skip_count = 0

        for _, row in df.iterrows():
            s_code = str(row['MÃ CHỨNG KHOÁN']).strip().upper()
            
            # LOGIC: NẾU ĐÃ CÓ THÌ BỎ QUA
            if s_code in existing_codes:
                skip_count += 1
                continue
            
            raw_icb = str(row['Ma_ICB_Level4']).strip().split('.')[0].zfill(4)
            icb_id = icb_map.get(raw_icb)
            
            if icb_id:
                new_recs.append({
                    "stockcode": s_code,
                    "companyname": str(row['TÊN CÔNG TY']).strip(),
                    "exchange": str(row['Sàn giao dịch']).strip(),
                    "icb_level_id": icb_id,
                    "status": "Active"
                })

        if new_recs:
            supabase.table('stocks').insert(new_recs).execute()

        return jsonify({"message": f"Import Stocks xong! Thêm mới: {len(new_recs)}, Bỏ qua: {skip_count}."}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/get-stock/<int:id>', methods=['GET'])
def get_stock_detail(id):
    try:
        res = supabase.table('stocks').select("*").eq('id', id).execute()
        if not res.data: return jsonify({"error": "Không tìm thấy"}), 404
        r = res.data[0]
        icb_id = get_val(r, 'icb_level_id', 'ICB_Level_Id')
        icb_res = supabase.table('icb_levels').select("icb_code").eq('id', icb_id).execute() if icb_id else None
        icb_code = get_val(icb_res.data[0], 'icb_code', 'ICB_Code') if icb_res and icb_res.data else None
        return jsonify({
            "id": get_val(r, 'id', 'Id'), "stock_code": get_val(r, 'stockcode', 'StockCode'), 
            "company_name": get_val(r, 'companyname', 'CompanyName'), "exchange": get_val(r, 'exchange', 'Exchange'), 
            "icb_code": icb_code
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
            "icb_level_id": get_val(res_icb.data[0], 'id', 'Id'), "exchange": data['exchange'], "status": "Active"
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
            "icb_level_id": get_val(res_icb.data[0], 'id', 'Id'), "exchange": data['exchange']
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

# =========================================================
# 5. CÁC API PHỤ TRỢ (NHÓM, SÀN, TRA CỨU)
# =========================================================

@app.route('/api/get-exchanges', methods=['GET'])
def get_exchanges():
    try:
        res = supabase.table('stocks').select("exchange").execute()
        exchanges = list(set(get_val(r, 'exchange', 'Exchange') for r in res.data if get_val(r, 'exchange', 'Exchange')))
        exchanges.sort()
        return jsonify(exchanges), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/lookup-stocks', methods=['GET'])
def lookup_stocks():
    try:
        res_stocks = supabase.table('stocks').select("*").execute()
        res_icb = supabase.table('icb_levels').select("*").execute()
        icb_dict = {get_val(r, 'id', 'Id'): f"{get_val(r, 'icb_code', 'ICB_Code')} - {get_val(r, 'name_vn', 'Name_VN')}" for r in res_icb.data}
        
        results = []
        for s in res_stocks.data:
            icb_id = get_val(s, 'icb_level_id', 'ICB_Level_Id')
            results.append({
                "stock_code": get_val(s, 'stockcode', 'StockCode'),
                "company_name": get_val(s, 'companyname', 'CompanyName'),
                "exchange": get_val(s, 'exchange', 'Exchange'),
                "l4": icb_dict.get(icb_id) or "N/A"
            })
        return jsonify(results), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

# Giữ nguyên các API về Stock Groups (Nhóm công ty) của bạn
@app.route('/api/get-stock-groups', methods=['GET'])
def get_stock_groups():
    try:
        res = supabase.table('stockgroups').select("*").execute()
        return jsonify([{
            "Id": get_val(r, 'id', 'Id'), "GroupName": get_val(r, 'groupname', 'GroupName'),
            "Description": get_val(r, 'description', 'Description')
        } for r in res.data]), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
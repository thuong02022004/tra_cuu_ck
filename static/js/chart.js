let icbChart = null; // Biểu đồ Cột: Số lượng công ty theo ngành
let exchangeChart = null; // Biểu đồ Tròn: Phân bổ theo sàn của các công ty đó

/**
 * Khởi tạo sự kiện và vẽ biểu đồ lần đầu
 */
async function initStatistics() {
    const levelSelect = document.getElementById('stat-level-select');
    if (!levelSelect) return;

    // Lắng nghe sự kiện thay đổi Level từ người dùng
    levelSelect.addEventListener('change', () => {
        renderLevelStatistics(levelSelect.value);
    });

    // Vẽ lần đầu mặc định Cấp 1 khi vừa load trang
    renderLevelStatistics(1);
}

/**
 * Hàm gọi API thống kê đệ quy từ Backend và xử lý dữ liệu cho Chart.js
 * @param {number} level - Cấp độ ICB cần thống kê (1, 2, 3, hoặc 4)
 */
async function renderLevelStatistics(level) {
    try {
        // 1. Gọi API thống kê truy xuất ngược (Recursive) đã viết ở Backend
        // API này trả về cấu trúc: { "Tên ngành": { "total": X, "exchanges": { "HOSE": Y, ... } } }
        // SỬA TẠI ĐÂY: Thay http://127.0.0.1:5000 bằng đường dẫn tương đối /api
        const res = await fetch(`/api/stats/level/${level}`);
        const data = await res.json();

        // 2. Chuẩn bị dữ liệu cho Biểu đồ Ngành (Bên trái)
        const industryLabels = Object.keys(data); // Danh sách tên các ngành
        const companyCounts = industryLabels.map(key => data[key].total); // Tổng số công ty mỗi ngành

        drawIndustryBarChart(industryLabels, companyCounts, level);

        // 3. Chuẩn bị dữ liệu cho Biểu đồ Sàn (Bên phải)
        // Gom tổng số lượng công ty theo từng sàn từ tất cả các ngành trong Level đó
        const exchangeSummary = {};
        industryLabels.forEach(ind => {
            const exchs = data[ind].exchanges;
            for (let s in exchs) {
                exchangeSummary[s] = (exchangeSummary[s] || 0) + exchs[s];
            }
        });

        const exchangeLabels = Object.keys(exchangeSummary);
        const exchangeValues = Object.values(exchangeSummary);

        drawExchangePieChart(exchangeLabels, exchangeValues);

    } catch (err) {
        console.error("Lỗi khi tải dữ liệu thống kê:", err);
    }
}

/**
 * Hàm vẽ biểu đồ Cột hiển thị số lượng công ty theo ngành
 */
function drawIndustryBarChart(labels, values, level) {
    const ctx = document.getElementById('icbChart').getContext('2d');
    if (icbChart) icbChart.destroy(); // Hủy biểu đồ cũ trước khi vẽ mới để tránh lỗi đè dữ liệu

    icbChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số lượng công ty',
                data: values,
                backgroundColor: '#1e3a8a', // Màu Navy đồng bộ hệ thống
                borderRadius: 6,
                borderWidth: 0,
                barThickness: 30 // Độ rộng cột cố định để giao diện cân đối
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Số lượng Công ty theo Ngành (Level ${level})`,
                    font: { size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 } // Đảm bảo trục Y hiển thị số nguyên
                },
                x: {
                    ticks: {
                        callback: function(val, index) {
                            const label = this.getLabelForValue(val);
                            // Cắt bớt tên ngành nếu quá dài để tránh vỡ giao diện
                            return label.length > 15 ? label.substr(0, 15) + '...' : label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Hàm vẽ biểu đồ Doughnut hiển thị phân bổ theo sàn giao dịch
 */
function drawExchangePieChart(labels, values) {
    const ctx = document.getElementById('exchangeChart').getContext('2d');
    if (exchangeChart) exchangeChart.destroy();

    exchangeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#1e3a8a', // Navy (HOSE)
                    '#10b981', // Emerald (HNX)
                    '#f59e0b', // Amber (UPCOM)
                    '#ef4444', // Red (OTC)
                    '#6366f1'  // Indigo
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', // Tạo lỗ hổng giữa để thành biểu đồ Doughnut hiện đại
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                title: {
                    display: true,
                    text: 'Cơ cấu Sàn Giao Dịch',
                    font: { size: 14, weight: 'bold' }
                }
            }
        }
    });
}

// Chờ HTML load xong hoàn toàn mới thực thi code
document.addEventListener('DOMContentLoaded', initStatistics);
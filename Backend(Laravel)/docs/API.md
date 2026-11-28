# API nội bộ – Nông trại lành

Base URL mặc định: `http://localhost:8000/api`. Các API cần đăng nhập nhận JWT qua header `Authorization: Bearer <token>`. Request/response JSON dùng UTF-8.

## Phân quyền

| Vai trò | Quyền chính |
|---|---|
| Customer | Giỏ hàng, đặt hàng, xem đơn của mình, đăng ký gói |
| Staff | CRUD lô hàng, nhật ký canh tác, ghi hao hụt |
| Sales | Xem lô hàng/cảnh báo, xem và cập nhật đơn |
| Admin | Quản trị hệ thống và thao tác khu vực nông trại |

## Xác thực và sản phẩm

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Không | Đăng ký Customer (`ho_ten`, `email`, `mat_khau`, `mat_khau_confirmation`) |
| POST | `/auth/login` | Không | Đăng nhập (`email`, `mat_khau`), trả JWT |
| GET | `/auth/me` | JWT | Tài khoản hiện tại |
| POST | `/auth/logout` | JWT | Thu hồi JWT hiện tại |
| GET | `/products` | Không | Danh sách sản phẩm còn lô hợp lệ |
| GET | `/products/{product}` | Không | Chi tiết sản phẩm và lô còn hạn |
| GET | `/trace/{qr}` | Không | Nhật ký truy xuất lô |

## CRUD lô hàng (Staff/Admin)

| Method | Route | Mô tả |
|---|---|---|
| GET | `/farm/batches` | Danh sách lô, phân trang |
| POST | `/farm/batches` | Tạo lô: `ma_san_pham`, `ngay_thu_hoach`, `ngay_het_han`, `so_luong_nhap`; sinh mã truy xuất |
| PUT | `/farm/batches/{batch}` | Cập nhật `ngay_thu_hoach`, `ngay_het_han`; hạn phải từ ngày thu hoạch trở đi |
| DELETE | `/farm/batches/{batch}` | Chỉ xóa lô tồn bằng 0 và chưa có nhật ký/hao hụt/đơn hàng; nếu không trả `409` |
| GET | `/farm/batches/{batch}/qr` | Tạo ảnh QR SVG trỏ đến `/api/trace/{ma_qr}` |
| POST | `/farm/batches/{batch}/logs` | Thêm nhật ký canh tác; multipart có thể gửi `evidence[]` |
| POST | `/farm/batches/{batch}/losses` | Ghi hao hụt; `so_luong`, `ly_do`, tùy chọn ảnh `evidence[]` |
| GET | `/farm/losses` | Lịch sử hao hụt (Staff/Admin) |

## Giỏ hàng và đơn hàng

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| GET | `/cart` | JWT | Xem giỏ của tài khoản |
| PUT | `/cart` | JWT | Đồng bộ giỏ (`items: [{ma_san_pham, so_luong}]`) |
| DELETE | `/cart` | JWT | Xóa giỏ |
| GET | `/orders` | JWT | Customer xem đơn của mình; Sales/Admin xem danh sách |
| POST | `/orders` | Customer | Tạo đơn (`dia_chi_giao_hang`, `shipping_destination`, `phuong_thuc_thanh_toan`, `shipping_quote_token`, `items`) và phân bổ lô FEFO |
| GET | `/orders/{order}` | JWT | Chi tiết đơn (chủ đơn hoặc Sales/Admin) |
| PATCH | `/orders/{order}/status` | Sales/Admin | Cập nhật trạng thái đơn |

FEFO chỉ lấy lô có `so_luong_ton > 0`, `ngay_het_han >= hôm nay`, sắp xếp theo hạn gần nhất rồi mã lô. Hệ thống khóa tồn trong transaction, trừ dần qua nhiều lô và ghi từng lô vào `ChiTietDonHang`. Nếu không đủ tồn còn hạn, trả `422` và rollback toàn bộ đơn.

Ví dụ tạo đơn:

```json
{
  "dia_chi_giao_hang": "12 Nguyễn Huệ, Quận 1",
  "shipping_destination": {
    "province": "Thành phố Hồ Chí Minh",
    "district": "Quận 1",
    "ward": "Phường Bến Nghé",
    "address": "12 Nguyễn Huệ"
  },
  "phuong_thuc_thanh_toan": "cod",
  "shipping_quote_token": "<quote_token returned by /shipping/quote>",
  "items": [{ "ma_san_pham": 2, "so_luong": 10 }]
}
```

Khi chọn `vnpay`, API trả thêm `payment_url` để trình duyệt chuyển sang cổng thanh toán. Callback IPN `GET /payments/vnpay/ipn` xác minh chữ ký, tiền tệ và số tiền; thành công cập nhật thanh toán/đơn, thất bại hủy đơn và hoàn tồn đã giữ. IPN xử lý lặp an toàn, không hoàn tồn hai lần khi VNPay gửi lại callback. Hai callback phải truy cập được từ phía VNPay; khi chạy local cần dùng URL công khai HTTPS (tunnel), khai báo đúng URL IPN trên cấu hình merchant sandbox và trong `.env`. Hướng dẫn cụ thể: [`VNPAY_SANDBOX.md`](VNPAY_SANDBOX.md). Không bật `VNPAY_ENABLED` nếu chưa có sandbox TMN Code và Hash Secret.

Tính phí giao hàng: ứng dụng tự xin tọa độ thiết bị khi mở trang; trình duyệt cần được cấp quyền vị trí và phải chạy trên `localhost` hoặc HTTPS. `POST /shipping/quote` nhận `destination`, tọa độ `origin` vừa lấy và `items`. Ở chế độ demo mặc định (`GHTK_DEMO_MODE=true`), backend tra địa chỉ nhận bằng Nominatim/OpenStreetMap, tính khoảng cách đường thẳng Haversine, rồi tính phí minh họa `ceil(km) * DEMO_SHIPPING_RATE_PER_KM` (mặc định 5.000 ₫/km); không cần token GHTK, không phát sinh phí thật. Địa chỉ đã tra được cache 7 ngày và các truy vấn Nominatim được giãn cách. Khi muốn gọi GHTK thật, đặt `GHTK_DEMO_MODE=false`, cấu hình `GHTK_API_TOKEN`, địa chỉ lấy hàng và (nếu được cấp) `GHTK_PARTNER_CODE`; khi đó backend tự tính khối lượng (giỏ hàng dùng kg, GHTK nhận gram) và giá trị hàng từ CSDL trước khi gọi `GET /services/shipment/fee`. API trả `quote_token` được mã hóa, ràng buộc tài khoản/địa chỉ/giỏ hàng và hết hạn sau 15 phút; gửi token đó cùng `shipping_destination` trong `POST /orders` để xác minh phí. Địa chỉ được tra qua [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) và cần hiển thị ghi công [OpenStreetMap](https://www.openstreetmap.org/copyright).

Khi JWT hết hạn, API trả `401`; giao diện xóa phiên đăng nhập, đưa khách về hộp đăng nhập và hiện thông báo. Ảnh khiếu nại chỉ nhận JPG/JPEG/PNG dưới 5 MB, được kiểm tra ở trình duyệt và kiểm tra lại ở server.

## Các route khác

| Method | Route | Auth | Mô tả |
|---|---|---|---|
| GET | `/plans` | Không | Danh sách gói định kỳ |
| POST | `/shipping/quote` | Customer | Demo: tính khoảng cách từ `origin` (latitude, longitude) đến địa chỉ trong `destination`, phí theo km; body cũng gồm `items` |
| GET | `/payments/vnpay/return` | VNPay/browser | Xác minh kết quả trả về rồi chuyển lại frontend |
| GET | `/payments/vnpay/ipn` | VNPay server | Xác minh chữ ký IPN và cập nhật thanh toán |
| POST/GET | `/subscriptions` | Customer | Tạo/xem đăng ký gói |
| GET/PATCH | `/complaints`, `/complaints/{complaint}` | Sales/Admin | Xem và xử lý khiếu nại |
| GET/POST/PUT/DELETE | `/admin/categories...` | Admin | CRUD danh mục |
| GET/POST/PUT/DELETE | `/admin/products...` | Admin | CRUD sản phẩm; không xóa sản phẩm đã có lô |
| GET/POST/PUT/DELETE/PATCH | `/admin/users...` | Admin | Xem, thêm, sửa, xóa nhân viên; đổi vai trò |
| GET | `/admin/overview`, `/admin/reports`, `/admin/settings` | Admin | Tổng quan, báo cáo, cấu hình |

## Lỗi API

Lỗi trả JSON theo dạng `{"status":"error","message":"..."}`. Lỗi validation có thêm `errors` theo trường. Mã thường gặp: `401` chưa đăng nhập, `403` không đủ quyền, `404` không tìm thấy, `409` xung đột nghiệp vụ, `422` dữ liệu/tồn kho không hợp lệ, `500` lỗi hệ thống.

## Dữ liệu thử FEFO

Chạy `php artisan db:seed` trong thư mục Backend để thêm dữ liệu mẫu idempotent. Seeder tạo các lô cà chua: còn hạn, sắp hết hạn, quá hạn, tồn kho bằng 0 và lô hạn xa hơn. Đăng nhập bằng Customer để gọi API đặt hàng; lô hết hạn và tồn bằng 0 sẽ bị bỏ qua.

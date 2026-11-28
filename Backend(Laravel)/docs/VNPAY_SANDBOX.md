# Chạy thanh toán VNPay Sandbox

## Chuẩn bị thông tin kết nối

Đăng ký/kích hoạt kết nối merchant trên môi trường Sandbox của VNPay. Cần lấy `vnp_TmnCode` và `vnp_HashSecret` do VNPay cấp; không tự tạo hai giá trị này và không commit chúng vào Git.

Tài liệu Sandbox chính thức: <https://sandbox.vnpayment.vn/apis/docs/gioi-thieu/>.

## Cấu hình Backend

Mở `Backend(Laravel)/.env` và cập nhật:

```dotenv
VNPAY_ENABLED=true
VNPAY_TMN_CODE=<TMN_CODE_VNPAY_CAP>
VNPAY_HASH_SECRET=<HASH_SECRET_VNPAY_CAP>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://<URL_TUNNEL_BACKEND>/api/payments/vnpay/return
VNPAY_IPN_URL=https://<URL_TUNNEL_BACKEND>/api/payments/vnpay/ipn
VNPAY_FRONTEND_URL=http://localhost:5173
```

`localhost` không truy cập được từ máy chủ VNPay. Khi chạy local, chỉ mở công khai hai callback qua proxy giới hạn trong `scripts/vnpay-callback-proxy.mjs`; không tunnel thẳng cổng Laravel `8000`. Chạy proxy bằng `node scripts/vnpay-callback-proxy.mjs`, rồi mở HTTPS tunnel vào cổng `8010`. Proxy chỉ cho phép GET tới `/api/payments/vnpay/return` và `/api/payments/vnpay/ipn`; mọi đường dẫn khác bị từ chối. Thay `<URL_TUNNEL_BACKEND>` bằng hostname tunnel. Cấu hình URL IPN tương ứng trong trang quản lý merchant Sandbox; cấu hình `.env` chỉ giúp ứng dụng biết URL để kiểm tra cấu hình.

Sau khi sửa `.env`, chạy `php artisan config:clear` trong thư mục `Backend(Laravel)` rồi khởi động lại Laravel. Giữ giao diện chạy tại `http://localhost:5173` để trình duyệt sau giao dịch quay lại đúng máy.

## Thử luồng thanh toán

1. Đăng nhập bằng tài khoản Customer, thêm hàng vào giỏ và tính phí vận chuyển.
2. Khi checkout, chọn **VNPay**. Ứng dụng tạo đơn, giữ tồn kho FEFO và chuyển trình duyệt sang Sandbox.
3. Dùng thẻ thử nghiệm NCB do tài liệu VNPay công bố:
   - Số thẻ: `9704198526191432198`
   - Tên chủ thẻ: `NGUYEN VAN A`
   - Ngày phát hành: `07/15`
   - OTP: `123456`
4. Sau khi thanh toán, VNPay gọi URL Return để đưa trình duyệt về frontend và URL IPN để cập nhật trạng thái ở Backend. Kiểm tra đơn chuyển sang đã xác nhận và thanh toán chuyển sang `paid`.

Thẻ trên chỉ dùng ở Sandbox, không dùng cho giao dịch thật. Danh sách thẻ và OTP có thể thay đổi; xác nhận theo tài liệu Sandbox hiện hành của VNPay.

## Luồng kho và xử lý gọi lại

Đơn VNPay giữ tồn kho FEFO ngay lúc tạo đơn để tránh bán vượt tồn trong lúc khách đang thanh toán. IPN thành công đánh dấu thanh toán đã trả và xác nhận đơn; IPN thất bại hủy đơn và trả lại tồn kho. Callback lặp được xác nhận thành công mà không áp dụng lại thao tác trừ/hoàn kho.

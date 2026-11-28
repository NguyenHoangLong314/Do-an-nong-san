# Website nông sản sạch

Website thương mại điện tử nông sản với React ở frontend, Laravel ở backend API và MySQL làm cơ sở dữ liệu.

## Cấu trúc

- `Backend(Laravel)/` — Laravel API, migrations theo ERD, JWT và phân quyền vai trò.
- `Frontend(React.js)/` — React responsive theo nguyên tắc mobile-first.

Tài khoản Admin có khu vực quản trị riêng để quản lý danh mục, sản phẩm, đơn hàng, nhân sự và phân quyền, xem báo cáo, cấu hình cảnh báo lô gần hết hạn.

## Chạy backend

### Database MySQL local (XAMPP)

1. Mở XAMPP Control Panel và bật `MySQL` (bật `Apache` nếu muốn dùng phpMyAdmin).
2. Mở `http://localhost/phpmyadmin` và tạo database tên `nong_san` với collation `utf8mb4_unicode_ci`.
3. Cấu hình `Backend(Laravel)/.env` theo thông tin MySQL local (`DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_DATABASE=nong_san`, `DB_USERNAME=root`). Nếu tài khoản MySQL có mật khẩu, điền vào `DB_PASSWORD`.

```sh
cd "Backend(Laravel)"
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
npm run dev
```

Mở terminal khác trong `Backend(Laravel)` và chạy `php artisan serve`.

## Chạy frontend

```sh
cd "Frontend(React.js)"
npm install
cp .env.example .env.local
npm run dev
```

Frontend mặc định gọi `http://localhost:8000/api`; có thể đổi bằng `VITE_API_BASE_URL`.

Đăng ký mới chỉ tạo tài khoản Customer. Vai trò Staff, Sales và Admin cần được cấp bởi người quản trị; frontend không có chức năng tự nâng quyền.

# Đồ án nông sản

Repository khởi tạo cho dự án thương mại điện tử nông sản.

## Cấu trúc

- `Backend(Laravel)/` — ứng dụng Laravel, giao diện Blade, CSS và Vite.
- `Frontend(React.js)/` — ứng dụng React + Vite được khởi tạo riêng.

## Backend Laravel

Mã nguồn Blade dùng layout chung tại `resources/views/layouts/app.blade.php`, các component dùng chung trong `resources/views/components/`, và trang mẫu tại `resources/views/home.blade.php`. CSS giao diện được viết trong `resources/css/app.css`.

```sh
cd "Backend(Laravel)"
composer install
npm install
cp .env.example .env
php artisan key:generate
npm run dev
```

Mở một terminal khác để chạy máy chủ ứng dụng:

```sh
php artisan serve
```

Trang hiện tại chỉ là boilerplate giao diện, chưa triển khai chức năng nghiệp vụ.

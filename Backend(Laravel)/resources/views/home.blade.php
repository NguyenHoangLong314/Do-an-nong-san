@extends('layouts.app')

@section('title', 'Nông Trại Xanh | Bộ khung dự án')

@section('content')
    <section class="hero" id="gioi-thieu">
        <div class="container hero-grid">
            <div class="hero-copy">
                <p class="eyebrow"><span class="eyebrow-dot"></span> NÔNG SẢN MINH BẠCH · TỪ NÔNG TRẠI</p>
                <h1>Tươi lành từ đất,<br><span>trọn vẹn đến nhà.</span></h1>
                <p class="hero-description">Một bộ khung giao diện khởi đầu cho hành trình kết nối nông trại với những bữa ăn tử tế mỗi ngày.</p>
                <div class="hero-actions">
                    <x-ui.button href="#khung-du-an">Khám phá dự án <span aria-hidden="true">↗</span></x-ui.button>
                    <x-ui.button href="mailto:hello@nongtraixanh.vn" variant="secondary">Tìm hiểu thêm</x-ui.button>
                </div>
                <div class="hero-note"><span aria-hidden="true">✳</span> Trồng có tâm · Giao có nguồn gốc</div>
            </div>
            <div class="hero-art" aria-label="Minh họa nông sản tươi">
                <div class="art-sun"></div>
                <div class="art-label">TỪ VƯỜN<br>ĐẾN BÀN ĂN</div>
                <div class="produce produce--tomato" aria-hidden="true">🍅</div>
                <div class="produce produce--leaf" aria-hidden="true">🥬</div>
                <div class="produce produce--carrot" aria-hidden="true">🥕</div>
                <div class="art-caption"><span class="caption-line"></span><span>Nuôi dưỡng điều lành</span></div>
            </div>
        </div>
    </section>

    <section class="foundation" id="khung-du-an">
        <div class="container foundation-inner">
            <div>
                <p class="eyebrow">BỘ KHUNG DỰ ÁN</p>
                <h2>Sẵn sàng để nhóm<br>bắt đầu phát triển.</h2>
            </div>
            <p class="foundation-copy">Dự án Laravel đã có cấu trúc cơ bản, layout Blade dùng chung và các component giao diện để tái sử dụng. Trang này là nội dung mẫu, chưa kết nối chức năng nghiệp vụ.</p>
            <div class="foundation-tags" aria-label="Công nghệ">
                <span>Laravel</span><span>Blade</span><span>Vite</span><span>CSS</span>
            </div>
        </div>
    </section>
@endsection

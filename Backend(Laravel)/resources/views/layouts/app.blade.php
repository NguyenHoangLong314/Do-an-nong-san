<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f7f8f2">
    <title>@yield('title', config('app.name', 'Nông Trại Xanh'))</title>
    <meta name="description" content="Nền tảng nông sản minh bạch từ nông trại đến bàn ăn.">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <x-layout.header />
    <main id="main-content">
        @yield('content')
    </main>
    <x-layout.footer />
</body>
</html>

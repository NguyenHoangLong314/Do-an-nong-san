@props(['href' => null, 'variant' => 'primary', 'type' => 'button'])

@if ($href)
    <a href="{{ $href }}" {{ $attributes->class(['button', 'button--primary' => $variant === 'primary', 'button--secondary' => $variant === 'secondary']) }}>
        {{ $slot }}
    </a>
@else
    <button type="{{ $type }}" {{ $attributes->class(['button', 'button--primary' => $variant === 'primary', 'button--secondary' => $variant === 'secondary']) }}>
        {{ $slot }}
    </button>
@endif

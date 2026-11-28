<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoHang;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class QrController extends Controller
{
    public function show(LoHang $batch)
    {
        $url = rtrim((string) config('services.frontend_url'), '/')
            .'/trace/'.rawurlencode((string) $batch->ma_qr);
        // Larger modules and a generous quiet zone make the code easier to scan
        // from a monitor or a printed label.
        $renderer = new ImageRenderer(new RendererStyle(480, 28), new SvgImageBackEnd());
        $svg = (new Writer($renderer))->writeString($url);

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }
}

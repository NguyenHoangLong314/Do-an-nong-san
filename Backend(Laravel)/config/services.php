<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'ghtk' => [
        'demo_mode' => (bool) env('GHTK_DEMO_MODE', true),
        'demo_rate_per_km' => (int) env('DEMO_SHIPPING_RATE_PER_KM', 5000),
        'base_url' => env('GHTK_BASE_URL', 'https://services.giaohangtietkiem.vn'),
        'token' => env('GHTK_API_TOKEN'),
        'partner_code' => env('GHTK_PARTNER_CODE'),
        'pick_province' => env('GHTK_PICK_PROVINCE'),
        'pick_district' => env('GHTK_PICK_DISTRICT'),
        'pick_ward' => env('GHTK_PICK_WARD'),
        'pick_address' => env('GHTK_PICK_ADDRESS'),
    ],

    'vnpay' => [
        'enabled' => (bool) env('VNPAY_ENABLED', false),
        'tmn_code' => env('VNPAY_TMN_CODE'),
        'hash_secret' => env('VNPAY_HASH_SECRET'),
        'url' => env('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
        'return_url' => env('VNPAY_RETURN_URL'),
        'ipn_url' => env('VNPAY_IPN_URL'),
        'frontend_url' => env('VNPAY_FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:5173')),
    ],

];

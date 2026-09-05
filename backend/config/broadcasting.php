<?php

return [

    // Default Broadcaster

    'default' => env('BROADCAST_CONNECTION', 'reverb'),

    // Broadcast Connections

    'connections' => [

        'reverb' => [
            'driver' => 'reverb',
            'app_key' => env('REVERB_APP_KEY'),
            'app_secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            'host' => env('REVERB_HOST', 'localhost'),
            'port' => env('REVERB_PORT', 8080),
            'scheme' => env('REVERB_SCHEME', 'http'),
            'use_tls' => env('REVERB_SCHEME', 'http') === 'https',
        ],

        'log' => [
            'driver' => 'log',
        ],

    ],

];

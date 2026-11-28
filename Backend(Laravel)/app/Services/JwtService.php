<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class JwtService
{
    public function issue(User $user): string
    {
        $now = time();
        $header = $this->encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256'], JSON_THROW_ON_ERROR));
        $payload = $this->encode(json_encode([
            'sub' => $user->getKey(), 'role' => $user->vai_tro, 'iat' => $now,
            'exp' => $now + (int) config('jwt.ttl', 86400), 'jti' => (string) Str::uuid(),
        ], JSON_THROW_ON_ERROR));
        $message = $header.'.'.$payload;
        return $message.'.'.$this->encode(hash_hmac('sha256', $message, $this->secret(), true));
    }

    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $payload, $signature] = $parts;
        try {
            $headerData = json_decode($this->decode($header), true, flags: JSON_THROW_ON_ERROR);
            $claims = json_decode($this->decode($payload), true, flags: JSON_THROW_ON_ERROR);
            $providedSignature = $this->decode($signature);
        } catch (\Throwable) {
            return null;
        }
        if (($headerData['alg'] ?? null) !== 'HS256' || !is_array($claims)) return null;
        $expected = hash_hmac('sha256', $header.'.'.$payload, $this->secret(), true);
        if (!is_string($providedSignature) || !hash_equals($expected, $providedSignature) || !isset($claims['sub'], $claims['exp']) || (int) $claims['exp'] <= time()) return null;
        if (!empty($claims['jti']) && Cache::has('jwt.revoked.'.$claims['jti'])) return null;
        return $claims;
    }

    public function revoke(string $token): void
    {
        $claims = $this->verify($token);
        if ($claims && !empty($claims['jti'])) {
            Cache::put('jwt.revoked.'.$claims['jti'], true, max(1, (int) $claims['exp'] - time()));
        }
    }

    private function secret(): string
    {
        $secret = config('jwt.secret') ?: config('app.key');
        return str_starts_with($secret, 'base64:') ? (base64_decode(substr($secret, 7), true) ?: '') : $secret;
    }

    private function encode(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
    private function decode(string $value): string|false
    {
        return base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    }
}

<?php
/**
 * VonCMS - Contact Honeypot Helper
 * Issues and validates session-bound dynamic contact-form challenges.
 */

$contactHoneypotHelperPath = realpath(__FILE__);
$requestedScriptPath = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? ''));
if ($contactHoneypotHelperPath !== false && $requestedScriptPath === $contactHoneypotHelperPath) {
  http_response_code(403);
  exit('Forbidden');
}
unset($contactHoneypotHelperPath, $requestedScriptPath);

const VONCMS_CONTACT_HONEYPOT_MIN_AGE = 1;
const VONCMS_CONTACT_HONEYPOT_MAX_AGE = 7200;

function voncms_contact_honeypot_base64url_encode(string $value): string
{
  return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function voncms_contact_honeypot_base64url_decode(string $value): ?string
{
  if ($value === '' || preg_match('/^[A-Za-z0-9_-]+$/', $value) !== 1) {
    return null;
  }

  $padding = strlen($value) % 4;
  if ($padding !== 0) {
    $value .= str_repeat('=', 4 - $padding);
  }

  $decoded = base64_decode(strtr($value, '-_', '+/'), true);
  return is_string($decoded) ? $decoded : null;
}

function voncms_contact_honeypot_secret(): string
{
  if (session_status() !== PHP_SESSION_ACTIVE) {
    throw new RuntimeException('Contact honeypot requires an active session.');
  }

  $stored = $_SESSION['contact_honeypot_secret'] ?? '';
  if (!is_string($stored) || preg_match('/^[a-f0-9]{64}$/', $stored) !== 1) {
    $stored = bin2hex(random_bytes(32));
    $_SESSION['contact_honeypot_secret'] = $stored;
  }

  $secret = hex2bin($stored);
  if (!is_string($secret)) {
    throw new RuntimeException('Contact honeypot secret is invalid.');
  }

  return $secret;
}

/** @return array{field: string, token: string} */
function voncms_contact_honeypot_issue(string $formId): array
{
  if (preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $formId) !== 1) {
    throw new InvalidArgumentException('Invalid contact form ID.');
  }

  $payload = [
    'v' => 1,
    'form_id' => $formId,
    'field' => 'contact_reference_' . bin2hex(random_bytes(6)),
    'issued_at' => time(),
    'nonce' => bin2hex(random_bytes(16)),
  ];
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
  if (!is_string($json)) {
    throw new RuntimeException('Unable to create contact honeypot challenge.');
  }

  $encodedPayload = voncms_contact_honeypot_base64url_encode($json);
  $signature = voncms_contact_honeypot_base64url_encode(
    hash_hmac('sha256', $encodedPayload, voncms_contact_honeypot_secret(), true),
  );

  return ['field' => $payload['field'], 'token' => $encodedPayload . '.' . $signature];
}

/** @return array{valid: bool, reason: string, nonce: string} */
function voncms_contact_honeypot_validate(string $formId, string $field, string $token): array
{
  $invalid = static fn(string $reason): array => [
    'valid' => false,
    'reason' => $reason,
    'nonce' => '',
  ];

  if (
    strlen($field) > 80 ||
    preg_match('/^contact_reference_[a-f0-9]{12}$/', $field) !== 1 ||
    $token === '' ||
    strlen($token) > 1024
  ) {
    return $invalid('malformed');
  }

  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) {
    return $invalid('malformed');
  }
  [$encodedPayload, $encodedSignature] = $parts;

  $providedSignature = voncms_contact_honeypot_base64url_decode($encodedSignature);
  if ($providedSignature === null) {
    return $invalid('signature');
  }
  $expectedSignature = hash_hmac('sha256', $encodedPayload, voncms_contact_honeypot_secret(), true);
  if (!hash_equals($expectedSignature, $providedSignature)) {
    return $invalid('signature');
  }

  $decodedPayload = voncms_contact_honeypot_base64url_decode($encodedPayload);
  $payload = is_string($decodedPayload) ? json_decode($decodedPayload, true) : null;
  if (!is_array($payload)) {
    return $invalid('payload');
  }

  $version = $payload['v'] ?? null;
  $payloadFormId = $payload['form_id'] ?? null;
  $payloadField = $payload['field'] ?? null;
  $issuedAt = $payload['issued_at'] ?? null;
  $nonce = $payload['nonce'] ?? null;
  if (
    $version !== 1 ||
    !is_string($payloadFormId) ||
    !is_string($payloadField) ||
    !is_int($issuedAt) ||
    !is_string($nonce) ||
    preg_match('/^[a-f0-9]{32}$/', $nonce) !== 1 ||
    !hash_equals($formId, $payloadFormId) ||
    !hash_equals($field, $payloadField)
  ) {
    return $invalid('payload');
  }

  $age = time() - $issuedAt;
  if ($age < VONCMS_CONTACT_HONEYPOT_MIN_AGE) {
    return $invalid('too_fast');
  }
  if ($age > VONCMS_CONTACT_HONEYPOT_MAX_AGE) {
    return $invalid('expired');
  }

  $used = $_SESSION['contact_honeypot_used'] ?? [];
  if (is_array($used) && isset($used[$nonce])) {
    return $invalid('replayed');
  }

  return ['valid' => true, 'reason' => 'valid', 'nonce' => $nonce];
}

function voncms_contact_honeypot_mark_used(string $nonce): void
{
  if (preg_match('/^[a-f0-9]{32}$/', $nonce) !== 1) {
    return;
  }

  $now = time();
  $used = $_SESSION['contact_honeypot_used'] ?? [];
  if (!is_array($used)) {
    $used = [];
  }
  foreach ($used as $storedNonce => $usedAt) {
    if (
      !is_string($storedNonce) ||
      !is_int($usedAt) ||
      $usedAt < $now - VONCMS_CONTACT_HONEYPOT_MAX_AGE
    ) {
      unset($used[$storedNonce]);
    }
  }
  $used[$nonce] = $now;
  $_SESSION['contact_honeypot_used'] = $used;
}

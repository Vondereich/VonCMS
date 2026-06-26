<?php
/**
 * VonCMS AI Grammar Check API
 * Proxies requests to Google Gemini API for grammar/style checking.
 *
 * Frontend sends:
 *   - Header: x-gemini-key (API key)
 *   - Body: { text: string }
 *
 * Returns:
 *   - { success: true, text: "Corrected text..." }
 *   - { success: false, error: "message" }
 */

require_once __DIR__ . '/../security.php';
sendApiHeaders('POST, OPTIONS');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit(0);
}

SessionManager::requireValidSession();
CSRFProtection::requireToken();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ResponseHelper::sendError('Method not allowed', 405);
}

// Get API key from header
$apiKey = $_SERVER['HTTP_X_GEMINI_KEY'] ?? '';
if (empty($apiKey)) {
  ResponseHelper::sendError('API key required.', 400);
}

// Get request body
$rawInput = CSRFProtection::getRequestBody();
$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

$text = trim($input['text'] ?? '');
$model = $input['model'] ?? 'gemini-2.0-flash'; // Default to 2.0-flash for performance

if (empty($text)) {
  ResponseHelper::sendError('Text is required and cannot be empty.', 400);
}

if (!function_exists('curl_init')) {
  ResponseHelper::sendError(
    'cURL extension is not available on this server. Please enable it or contact your hosting provider.',
    500,
  );
}

// Build prompt for grammar check
$prompt =
  "You are a professional editor. Check the following text for grammar, spelling, and style improvements. Return ONLY the corrected text, maintaining the original meaning and tone. Do not add explanations or meta-commentary. Text: \n\n" .
  $text;

// Gemini API endpoint (using dynamic model selection)
$geminiUrl =
  'https://generativelanguage.googleapis.com/v1beta/models/' .
  urlencode($model) .
  ':generateContent?key=' .
  urlencode($apiKey);

$payload = [
  'contents' => [
    [
      'parts' => [['text' => $prompt]],
    ],
  ],
  'generationConfig' => [
    'temperature' => 0.1, // Low temperature for deterministic corrections
    'topK' => 40,
    'topP' => 0.95,
    'maxOutputTokens' => 2048,
  ],
];

// Make request to Gemini
$ch = curl_init($geminiUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_TIMEOUT => 30,
  CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

if ($response === false || $curlError) {
  ResponseHelper::sendError(
    'Network error connecting to AI service: ' . ($curlError ?: 'Unknown cURL failure'),
    500,
  );
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
  $errorMsg = $data['error']['message'] ?? 'Unknown AI service error';
  ResponseHelper::sendError('AI Gateway Error: ' . $errorMsg, $httpCode ?: 502);
}

if (!is_array($data)) {
  ResponseHelper::sendError('AI service returned invalid JSON. Please try again later.', 502);
}

$generatedText = trim((string) ($data['candidates'][0]['content']['parts'][0]['text'] ?? ''));
$blockReason = $data['promptFeedback']['blockReason'] ?? '';
$finishReason = strtoupper((string) ($data['candidates'][0]['finishReason'] ?? ''));

if (!empty($blockReason)) {
  ResponseHelper::sendError('AI request was blocked by the provider: ' . $blockReason, 422);
}

if ($finishReason !== '' && $finishReason !== 'STOP') {
  ResponseHelper::sendError('AI response was incomplete: ' . $finishReason, 502);
}

if (empty($generatedText)) {
  ResponseHelper::sendError('The AI returned an empty response. Please try again.', 502);
}

// CLEANUP: Remove markdown code blocks if the AI "hallucinates" them into the response
// Strip ```text ... ``` or just ``` ... ```
$generatedText = preg_replace('/^```[a-z]*\s*/i', '', $generatedText);
$generatedText = preg_replace('/```\s*$/', '', $generatedText);
$generatedText = trim($generatedText);

echo json_encode(['success' => true, 'text' => $generatedText]);

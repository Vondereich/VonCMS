<?php

/**
 * VonCMS AI Generate API
 * Proxies requests to Google Gemini API for content generation.
 *
 * Frontend sends:
 *   - Header: x-gemini-key (API key)
 *   - Body: { topic: string, context?: string }
 *
 * Returns:
 *   - { success: true, text: "generated HTML content" }
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
  ResponseHelper::sendError('API key required. Please provide your Gemini API key.', 400);
}

// Get request body
$rawInput = CSRFProtection::getRequestBody();
$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
  ResponseHelper::sendError('Invalid JSON payload', 400);
}

$topic = isset($input['topic']) && is_scalar($input['topic']) ? trim((string) $input['topic']) : '';
$context =
  isset($input['context']) && is_scalar($input['context']) ? trim((string) $input['context']) : '';
$model = $input['model'] ?? 'gemini-2.0-flash'; // Default to 2.0-flash
$regenerate = isset($input['regenerate']) && $input['regenerate'] === true;

if (empty($topic)) {
  ResponseHelper::sendError('Topic is required and cannot be empty', 400);
}
if (mb_strlen($topic) > 500 || mb_strlen($context) > 20000) {
  ResponseHelper::sendError('AI prompt input is too large.', 400);
}
if (!is_string($model) || !preg_match('/^[a-zA-Z0-9._-]{1,100}$/', $model)) {
  ResponseHelper::sendError('Invalid AI model name.', 400);
}

if (!function_exists('curl_init')) {
  ResponseHelper::sendError(
    'cURL extension is not available on this server. Please enable it or contact your hosting provider.',
    500,
  );
}

// Build prompt for blog content generation
if ($regenerate) {
  $prompt = "HARD RESET: Forget any previous structure or tone. Write a completely NEW and FRESH professional blog post about: \"$topic\".";
  $prompt .= ' Approach this from a different angle than a standard article.';
} else {
  $prompt = "You are a professional content writer. Write a well-structured blog post about: \"$topic\".";
}

if (!empty($context)) {
  $prompt .= " Additional context: $context";
}

$styleRules = [
  'Write with a natural human rhythm: mix short and medium sentences, vary cadence, and sound like a real editor instead of a template.',
  'Do not add a conclusion section, final-thoughts section, summary wrap-up, or "Kesimpulan" unless the user explicitly asks for one.',
  'Never use the em dash character; use commas, periods, colons, semicolons, or parentheses instead.',
  'Avoid AI-signature phrases such as "In today\'s fast-paced world", "It is important to note", "In conclusion", "This article will explore", and "Final thoughts".',
  'Keep the tone specific, grounded, and publication-ready. Add practical details when the topic supports them.',
  'Format the output as clean HTML with h2/h3 only when useful, paragraphs, and bullet points where appropriate. Do not include html/head/body tags, markdown fences, or explanatory notes.',
];

$prompt .= "\n\nWriting rules:\n- " . implode("\n- ", $styleRules);

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
    'temperature' => $regenerate ? 0.9 : 0.7, // Higher temperature for regeneration
    'topK' => 40,
    'topP' => 0.95,
    'maxOutputTokens' => 4096,
  ],
];

// Make request to Gemini
$ch = curl_init($geminiUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_TIMEOUT => 60,
  CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

if ($response === false || $curlError) {
  ResponseHelper::sendError('Network error: ' . ($curlError ?: 'Unknown cURL failure'), 500);
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
  $errorMsg = $data['error']['message'] ?? 'Unknown API error';
  ResponseHelper::sendError('AI Gateway Error: ' . $errorMsg, $httpCode ?: 502);
}

if (!is_array($data)) {
  ResponseHelper::sendError('AI service returned invalid JSON. Please try again later.', 502);
}

// Extract generated text
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
  ResponseHelper::sendError(
    'The AI failed to generate content. Please try a different topic.',
    502,
  );
}

// Clean up the response - remove markdown code blocks if present
$generatedText = preg_replace('/^```[a-z]*\s*/i', '', $generatedText);
$generatedText = preg_replace('/```\s*$/', '', $generatedText);
$generatedText = trim($generatedText);

echo json_encode([
  'success' => true,
  'text' => $generatedText,
  'mode' => $regenerate ? 'regenerated' : 'initial',
]);

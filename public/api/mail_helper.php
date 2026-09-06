<?php
/**
 * VonCMS - Mail Helper
 * Lightweight SMTP email sending with a PHP mail() fallback.
 */

/**
 * Accept only a configured absolute site base URL suitable for token-bearing links.
 */
function voncms_normalize_trusted_public_base_url(mixed $value): string
{
  if (!is_scalar($value)) {
    return '';
  }

  $candidate = rtrim(trim((string) $value), '/');
  if ($candidate === '' || strlen($candidate) > 2048) {
    return '';
  }

  $parts = parse_url($candidate);
  $scheme = is_array($parts) ? strtolower((string) ($parts['scheme'] ?? '')) : '';
  if (
    !is_array($parts) ||
    filter_var($candidate, FILTER_VALIDATE_URL) === false ||
    !in_array($scheme, ['http', 'https'], true) ||
    empty($parts['host']) ||
    isset($parts['user']) ||
    isset($parts['pass']) ||
    isset($parts['query']) ||
    isset($parts['fragment'])
  ) {
    return '';
  }

  return $candidate;
}

/**
 * Retain request-derived URLs only for an exact loopback development host.
 */
function voncms_loopback_request_base_url(): string
{
  $environment = strtolower(trim((string) (getenv('VONCMS_ENV') ?: 'production')));
  if (!in_array($environment, ['development', 'dev', 'local'], true)) {
    return '';
  }

  $rawHost = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
  if ($rawHost === '' || preg_match('/[\x00-\x20\\\\\/@?#]/', $rawHost)) {
    return '';
  }

  $hostParts = parse_url('http://' . $rawHost);
  if (!is_array($hostParts) || empty($hostParts['host'])) {
    return '';
  }

  $host = strtolower(trim((string) $hostParts['host'], '[]'));
  if (!in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
    return '';
  }

  $authority = $host === '::1' ? '[' . $host . ']' : $host;
  if (isset($hostParts['port'])) {
    $port = (int) $hostParts['port'];
    if ($port < 1 || $port > 65535) {
      return '';
    }
    $authority .= ':' . $port;
  }

  $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
  $basePath = preg_replace('#/api(?:/.*)?$#i', '', $scriptName);
  $basePath = $basePath === null ? '' : '/' . trim($basePath, '/');
  $basePath = $basePath === '/' ? '' : $basePath;
  $https = function_exists('is_https')
    ? is_https()
    : isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1');

  return ($https ? 'https://' : 'http://') . $authority . $basePath;
}

/**
 * Resolve one trusted base URL without accepting an arbitrary production Host header.
 */
function voncms_resolve_trusted_public_base_url(mixed $pdo): string
{
  if ($pdo instanceof PDO) {
    try {
      $statement = $pdo->prepare(
        "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='domain_url' LIMIT 1",
      );
      $statement->execute();
      $row = $statement->fetch(PDO::FETCH_ASSOC);
      $configured = voncms_normalize_trusted_public_base_url($row['setting_value'] ?? '');
      if ($configured !== '') {
        return $configured;
      }
    } catch (Throwable $error) {
      // The loopback-only fallback below keeps local development usable.
    }
  }

  return voncms_loopback_request_base_url();
}

/**
 * Build an account-action URL below a previously trusted site base URL.
 *
 * @param array<string, scalar> $query
 */
function voncms_build_account_action_url(string $baseUrl, string $path, array $query): string
{
  $trustedBase = voncms_normalize_trusted_public_base_url($baseUrl);
  $normalizedPath = '/' . ltrim(str_replace('\\', '/', trim($path)), '/');
  if (
    $trustedBase === '' ||
    $normalizedPath === '/' ||
    str_contains($normalizedPath, '..') ||
    preg_match('/[\x00-\x1F]/', $normalizedPath)
  ) {
    return '';
  }

  return $trustedBase .
    $normalizedPath .
    '?' .
    http_build_query($query, '', '&', PHP_QUERY_RFC3986);
}

/**
 * Send email using SMTP settings from database or site_settings.json
 * Falls back to PHP mail() if SMTP not configured
 *
 * @param string $to
 * @param string $subject
 * @param string $htmlBody
 * @param string $fromEmail
 * @param string $fromName
 * @param string $textBody
 * @return array<string, mixed>
 */
function vonSendMail($to, $subject, $htmlBody, $fromEmail = '', $fromName = '', $textBody = '')
{
  // Security: Prevent SMTP Header & Command Injection (CRLF)
  $to = str_replace(["\r", "\n"], '', (string) $to);
  $subject = str_replace(["\r", "\n"], '', (string) $subject);
  $fromEmail = str_replace(["\r", "\n"], '', (string) $fromEmail);
  $fromName = str_replace(["\r", "\n"], '', (string) $fromName);

  // Try to load settings from database first
  $settings = loadSmtpSettings();

  $smtpHost = $settings['smtpHost'] ?? '';
  $smtpPort = $settings['smtpPort'] ?? 587;
  $smtpUser = $settings['smtpUser'] ?? '';
  $smtpPass = $settings['smtpPass'] ?? '';
  $smtpEncryption = $settings['smtpEncryption'] ?? 'tls';

  // Logic: Use provided fromName/fromEmail OR fall back to SMTP settings OR generic default
  $finalFromName = $fromName ?: $settings['smtpFromName'] ?? 'VonCMS';
  $safeHost = preg_replace(
    '/[^a-zA-Z0-9.\-:]/',
    '',
    (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'),
  );
  $finalFromEmail = $fromEmail ?: ($smtpUser ?: 'noreply@' . $safeHost);

  // SMTP Robustness: If using SMTP, some providers (Gmail/Outlook) reject the email
  // if the "From" header doesn't match the authenticated user.
  // We use the SMTP user as the literal sender, but keep the original fromEmail as Reply-To.
  $authenticatedFrom = !empty($smtpUser) ? $smtpUser : $finalFromEmail;

  // Formatting: If body is plain text, convert newlines and wrap in clean HTML
  $formattedBody = $htmlBody;
  if (strip_tags($htmlBody) === $htmlBody) {
    $formattedBody =
      '
    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
            <h2 style="margin: 0; color: #444; font-size: 18px;">' .
      htmlspecialchars($subject) .
      '</h2>
        </div>
        <div style="white-space: pre-wrap;">' .
      nl2br(htmlspecialchars($htmlBody)) .
      '</div>
        <div style="margin-top: 30px; font-size: 11px; color: #999; text-align: center;">
            Sent via ' .
      ($settings['site_name'] ?? 'VonCMS') .
      '
        </div>
    </div>';
  }

  // If no SMTP configured, use PHP mail()
  if (empty($smtpHost) || empty($smtpUser)) {
    return sendWithPhpMail($to, $subject, $formattedBody, $finalFromEmail, $finalFromName);
  }

  // Try SMTP with fsockopen
  return sendWithSmtp($to, $subject, $formattedBody, $textBody, [
    'host' => ($host = $smtpHost),
    'port' => $smtpPort,
    'user' => $smtpUser,
    'pass' => $smtpPass,
    'encryption' => $smtpEncryption,
    'fromEmail' => $authenticatedFrom, // Authenticated sender
    'fromName' => $finalFromName,
    'replyTo' => $finalFromEmail, // Original sender for user to reply to
    'authEmail' => $smtpUser,
  ]);
}

/**
 * Load SMTP settings from database or JSON file
 *
 * @return array<string, mixed>
 */
function loadSmtpSettings()
{
  global $pdo;

  // Try database first
  try {
    $configFile = dirname(__DIR__) . '/von_config.php';
    if (file_exists($configFile)) {
      include_once $configFile;

      if (isset($pdo) && $pdo !== null) {
        // Check if settings table exists
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'settings'");
        if ($tableCheck->rowCount() > 0) {
          // Query SMTP settings from database
          $stmt = $pdo->query(
            "SELECT setting_key, setting_value FROM settings WHERE setting_group = 'smtp' OR setting_group = 'general'",
          );
          $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

          $settings = [];
          foreach ($rows as $row) {
            $key = $row['setting_key'];
            $value = $row['setting_value'];

            // Map database keys to expected keys
            switch ($key) {
              case 'smtp_host':
              case 'smtpHost':
                $settings['smtpHost'] = $value;
                break;
              case 'smtp_port':
              case 'smtpPort':
                $settings['smtpPort'] = (int) $value;
                break;
              case 'smtp_user':
              case 'smtpUser':
                $settings['smtpUser'] = $value;
                break;
              case 'smtp_pass':
              case 'smtpPass':
                $settings['smtpPass'] = $value;
                break;
              case 'smtp_encryption':
              case 'smtpEncryption':
                $settings['smtpEncryption'] = $value;
                break;
              case 'smtp_from_name':
              case 'smtpFromName':
                $settings['smtpFromName'] = $value;
                break;
            }
          }

          if (!empty($settings['smtpHost'])) {
            return $settings;
          }
        }
      }
    }
  } catch (Exception $e) {
    error_log('SMTP settings DB load failed: ' . $e->getMessage());
  }

  // Fallback to JSON file
  $settingsPath = dirname(__DIR__) . '/data/site_settings.json';
  if (file_exists($settingsPath)) {
    $json = json_decode(file_get_contents($settingsPath), true);
    if ($json) {
      return $json;
    }
  }

  return [];
}

/**
 * Fallback: PHP mail() function
 *
 * @param string $to
 * @param string $subject
 * @param string $htmlBody
 * @param string $fromEmail
 * @param string $fromName
 * @return array<string, mixed>
 */
function sendWithPhpMail($to, $subject, $htmlBody, $fromEmail, $fromName)
{
  $headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: ' . $fromName . ' <' . $fromEmail . '>',
    'Reply-To: ' . $fromEmail,
    'X-Mailer: VonCMS',
  ];

  $result = mail($to, $subject, $htmlBody, implode("\r\n", $headers));

  return [
    'success' => $result,
    'method' => 'php_mail',
    'message' => $result ? 'Email sent' : 'mail() function failed',
  ];
}

/**
 * SMTP sending using fsockopen (basic, no external library needed)
 *
 * @param string $to
 * @param string $subject
 * @param string $htmlBody
 * @param string $textBody
 * @param array<string, mixed> $config
 * @return array<string, mixed>
 */
function sendWithSmtp($to, $subject, $htmlBody, $textBody, $config)
{
  $host = trim((string) ($config['host'] ?? ''));
  $port = (int) ($config['port'] ?? 0);
  $user = trim((string) ($config['user'] ?? ''));
  $pass = (string) ($config['pass'] ?? '');
  $encryption = strtolower(trim((string) ($config['encryption'] ?? 'tls')));
  $fromEmail = trim((string) ($config['fromEmail'] ?? ''));
  $fromName = trim((string) ($config['fromName'] ?? ''));

  if (
    $host === '' ||
    strlen($host) > 255 ||
    preg_match('/[\r\n]/', $host) ||
    $port < 1 ||
    $port > 65535 ||
    !in_array($encryption, ['tls', 'ssl', 'none'], true) ||
    !filter_var($user, FILTER_VALIDATE_EMAIL) ||
    !filter_var($fromEmail, FILTER_VALIDATE_EMAIL) ||
    !filter_var($to, FILTER_VALIDATE_EMAIL)
  ) {
    return [
      'success' => false,
      'method' => 'smtp',
      'message' => 'SMTP configuration or recipient is invalid.',
    ];
  }

  // One deadline covers connect, negotiation, authentication, and delivery.
  // The existing per-read timeout remains as the tighter bound for any one response.
  $transactionDeadline = microtime(true) + 30;

  // For TLS/SSL connections
  $prefix = '';
  if ($encryption === 'ssl') {
    $prefix = 'ssl://';
  }

  // Connect to SMTP server
  $errno = 0;
  $errstr = '';

  /** @var resource|false $socket */
  $socket = fsockopen($prefix . $host, $port, $errno, $errstr, 15); // 15s connect timeout

  if (!$socket) {
    error_log("SMTP Connection failed: $errstr ($errno)");
    return ['success' => false, 'method' => 'smtp', 'message' => "Connection failed: $errstr"];
  }

  $applyRemainingTimeout =
    /**
     * @return void
     */
    function () use ($socket, $transactionDeadline) {
      $remaining = $transactionDeadline - microtime(true);
      if ($remaining <= 0) {
        throw new RuntimeException('SMTP transaction timed out.');
      }

      $boundedRemaining = min(15, $remaining);
      $seconds = (int) floor($boundedRemaining);
      $microseconds = (int) (($boundedRemaining - $seconds) * 1000000);
      stream_set_timeout($socket, $seconds, $microseconds);
    };

  // Helper to get full response (handles multi-line responses)
  $getResponse =
    /**
     * @return string
     */
    function () use ($socket, $applyRemainingTimeout) {
      $response = '';
      while (true) {
        $applyRemainingTimeout();
        $line = fgets($socket, 512);
        $info = stream_get_meta_data($socket);

        if ($line === false) {
          if ($info['timed_out']) {
            throw new RuntimeException('SMTP server response timed out.');
          }
          if (feof($socket)) {
            throw new RuntimeException('SMTP connection was closed by the server.');
          }
          throw new RuntimeException('SMTP server response could not be read.');
        }

        $response .= $line;
        // RFC 5321: Multi-line responses use '-' after code, last line uses ' '
        if (strlen($line) >= 4 && substr($line, 3, 1) === ' ') {
          break;
        }
      }
      return $response;
    };

  $writeSocket =
    /**
     * @param string $content
     * @return void
     */
    function ($content) use ($socket, $applyRemainingTimeout) {
      $length = strlen($content);
      $offset = 0;

      while ($offset < $length) {
        $applyRemainingTimeout();
        $written = fwrite($socket, substr($content, $offset));
        if ($written === false || $written === 0) {
          throw new RuntimeException(
            'SMTP connection closed before the complete request was sent.',
          );
        }
        $offset += $written;
      }
    };

  // Helper to send command and get full response
  $sendCmd =
    /**
     * @param string $cmd
     * @return string
     */
    function ($cmd) use ($writeSocket, $getResponse) {
      $writeSocket($cmd . "\r\n");
      return $getResponse();
    };

  $expectResponse =
    /**
     * @param string $response
     * @param array<int, int> $allowedCodes
     * @param string $stage
     * @return void
     */
    function ($response, $allowedCodes, $stage) {
      $responseCode = preg_match('/^[0-9]{3}/', $response) ? (int) substr($response, 0, 3) : 0;
      if (!in_array($responseCode, $allowedCodes, true)) {
        $reportedCode = $responseCode > 0 ? (string) $responseCode : 'no response';
        throw new RuntimeException("SMTP $stage failed ($reportedCode).");
      }
    };

  try {
    // Read greeting (Full)
    $greeting = $getResponse();
    $expectResponse($greeting, [220], 'greeting');
    error_log('SMTP Greeting: ' . trim($greeting));

    // EHLO
    $ehloHost = preg_replace(
      '/[^a-zA-Z0-9.\-:]/',
      '',
      (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'),
    );
    $ehloResp = $sendCmd('EHLO ' . $ehloHost);
    $expectResponse($ehloResp, [250], 'EHLO');
    error_log('SMTP EHLO Response: ' . trim($ehloResp));

    // STARTTLS for TLS
    if ($encryption === 'tls') {
      $tlsResp = $sendCmd('STARTTLS');
      $expectResponse($tlsResp, [220], 'STARTTLS');
      error_log('SMTP STARTTLS Response: ' . trim($tlsResp));

      $applyRemainingTimeout();
      $cryptoResult = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
      if ($cryptoResult !== true) {
        error_log('SMTP TLS handshake failed');
        fclose($socket);
        return [
          'success' => false,
          'method' => 'smtp',
          'message' => 'TLS handshake failed. Check server TLS support.',
        ];
      }

      $ehloResp = $sendCmd('EHLO ' . $ehloHost);
      $expectResponse($ehloResp, [250], 'EHLO after TLS');
      error_log('SMTP EHLO (TLS) Response: ' . trim($ehloResp));
    }

    // AUTH LOGIN
    $authCmd = $sendCmd('AUTH LOGIN');
    $expectResponse($authCmd, [334], 'AUTH LOGIN');
    error_log('SMTP AUTH LOGIN Response: ' . trim($authCmd));

    $userResp = $sendCmd(base64_encode($user));
    $expectResponse($userResp, [334], 'username authentication');
    error_log('SMTP User Response: ' . trim($userResp));

    $passResp = $sendCmd(base64_encode($pass));
    $expectResponse($passResp, [235], 'password authentication');
    error_log('SMTP Pass Response: ' . trim($passResp));

    // MAIL FROM (Envelope Sender)
    $envelopeEmail = $config['authEmail'] ?: $fromEmail;
    $mailFromResp = $sendCmd("MAIL FROM:<$envelopeEmail>");
    $expectResponse($mailFromResp, [250], 'MAIL FROM');
    error_log('SMTP MAIL FROM Response: ' . trim($mailFromResp));

    // RCPT TO
    $rcptResp = $sendCmd("RCPT TO:<$to>");
    $expectResponse($rcptResp, [250, 251], 'RCPT TO');
    error_log('SMTP RCPT TO Response: ' . trim($rcptResp));

    // DATA
    $dataResp = $sendCmd('DATA');
    $expectResponse($dataResp, [354], 'DATA');

    // Email content
    $email = "From: $fromName <$fromEmail>\r\n";
    $email .= "To: $to\r\n";
    $email .= "Subject: $subject\r\n";
    $email .= "MIME-Version: 1.0\r\n";
    $email .= "Content-Type: text/html; charset=UTF-8\r\n";

    // Add Reply-To if provided Robustness
    $replyTo = $config['replyTo'] ?? $fromEmail;
    if ($replyTo) {
      $email .= "Reply-To: $replyTo\r\n";
    }

    $email .= "X-Mailer: VonCMS\r\n";
    $email .= "\r\n";

    // RFC 5321 Dot-Stuffing: If body contains a line starting with '.', prepend another '.'
    $safeHtmlBody = preg_replace('/^\./m', '..', $htmlBody);

    $email .= $safeHtmlBody;
    $email .= "\r\n.\r\n";

    $writeSocket($email);
    $dataResponse = $getResponse();
    $expectResponse($dataResponse, [250], 'message delivery');

    // QUIT is best-effort after the server has already accepted the message.
    try {
      $quitResponse = $sendCmd('QUIT');
      $expectResponse($quitResponse, [221], 'QUIT');
    } catch (Throwable $quitError) {
      error_log('SMTP QUIT warning: ' . $quitError->getMessage());
    }
    fclose($socket);

    return [
      'success' => true,
      'method' => 'smtp',
      'message' => 'Email sent via SMTP',
    ];
  } catch (Throwable $e) {
    @fclose($socket);
    error_log('SMTP Error: ' . $e->getMessage());
    return [
      'success' => false,
      'method' => 'smtp',
      'message' => $e->getMessage(),
    ];
  }
}

/**
 * Generate email verification token
 *
 * @return string
 */
function generateVerificationToken()
{
  return bin2hex(random_bytes(32)); // 64 character token
}

/**
 * Send verification email to user
 *
 * @param PDO $pdo
 * @param string $to
 * @param string $username
 * @param string $token
 * @param string|null $trustedBaseUrl
 * @return array<string, mixed>
 */
function sendVerificationEmail($pdo, $to, $username, $token, $trustedBaseUrl = null)
{
  $trustedBaseUrl =
    $trustedBaseUrl === null
      ? voncms_resolve_trusted_public_base_url($pdo)
      : voncms_normalize_trusted_public_base_url($trustedBaseUrl);
  $verifyUrl = voncms_build_account_action_url($trustedBaseUrl, '/api/verify_email.php', [
    'token' => (string) $token,
  ]);
  if ($verifyUrl === '') {
    return [
      'success' => false,
      'method' => 'configuration',
      'message' => 'A valid canonical Domain URL is required before verification email delivery.',
    ];
  }

  $safeVerifyUrl = htmlspecialchars($verifyUrl, ENT_QUOTES | ENT_HTML5, 'UTF-8');

  $subject = 'Verify Your Email - VonCMS';

  $htmlBody =
    '
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>
            </div>
            <div style="padding: 30px;">
                <p style="color: #333; font-size: 16px;">Hi <strong>' .
    htmlspecialchars($username) .
    '</strong>,</p>
                <p style="color: #666;">Thanks for registering! Please click the button below to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="' .
    $safeVerifyUrl .
    '" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email</a>
                </div>
                <p style="color: #999; font-size: 12px;">Or copy this link: <br><a href="' .
    $safeVerifyUrl .
    '" style="color: #667eea; word-break: break-all;">' .
    $safeVerifyUrl .
    '</a></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 11px; text-align: center;">This link expires in 24 hours. If you didn\'t create an account, ignore this email.</p>
            </div>
        </div>
    </body>
    </html>';
  $htmlBody = preg_replace(
    '~<h1 style="color: white; margin: 0; font-size: 24px;">.*?Verify Your Email</h1>~',
    '<h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>',
    $htmlBody,
    1,
  );

  return vonSendMail($to, $subject, $htmlBody);
}

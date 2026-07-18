<?php
/**
 * VonCMS - Mail Helper
 * Simple SMTP email sending using PHPMailer or PHP mail()
 */

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
  $host = $config['host'];
  $port = $config['port'];
  $user = $config['user'];
  $pass = $config['pass'];
  $encryption = $config['encryption'];
  $fromEmail = $config['fromEmail'];
  $fromName = $config['fromName'];

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

  // Set read timeout (prevent hanging on fgets)
  stream_set_timeout($socket, 15);

  // Helper to get full response (handles multi-line responses)
  $getResponse =
    /**
     * @return string
     */
    function () use ($socket) {
      $response = '';
      while (true) {
        $line = fgets($socket, 512);
        $info = stream_get_meta_data($socket);

        if ($line === false) {
          if ($info['timed_out']) {
            error_log('SMTP Timeout during read');
            break;
          }
          if (feof($socket)) {
            error_log('SMTP Connection closed by server');
            break;
          }
          break;
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
    function ($content) use ($socket) {
      $length = strlen($content);
      $offset = 0;

      while ($offset < $length) {
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

  try {
    // Read greeting (Full)
    $greeting = $getResponse();
    error_log('SMTP Greeting: ' . trim($greeting));

    // EHLO
    $ehloHost = preg_replace(
      '/[^a-zA-Z0-9.\-:]/',
      '',
      (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'),
    );
    $ehloResp = $sendCmd('EHLO ' . $ehloHost);
    error_log('SMTP EHLO Response: ' . trim($ehloResp));

    // STARTTLS for TLS
    if ($encryption === 'tls') {
      $tlsResp = $sendCmd('STARTTLS');
      error_log('SMTP STARTTLS Response: ' . trim($tlsResp));

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
      error_log('SMTP EHLO (TLS) Response: ' . trim($ehloResp));
    }

    // AUTH LOGIN
    $authCmd = $sendCmd('AUTH LOGIN');
    error_log('SMTP AUTH LOGIN Response: ' . trim($authCmd));

    // Check if server supports AUTH LOGIN
    if (substr($authCmd, 0, 3) !== '334') {
      fclose($socket);
      return [
        'success' => false,
        'method' => 'smtp',
        'message' => 'Server does not support AUTH LOGIN or rejected command: ' . trim($authCmd),
      ];
    }

    $userResp = $sendCmd(base64_encode($user));
    error_log('SMTP User Response: ' . trim($userResp));

    $passResp = $sendCmd(base64_encode($pass));
    error_log('SMTP Pass Response: ' . trim($passResp));

    if (substr($passResp, 0, 3) !== '235') {
      fclose($socket);
      return [
        'success' => false,
        'method' => 'smtp',
        'message' => 'Authentication failed: ' . trim($passResp),
      ];
    }

    // MAIL FROM (Envelope Sender)
    $envelopeEmail = $config['authEmail'] ?: $fromEmail;
    $mailFromResp = $sendCmd("MAIL FROM:<$envelopeEmail>");
    error_log('SMTP MAIL FROM Response: ' . trim($mailFromResp));

    // RCPT TO
    $rcptResp = $sendCmd("RCPT TO:<$to>");
    error_log('SMTP RCPT TO Response: ' . trim($rcptResp));

    // DATA
    $dataResp = $sendCmd('DATA');

    // Email content
    $boundary = md5(uniqid(time()));
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

    // QUIT
    $sendCmd('QUIT');
    fclose($socket);

    $success = substr($dataResponse, 0, 3) === '250';
    return [
      'success' => $success,
      'method' => 'smtp',
      'message' => $success ? 'Email sent via SMTP' : 'SMTP send failed',
    ];
  } catch (Exception $e) {
    @fclose($socket);
    error_log('SMTP Error: ' . $e->getMessage());
    return ['success' => false, 'method' => 'smtp', 'message' => $e->getMessage()];
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
 * @return array<string, mixed>
 */
function sendVerificationEmail($pdo, $to, $username, $token)
{
  // Build verification URL - prefer configured domain_url (prevents Host header injection)
  $protocol = is_https() ? 'https' : 'http';

  $domainUrl = '';
  try {
    $duStmt = $pdo->prepare(
      "SELECT setting_value FROM settings WHERE setting_group='general' AND setting_key='domain_url' LIMIT 1",
    );
    $duStmt->execute();
    $duRow = $duStmt->fetch(PDO::FETCH_ASSOC);
    $domainUrl = $duRow ? rtrim($duRow['setting_value'], '/') : '';
  } catch (Exception $e) {
    // DB may not be available during early install
  }

  if ($domainUrl) {
    $verifyUrl = "$domainUrl/api/verify_email.php?token=$token";
  } else {
    // Fallback: derive from request
    $host = preg_replace('/[^a-zA-Z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    $basePath = preg_replace('#/api(/.*)?$#i', '', (string) $scriptName);
    $basePath = '/' . trim($basePath, '/');
    $basePath = $basePath === '/' ? '' : $basePath;
    $verifyUrl = "$protocol://$host$basePath/api/verify_email.php?token=$token";
  }

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
    $verifyUrl .
    '" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email</a>
                </div>
                <p style="color: #999; font-size: 12px;">Or copy this link: <br><a href="' .
    $verifyUrl .
    '" style="color: #667eea; word-break: break-all;">' .
    $verifyUrl .
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

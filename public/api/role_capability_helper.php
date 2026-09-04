<?php

/**
 * Fixed-role capability and post-workflow policy.
 *
 * Frontend role checks are only a user-experience projection. Every protected
 * transition must be authorized again through this server-owned policy.
 */

function voncms_normalize_role(mixed $role): string
{
  return strtolower(trim(is_scalar($role) ? (string) $role : ''));
}

/**
 * @return array<string, list<string>>
 */
function voncms_fixed_role_capabilities(): array
{
  static $capabilities = null;

  if (is_array($capabilities)) {
    return $capabilities;
  }

  $reviewerCapabilities = [
    'posts.read_any_protected',
    'posts.create',
    'posts.edit_any',
    'posts.delete_any',
    'posts.review',
    'posts.publish',
    'posts.schedule',
    'posts.archive',
    'pages.read_protected',
    'pages.create',
    'pages.edit_any',
    'pages.delete_any',
    'media.access',
  ];

  $capabilities = [
    'root' => array_merge($reviewerCapabilities, [
      'users.manage',
      'settings.manage',
      'media.admin_tools',
    ]),
    'admin' => array_merge($reviewerCapabilities, [
      'users.manage',
      'settings.manage',
      'media.admin_tools',
    ]),
    'moderator' => $reviewerCapabilities,
    'writer' => [
      'posts.read_own_protected',
      'posts.create',
      'posts.edit_own_draft',
      'posts.submit_review',
      'posts.withdraw_review',
      'posts.delete_own_draft',
      'media.access',
    ],
    'member' => [],
  ];

  return $capabilities;
}

function voncms_role_has_capability(mixed $role, string $capability): bool
{
  $normalizedRole = voncms_normalize_role($role);
  $capabilities = voncms_fixed_role_capabilities();

  return isset($capabilities[$normalizedRole]) &&
    in_array($capability, $capabilities[$normalizedRole], true);
}

/**
 * Accounts with system-owner authority may only be managed by Admin 1/root.
 */
function voncms_user_target_requires_primary_admin(mixed $userId, mixed $role): bool
{
  $normalizedId = is_scalar($userId) ? trim((string) $userId) : '';
  $normalizedRole = voncms_normalize_role($role);

  return $normalizedId === '1' || in_array($normalizedRole, ['admin', 'root'], true);
}

function voncms_role_can_review_posts(mixed $role): bool
{
  return voncms_role_has_capability($role, 'posts.review');
}

/**
 * Keep old clients functional after an OTA asset transition while making the
 * new explicit workflow action the canonical contract.
 */
function voncms_derive_legacy_post_action(mixed $status): string
{
  return match (strtolower(trim(is_scalar($status) ? (string) $status : 'draft'))) {
    'published' => 'publish',
    'scheduled' => 'schedule',
    'archived' => 'archive',
    'pending_review' => 'submit_review',
    default => 'save_draft',
  };
}

/**
 * @return list<string>
 */
function voncms_post_workflow_actions(): array
{
  return [
    'save_draft',
    'save_review',
    'submit_review',
    'withdraw_review',
    'return_draft',
    'publish',
    'schedule',
    'archive',
  ];
}

function voncms_is_post_workflow_action(mixed $action): bool
{
  $normalized = strtolower(trim(is_scalar($action) ? (string) $action : ''));
  return in_array($normalized, voncms_post_workflow_actions(), true);
}

function voncms_normalize_post_workflow_action(mixed $action, mixed $legacyStatus = null): string
{
  $normalized = strtolower(trim(is_scalar($action) ? (string) $action : ''));

  return in_array($normalized, voncms_post_workflow_actions(), true)
    ? $normalized
    : voncms_derive_legacy_post_action($legacyStatus);
}

/**
 * @return array{
 *   allowed: bool,
 *   status: string,
 *   status_only: bool,
 *   audit_action: string,
 *   message: string
 * }
 */
function voncms_resolve_post_workflow(
  mixed $role,
  ?string $sourceStatus,
  string $action,
  bool $isOwner,
  bool $isNew,
): array {
  $normalizedRole = voncms_normalize_role($role);
  $source = $isNew ? 'new' : strtolower(trim((string) $sourceStatus));
  $isReviewer = voncms_role_can_review_posts($normalizedRole);

  $deny = static fn(string $message): array => [
    'allowed' => false,
    'status' => $source === 'new' ? 'draft' : $source,
    'status_only' => false,
    'audit_action' => 'update',
    'message' => $message,
  ];

  $allow = static fn(
    string $status,
    bool $statusOnly,
    string $auditAction,
    string $message,
  ): array => [
    'allowed' => true,
    'status' => $status,
    'status_only' => $statusOnly,
    'audit_action' => $auditAction,
    'message' => $message,
  ];

  if ($normalizedRole === 'writer') {
    if (!$isNew && !$isOwner) {
      return $deny('Writers can only manage their own posts.');
    }

    if ($source === 'new') {
      return match ($action) {
        'save_draft' => $allow('draft', false, 'create', 'Draft saved'),
        'submit_review' => $allow(
          'pending_review',
          false,
          'submit_review',
          'Post submitted for review',
        ),
        default => $deny('Writers can only save a draft or submit it for review.'),
      };
    }

    if ($source === 'draft') {
      return match ($action) {
        'save_draft' => $allow('draft', false, 'update', 'Draft saved'),
        'submit_review' => $allow(
          'pending_review',
          false,
          'submit_review',
          'Post submitted for review',
        ),
        default => $deny('Writers cannot publish, schedule, or archive posts.'),
      };
    }

    if ($source === 'pending_review' && $action === 'withdraw_review') {
      return $allow('draft', true, 'withdraw_review', 'Submission withdrawn to draft');
    }

    return $deny(
      $source === 'pending_review'
        ? 'Withdraw this submission to Draft before editing it.'
        : 'Writers cannot edit published, scheduled, or archived posts.',
    );
  }

  if (!$isReviewer) {
    return $deny('Not authorized to manage posts.');
  }

  if ($source === 'pending_review') {
    return match ($action) {
      'save_review' => $allow('pending_review', false, 'update', 'Review changes saved'),
      'return_draft' => $allow('draft', true, 'return_draft', 'Post returned to draft'),
      'publish' => $allow('published', true, 'publish', 'Post published'),
      'schedule' => $allow('scheduled', true, 'schedule', 'Post scheduled'),
      'archive' => $allow('archived', true, 'archive', 'Post archived'),
      default => $deny('Use a review action while this post is pending review.'),
    };
  }

  return match ($action) {
    'save_draft' => $allow('draft', false, $isNew ? 'create' : 'update', 'Draft saved'),
    'publish' => $allow('published', false, 'publish', 'Post published'),
    'schedule' => $allow('scheduled', false, 'schedule', 'Post scheduled'),
    'archive' => $isNew
      ? $deny('Save the post before archiving it.')
      : $allow('archived', true, 'archive', 'Post archived'),
    default => $deny('This post workflow action is not allowed from its current status.'),
  };
}

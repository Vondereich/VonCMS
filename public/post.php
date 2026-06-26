<?php
/**
 * Legacy compatibility shim for older direct post lookups.
 *
 * This endpoint now forwards to the current single-post API so it stays aligned
 * with the database-backed contract, scheduler rules, and path handling.
 */

require_once __DIR__ . '/api/get_post.php';

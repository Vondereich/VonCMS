# VonCMS Upgrade Guide

Most modern VonCMS installs can be updated from the admin panel.

## Recommended path to v1.21.x

1. Back up your database.
2. Back up `uploads/` if you store media locally.
3. If your hosting folder already has a host-generated `.htaccess`, keep a copy before updating.
4. In the admin panel, go to `Settings > System` and run the updater.
5. After the update, verify the homepage, one single post, and the admin dashboard.

## What to verify after updating to v1.21.2

This release mainly affects routing recovery and theme hydration behavior.

Check these items:

- the public site loads correctly on your main path
- `/admin` still opens and login works
- one single post page loads without layout glitches
- TechPress trending cards look stable on long titles
- if you use shared hosting, `.htaccess` still contains your host-managed PHP handler block

## When to use Integrity Fix

Use Integrity Fix only if routing or core protection files are out of sync.

Current behavior:

- it creates a `.bak` backup first
- it repairs the VonCMS-managed routing block
- it is designed to preserve hosting-specific rules outside that managed block

That means it is safer than the older full-overwrite approach.

## Updating from older 1.20.x or early 1.21.x installs

If you are coming from an older Breeze or Mandala install:

1. run the normal updater first
2. clear your browser cache
3. open the public homepage and admin once
4. only run Integrity Fix if you actually see routing or protection issues

There is no benefit in pressing Integrity Fix on every update if the site is already healthy.

## Manual upgrade for older installs

If your site is too old for the current OTA flow or the admin panel is unavailable:

1. download the latest release package from the official release
2. use `Deploy.zip` if the site still uses the default VonCMS `.htaccess` and standard routing setup
3. use `Upgrade.zip` if the site has cPanel-generated PHP handlers, custom `.htaccess` blocks, hardcoded redirects, or hosting rules you do not want overwritten
4. back up your database, `uploads/`, and `von_config.php`
5. upload the chosen package and overwrite the old deployment files
6. keep your real `von_config.php`
7. sign in to the admin panel and verify the system version

## Shared hosting note

A truly fresh install writes a fresh VonCMS `.htaccess` template.

If you are updating inside a folder that already contains hosting-generated `.htaccess` content, custom redirects, or hardcoded rewrite rules, prefer `Upgrade.zip`. This matters most on cPanel or similar hosts that manage PHP versions through `.htaccess` rules.

## Rollback checklist

If something looks wrong after an update:

- restore your database backup if the issue is data-related
- restore your saved `.htaccess` or the `.bak` copy if routing was changed unexpectedly
- restore your `uploads/` backup only if media files are missing or corrupted
- compare your active theme and plugin settings before assuming the core update failed

## Final advice

Update in this order:

1. backup
2. update
3. verify
4. repair only if needed

That keeps the process calm and makes troubleshooting much easier.

# VonCMS Usage Policy

**Status: Draft for maintainer review - not an adopted policy or a new software licence.**

Draft date: 2026-10-27

This document explains the operating responsibilities and support boundaries of using the self-hosted VonCMS software. It must be read alongside the [GPL-3.0-only licence](../LICENSE.md), [Security Policy](SECURITY.md), [Installation Guide](INSTALL.md) and [Upgrade Guide](UPGRADE.md).

It does not add restrictions to rights granted by the GPL. If this document conflicts with the software licence, the licence governs those rights. Third-party components retain their own licences. Any binding service agreement would need separate, clearly identified terms and appropriate legal review.

## 1. What this document covers

VonCMS is publishing software that an operator installs on hosting they control or arrange. The operator may be an individual, organisation, agency or a person managing a client installation.

The project supplies software and documentation. Installing VonCMS does not itself establish a managed-hosting service, a support subscription, an uptime commitment or permission for the maintainers to administer the installation.

This document is not the visitor privacy policy or terms of use for a website built with VonCMS. It also does not describe data handling by the project website, demonstration sites, GitHub or external providers. Those services require their own applicable notices.

Feature descriptions apply only where the installed release actually implements them. Development builds and roadmap entries are not promises of published functionality or delivery dates.

## 2. Software rights, redistribution and branding

VonCMS is licensed under GPL-3.0-only. The licence governs use, modification and redistribution, including commercial activity. Operators and redistributors should read the actual licence rather than treating this summary as a replacement.

When conveying copies or modified distributions, follow the applicable source-code, licence and notice requirements. Third-party code, fonts and other assets may have separate notices that must also be respected.

The project licence notice does not grant permission to present a modified distribution as an official VonCMS release or imply Vondereich endorsement. Preserve required notices and identify modifications appropriately. See the [licence and trademark notes](LICENSE.md).

These operating guidelines do not create a separate power to withdraw GPL rights because the project dislikes a particular installation or use.

## 3. Content and editorial responsibility

This document makes no ownership claim over an operator's original articles, images or other independently created content. A software licence is not a grant of rights in material obtained from other people, and using the CMS does not automatically place every original article under the software's licence.

The operator is responsible for the content they publish or import, including permissions, attribution, confidentiality, accuracy, moderation and applicable legal obligations. Importing material, embedding a video or entering an image URL does not establish permission to use it.

AI-assisted text and automatically extracted summaries require editorial review. Generation is not independent fact-checking, a copyright clearance or a guarantee of originality. The built-in writing endpoint does not perform live web research.

Complaints about content published on an independently operated VonCMS site should be directed to that site's operator. The software project is not automatically the publisher or administrator of every installation.

## 4. Hosting, access and maintenance

The operator is responsible for choosing suitable hosting, configuring HTTPS and routing, protecting credentials, assigning appropriate roles, and keeping PHP, the web server, database and other dependencies appropriately patched. A CMS update does not update PHP or the hosting stack.

Use the documented installation and repair paths. Application checks do not replace the hosting provider's access controls, file protection, backups, malware response or network protection. Custom server configurations need their own verification.

Primary Admin and delegated roles have different powers. The operator is responsible for deciding who receives access, reviewing that access and securing the hosting account as well as the CMS account.

Do not publish database credentials, authentication cookies, private API keys, reset links, full database exports or unredacted diagnostic material in support requests. Providing support access or sending a backup is a separate disclosure decision, not an automatic requirement of installing VonCMS.

## 5. Data, privacy and cookies

Normal installation data is stored in the operator's configured database and hosting storage. Depending on enabled features and activity, this can include accounts and profile information, content, comments, subscriber addresses, contact submissions, analytics, security events and administrative audit records.

Public profiles and published content deliberately expose selected public information. Private operational records may contain identifiers such as IP addresses and user-agent information. Hashed analytics identifiers and estimated visitor counts should not be described as proof of a person's identity or a blanket guarantee of anonymity.

The operator must assess the privacy information, consent choices, retention practices and procedures appropriate to their actual site and applicable obligations. Technical safeguards and a consent banner do not by themselves establish legal compliance.

In particular:

- Login/session cookies, optional remember-me credentials, analytics consent preferences and optional Balanced analytics identifiers have different purposes. They should not all be described as advertising cookies or all be described as essential.
- Native analytics and configured Google Analytics have their documented activation and consent controls. The analytics banner does not automatically control ad snippets, custom widgets, external embeds or every third-party request.
- Built-in VonAnalytics sends visitor records to the installation's own API and database, not to a central VonCMS project analytics service. Enabling Google Analytics starts a separate browser integration; it does not export the native analytics database to Google.
- The built-in Google loader requires the analytics plugin to be active, a configured Measurement ID, Google tracking not disabled and any configured analytics consent. Disabling only Google tracking does not disable native visitor recording. Aggregate article/page view counters are also distinct from visitor analytics. These controls do not promise to recall information already sent or remove every third-party script from a page that is already open.
- Some avatar fallbacks use Gravatar. External images, fonts added by a customisation and embedded services may also involve connections from the visitor's browser.
- Some modules prune records opportunistically or provide maintenance controls. Do not promise an exact universal deletion deadline without considering actual activity, failures, backups and external systems.
- Deleting an account is not a universal erase-all-content action. Existing post and comment content can remain after account links are removed. The operator must separately review any relevant deletion request and retained copies.

Publish a site-specific privacy and cookie notice that reflects the actual configuration. This document is not a substitute for that notice or for legal advice.

## 6. Optional features and external services

External connections depend on the feature, content and configuration in use. Review each provider's terms, availability, pricing and data practices before enabling or using it.

| Feature or action                   | Relevant boundary                                                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI writing and editing              | Requests can send the supplied prompt or article context to the configured Gemini service. API usage belongs to the applicable provider account and may incur charges.                                   |
| Built-in AI Summary                 | The bundled summary plugin extracts points locally from article text; its label does not mean it calls a paid generative AI provider. Custom replacements may behave differently.                        |
| Account and contact email           | Delivery uses the operator's configured SMTP service or the hosting mail transport. Receiving a stored contact submission does not prove its email notification was delivered.                           |
| Google Analytics and advertising    | Configured Google services, ad snippets and custom integrations may load external code or transmit visitor information. Provider approval and delivery are separate from CMS configuration.              |
| IndexNow                            | When configured and triggered, the integration submits public page URLs and the protocol's validation information to the configured search endpoints. Submission does not guarantee indexing or ranking. |
| Release discovery and updates       | Checking or downloading releases can contact GitHub. This does not itself give the project access to the installation's database or hosting account.                                                     |
| Media and CDN settings              | Standard uploads are written to local `uploads/` storage. The CDN setting changes delivery URLs; it does not itself upload a second copy to an object-storage provider or create an off-site backup.     |
| Remote content, imports and avatars | Embeds, remote images, avatar fallbacks and operator-started imports can contact their respective external destinations. The operator must assess those uses separately.                                 |

Local development helpers are not equivalent to hosted production services. A dependency appearing in the source package is not, by itself, evidence that the deployed site sends data to that dependency's vendor.

## 7. Themes, plugins and custom code

Operators are responsible for selecting trustworthy themes, plugins, snippets and custom modifications, and for reviewing their permissions, external requests and compatibility.

The safeguards and behaviour of a bundled feature do not automatically extend to an independently modified renderer or third-party integration. Test changes on an isolated installation before introducing them to a working site.

Customisations may change privacy, security, accessibility and performance characteristics. Support for the official release does not imply that every modification or external dependency has been tested or endorsed.

## 8. Backups, updates and recovery

Keep independent, recoverable backups before updates, restores, schema changes, imports or destructive maintenance. Verify that the backup covers the data needed for recovery.

The database export contains database tables and rows, not physical uploaded images. It can contain sensitive settings, credentials and personal information. Protect it accordingly and back up uploads and installation-specific files separately.

Restoring SQL affects the database configured for the current installation and can overwrite existing data. A pre-import safety backup, update rollback mechanism or confirmation dialog is a safeguard, not a guarantee that every failure can be recovered automatically.

Use the release-specific upgrade instructions and verify the public site and admin after an update. OTA and manual ZIP installation are different transport paths. Do not treat testing one path as proof that every host and every other path was tested.

Use development packages on local or staging installations unless the operator has deliberately evaluated and accepted their production risks. Keep personal files outside release-managed asset and documentation directories.

## 9. Security reports, support and service expectations

Use GitHub Issues for ordinary reproducible bugs, with secrets and personal information removed. Report dangerous security findings privately through the contact in the [Security Policy](SECURITY.md), rather than publishing exploit details before assessment.

The project does not promise that a release is immune to every attack or hosting failure. Security events are observations, not proof that every rejected request was malicious or that every intrusion will be detected.

Unless a separate written agreement explicitly provides otherwise, this document offers no guaranteed response time, resolution deadline, uptime, recovery service or fixed long-term-support period. A version number, download, sponsorship or donation does not by itself establish such an agreement.

Any separate paid support or hosted service should state its own scope and commitments without contradicting the software licence or implying that unsupported modifications have been certified.

## 10. Warranty, applicable rights and document changes

The software's warranty and liability provisions are those in GPL-3.0-only, particularly sections 15-17, subject to applicable law and any valid separate written commitment. This document does not claim to override mandatory legal rights or provide a universal exclusion of liability.

Changes to this explanatory document do not silently replace the software licence, withdraw previously granted GPL rights or make planned features part of an older release.

Before adopting this draft as a public policy, the maintainer should confirm its scope, support statements and branding language. Obtain appropriate legal review if it is intended to create binding contractual terms.

## References

- [VonCMS software licence](../LICENSE.md)
- [VonCMS licence and trademark notes](LICENSE.md)
- [Security Policy](SECURITY.md)
- [User Manual](MANUAL.md)
- [Installation Guide](INSTALL.md)
- [Upgrade Guide](UPGRADE.md)
- [Database Manager](DATABASE_MANAGER.md)
- [GNU GPLv3 text](https://www.gnu.org/licenses/gpl-3.0.en.html)
- [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html)

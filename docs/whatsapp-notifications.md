# Optional staff WhatsApp quote notifications

This is a preparation and manual deployment plan, not a deployment record. The implementation uses the official Meta WhatsApp Business Platform Cloud API and is disabled by default. No Meta template, production token, Secret Manager secret or production configuration was created or changed for this feature. No real WhatsApp message was sent. Existing frontend/Firebase configuration and both email recipients remain unchanged.

## Request behavior

1. Existing request admission, exact browser Origin enforcement, body limits and strict quote validation run unchanged.
2. One validated quote reserves one of the existing eight eligible mail attempts per 15 minutes, then calls `sendMail` once for `fernando403@gmail.com` and `globalfer_marilia@yahoo.com.br` under the existing trusted configuration.
3. Email failure keeps the existing generic HTTP 500 response and skips WhatsApp.
4. Email success permits one awaited WhatsApp attempt if explicitly enabled and correctly configured. It uses Node 24's built-in `fetch`, with a 5,000 ms deadline covering the HTTP request and parsing the success acknowledgement. The deadline aborts the request; redirects and automatic retries are disabled.
5. WhatsApp success, failure or timeout after email success all preserve HTTP 200 and `Solicitação enviada com sucesso.`. A failure logs only `[whatsapp] delivery_failed`. Invalid enabled configuration logs only `[whatsapp] configuration_invalid` once when the notifier is created and disables its attempts; email still works. Disabled configuration does not require WhatsApp credentials.

The acknowledgement confirms API acceptance only. There is no delivery webhook, delivery/read confirmation, durable queue or retry worker in this feature. A lost response or timeout can leave delivery uncertain even when Meta accepted a request. Do not resubmit a customer's quote to test or retry WhatsApp: email may already have been accepted.

## Official API and policy requirements

Meta requires a business portfolio, WhatsApp Business Account (WABA), registered business phone number and an app/token authorized to use that number. The sender's Meta **phone-number ID is an opaque numeric ID**, not the sender phone number or the WABA ID. The WABA phone-number listing exposes the ID and `display_phone_number` separately. Sending uses `whatsapp_business_messaging`; management operations may also require `whatsapp_business_management`. [Meta Cloud API documentation and collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)

Every attempt is a `POST` to `https://graph.facebook.com/{WHATSAPP_GRAPH_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`, with an internally constructed `Authorization: Bearer <server token>` header and JSON content type. The host and path are fixed in code; visitors cannot supply a URL. The proposed version pin is `v26.0`, identified as the latest version by Meta's changelog during the 2026-09-22 review. Recheck supported versions and migration requirements before deployment or upgrading the pin. [Graph API changelog](https://developers.facebook.com/docs/graph-api/changelog/)

The recipient must have provided their phone number and opted in to receive business messages. For this feature the recipient is an authorized **internal staff/company contact**, not the customer filling out the website form. Record that recipient's permission and honor withdrawal. Business-initiated messages and messages outside the 24-hour window following the recipient's last message require an approved template. A website quote does not open a WhatsApp customer service window. This integration therefore always sends a template, including when a conversation window happens to be open. [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy)

Do not assume the public Globalfer contact number can send to itself: Meta documents error `131021` for the sender and recipient being the same phone number. Separately obtain the actual registered sender number and the authorized staff recipient, verify that they are appropriate and distinct, and confirm the account supports this intended use. The code can validate an ID and an E.164 recipient syntactically; it cannot compare an opaque Meta ID with the actual sender phone number. This remains a manual release prerequisite. [Meta error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)

## Server configuration

| Variable | Meaning and validation |
| --- | --- |
| `WHATSAPP_ENABLED` | Only the literal `true` enables notifications. Unset or `false` disables them silently; other values disable them with one fixed configuration-error log. |
| `WHATSAPP_GRAPH_API_VERSION` | Explicit Graph version such as the reviewed `v26.0`; never an unversioned URL. |
| `WHATSAPP_PHONE_NUMBER_ID` | Numeric Meta ID for the registered sender phone number. Obtain it from the verified WABA; never invent a value. |
| `WHATSAPP_TO` | Authorized staff recipient in strict `+` E.164 format, with country code and no spaces/punctuation. The backend removes only the leading `+` for Meta's international-digits `to` field. This is independent of the customer's quote phone field. |
| `WHATSAPP_TEMPLATE_NAME` | Required exact approved template name. `globalfer_new_quote` is a proposal, not an already-approved template. |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Required exact approved template language code. `pt_BR` is the proposed Brazilian Portuguese locale; approval of another locale does not approve this one. |
| `WHATSAPP_ACCESS_TOKEN` | Secret authorized for this sender. The example file contains only an obvious placeholder; production must use a pinned Google Secret Manager version. |

Every variable belongs to the backend. Never use `VITE_*` for WhatsApp settings or place the token in React, Dockerfiles, `firebase.json`, source, documentation examples, logs or a committed `.env`. The `.env.example` deliberately has unusable sender/recipient/token placeholders and `WHATSAPP_ENABLED=false`. Merely copying that file cannot configure an enabled sender.

The request schema still accepts only `name`, `phone`, `city`, optional `message`, and `items` containing `product` and `measurements`. Unknown fields such as `whatsappTo`, `whatsapp_to`, `phoneNumberId`, `template`, `templateName`, `recipient`, `to`, `cc` and `bcc` are rejected. No quote value controls the endpoint, token, sender, recipient, template name or language.

## Proposed template for manual approval

Create/submit nothing automatically. An authorized Meta administrator must confirm the account, policy eligibility, category and exact language, then manually submit the desired template and wait for approval. Do not assume an internal lead alert qualifies as a utility template; Meta's category and approval decision must be confirmed before enabling this use.

Proposed name: `globalfer_new_quote`. Proposed language: `pt_BR`, which Meta lists for Portuguese (BR); the actual template must be approved in that exact locale. Proposed body, with exactly five positional text parameters and no header, media or buttons. Meta requires positional parameters to be sequential from 1 and supplied in that same order; template review also checks placement and the proportion of parameters to fixed text. Approval is not guaranteed by valid syntax. [Supported languages](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/supported-languages), [template overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview), [template review](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review)

```text
Novo orçamento recebido pelo site Globalfer.

Nome: {{1}}
Telefone: {{2}}
Cidade: {{3}}

Produtos:
{{4}}

Mensagem:
{{5}}

Verifique também o e-mail da Globalfer para os detalhes completos.
```

Use fictional examples for Meta's required sample values; never paste a real customer's quote into template approval samples. Example meanings, in required order:

| Position | Meaning | Fictional sample |
| --- | --- | --- |
| `{{1}}` | Customer name | `Cliente de demonstração` |
| `{{2}}` | Customer phone as quote text | `Telefone de demonstração` |
| `{{3}}` | City | `Cidade de demonstração` |
| `{{4}}` | Products and measurements summary | `1. Coluna — Medidas: 4 unidades de 3 metros` |
| `{{5}}` | Customer message or a nonempty fallback | `Solicito um orçamento de demonstração.` |

The application sends `messaging_product: "whatsapp"`, `recipient_type: "individual"`, the configured `to`, `type: "template"`, and `template: { name, language: { code }, components: [{ type: "body", parameters: [...] }] }`. Every parameter is `{ type: "text", text: <bounded summary> }`, in the order above. No customer data is used in header, authentication or routing fields. See Meta's [template payload examples](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview).

### Summary bounds

The email retains every validated item (up to 30), complete measurements and the original validated message. Only WhatsApp uses the smaller summary. The application applies these maximum lengths in UTF-16 code units, a conservative bound for ordinary Unicode character counts:

| Parameter | Maximum |
| --- | --- |
| Name | 80 |
| Phone | 40 |
| City | 80 |
| Products and measurements combined | 400 |
| Message | 200 |
| All substituted parameters combined | 800 |

Meta documents a maximum of 1,024 characters for the template body at creation. This project additionally applies that as a conservative budget for the entire rendered body; it does not rely on larger send-time allowances. The proposed template contributes 164 fixed characters outside its placeholders, giving at most **964** after substitution. Recheck the budget if the fixed template text changes, and verify the final template and parameter shape during manual approval. [Template body components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)

As an additional project formatting control, every summary parameter is a single line: whitespace and control characters are collapsed to single spaces, and unpaired UTF-16 surrogates are repaired. Truncation preserves whole Unicode grapheme clusters, including combined accents and emoji sequences; an oversized cluster is omitted intact. Nonempty fallback text covers missing/empty summary values.

Products retain the first items that fit the 400-unit field, with a maximum of five items. Each product label is capped at 64 units and its measurements at 96. The summary reserves room for a suffix identifying the number of omitted items. Truncated values use an ellipsis. This deterministic summary does not lower quote-validation limits or remove details from the email.

## Manual prerequisites before a future production deployment

All account-specific values below are intentionally pending; this change does not invent or retrieve them. Complete these checks and obtain deployment authorization before applying cloud changes or sending any real message.

1. **Meta Business account status:** confirm the authorized business portfolio, its current restrictions, verification requirements, billing/payment readiness and ability to use WhatsApp Business Platform for these staff notifications. Confirm the app is owned/authorized appropriately and is ready for production use rather than only test recipients.
2. **WhatsApp Business Account:** record the actual WABA ID and its business/app ownership and permission assignments. It is needed for account/phone/template administration, but this implementation has no WABA-ID environment variable.
3. **Sender phone-number ID:** obtain the actual registered sender ID through Meta's console/API and verify it belongs to that WABA. Set `WHATSAPP_PHONE_NUMBER_ID` only after that check.
4. **Sender phone number:** separately record the actual `display_phone_number`, registration status and display-name/account readiness. Confirm that sender can use the Cloud API under the account's supported setup. The backend does not need a separate sender-number variable.
5. **Internal recipient number:** obtain the intended staff/company WhatsApp number, verify its international E.164 format and WhatsApp reachability, and document permission to receive quote notifications. Set `WHATSAPP_TO` only from that verified value.
6. **Appropriate and distinct identities:** manually compare the actual sender number with the actual recipient number. Confirm the recipient is authorized to see customer names, phone numbers and quote summaries, and that notification consent/withdrawal handling is in place. The customer's phone remains quote data only.
7. **Approved template name:** manually create/submit the final template, with the exact five-parameter body/order above or a reviewed compatible variant. Confirm the category, policy eligibility and active approved status in this WABA. Then set `WHATSAPP_TEMPLATE_NAME`; do not assume the proposed name or utility category is approved.
8. **Approved template language:** verify the exact approved language variant, proposed `pt_BR`, and set `WHATSAPP_TEMPLATE_LANGUAGE` accordingly. Recheck formatting, sample values and the rendered-length bound against current Meta requirements before submission.
9. **Access token and lifecycle:** arrange a production system-user access token with the appropriate app/WABA/phone asset assignments and `whatsapp_business_messaging` permission. Management work may separately need `whatsapp_business_management`. Confirm the selected token's actual expiration, revocation/rotation procedure and accountable owner. Meta documents short-lived dashboard tokens (24 hours), and system-user tokens with durations up to 60 days or no scheduled expiration; a token without scheduled expiration can still be revoked or lose permissions. Never paste the token into a command argument, chat, issue, PR, logs or this repository.
10. **Google Secret Manager:** proposed new secret name is `globalfer-whatsapp-access-token` in project `globalfer-site`; it has **not** been created. Once separately authorized, an operator should securely add the token as a secret version and record that numeric version for a pinned reference. Do not use `latest` or modify the existing `SMTP_PASS:3` binding.
11. **Cloud Run changes:** update only the reviewed backend image and the six non-secret WhatsApp variables shown below, with the token supplied as a secret reference. Keep `WHATSAPP_ENABLED=false` until every prerequisite is complete and enabling real delivery is explicitly authorized. Preserve all SMTP configuration, both recipients, exact Origin, runtime identity, public access, `trust proxy=false`, 60-second request timeout, resource limits and instance/concurrency settings. The existing container includes `server/whatsapp.js`; no extra HTTP dependency is required.
12. **IAM for the secret:** grant `roles/secretmanager.secretAccessor` on this specific new secret to `globalfer-api-runtime@globalfer-site.iam.gserviceaccount.com`. The person/service doing the deployment also needs the existing appropriate Cloud Run deployment and service-account-use permissions. Do not grant project-wide secret access just for this feature. When a secret is injected as an environment variable, Cloud Run retrieves it before instance startup; an inaccessible secret can prevent that instance from starting, even if application notifications are disabled. [Cloud Run secret configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
13. **Firebase frontend:** no frontend fields, assets, build-time variables or Hosting changes are required. No Firebase redeployment is needed for this backend feature.

The future Cloud Run configuration mapping is:

| Setting | Value to apply after review |
| --- | --- |
| `WHATSAPP_ENABLED` | `false` during preparation; `true` only after authorized activation |
| `WHATSAPP_GRAPH_API_VERSION` | Reviewed supported pin, currently `v26.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | Verified numeric sender ID |
| `WHATSAPP_TO` | Verified authorized staff recipient in `+` E.164 format |
| `WHATSAPP_TEMPLATE_NAME` | Exact approved name |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Exact approved locale |
| Secret environment mapping | `WHATSAPP_ACCESS_TOKEN` → `globalfer-whatsapp-access-token:<verified numeric version>` |

Do not execute this mapping as part of preparing the PR. A later authorized rollout should validate health and safe negative requests first. A valid quote can send email and WhatsApp; any live delivery test requires separate explicit authorization. Roll back notification activity by deploying `WHATSAPP_ENABLED=false` if needed, while recognizing that an already-started attempt might still have been accepted.

## Abuse, costs, observability and remaining limits

WhatsApp shares the existing eligible-send reservation. There is no separate visitor-controlled sending endpoint or extra quota bucket. One reservation permits one email message and, only after email success, at most one WhatsApp API call. The eight-attempt/15-minute budget and 120-POST/minute admission budget remain process-wide fixed windows; restarts, boundary bursts, overlapping revisions and other senders outside this API prevent treating them as a durable provider-wide cap.

Meta can charge for template messages, and charges depend on the current category, destination and applicable pricing rules. Messaging limits, throughput limits, template quality/pause decisions, token revocation and account restrictions can block delivery independently of the application's budget. Review current [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) and [Cloud API limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/) for the actual account; set operational cost/quality monitoring without assuming a fixed price or unlimited sends. The pricing documentation reviewed on 2026-09-22 announces further changes for October 1, 2026, so recheck the rules at activation rather than assuming any present free-message allowance will continue.

Logs contain only the fixed configuration/delivery categories, never token/header values, provider response bodies, destination, sender ID or customer/template parameters. Provider errors remain internal and customer responses stay generic. Health checks report process availability, not working Meta credentials, approved templates, recipient consent, quota or final delivery. Monitor safe aggregate failure counts alongside the Meta account console, and define an operator-owned token rotation and failure response procedure.

Sending customer quote summaries to Meta and authorized staff adds an external processor and a staff-device retention surface. Review the business's relevant privacy notices, access and retention practices before activation. It does not require adding a customer WhatsApp opt-in field because this feature never messages the customer. The approved recipient's own business-messaging consent is still required.

Tests use injected provider responses and fake/in-memory SMTP, including timeout and redaction cases, and require no Meta or SMTP credentials. See [the security audit](../SECURITY-AUDIT.md) for verification evidence. Implementation preparation stops before template submission, secret creation/token entry, deployment, real delivery and PR merge.

# Kido — Privacy Policy

_Last updated: 2026-06-26_

Kido is an **unofficial, third-party client** for the Kiseido Go Server (KGS,
`gokgs.com`). This policy explains what the Kido browser extension does with your
data.

## Summary

**Kido does not collect, store, transmit, or sell any of your personal data to
the developer or to any third party.** The extension is serverless: it talks
**directly to the official KGS server** (`https://www.gokgs.com`) and to no one
else.

## What data is handled, and where it goes

| Data | How it is used | Where it goes |
|---|---|---|
| **KGS username & password** | Sent to KGS to log you in, exactly as the official KGS client does. | **Only to `https://www.gokgs.com`.** Never to the developer or any third party. |
| **Game, chat, and room data** | Displayed in the client while you use it. | Comes directly from KGS; not retained by the extension. |
| **Local preferences** (theme, UI color, saved login if you opt in) | Remember your settings between sessions. | Stored **locally in your browser** via the `storage` API. Never uploaded anywhere. |

## Permissions and why they are needed

- **`storage`** — to save your local preferences (theme, accent color, and, only
  if you choose "save password", your login) on your own device.
- **`declarativeNetRequest`** — to set the `Origin` and `Referer` request headers
  to `https://www.gokgs.com` so the client can communicate with the KGS JSON API,
  which rejects requests without them. These rules apply **only** to requests to
  `gokgs.com`.
- **`host_permissions: https://www.gokgs.com/*`** — the only server the extension
  ever contacts: the official Go server.

## No tracking, no analytics, no third parties

The extension contains **no analytics, no tracking, no advertising, and no
third-party network calls**. The only network destination is `gokgs.com`.

## Data retention

The developer retains **no data about you**, because no data about you is ever
sent to the developer. Locally stored preferences live only in your browser and
are removed when you uninstall the extension or clear its storage.

## Your KGS account

Your KGS account is governed by KGS's own terms and privacy practices. See
[https://www.gokgs.com/](https://www.gokgs.com/).

## Changes to this policy

Any changes will be published at the URL where this policy is hosted, with the
"Last updated" date above revised accordingly.

## Contact

Questions about this policy can be sent to **kido@tuta.com**.

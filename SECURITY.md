# Security Policy

CHIVE is a browser-only static application. For the data-handling and
runtime trust model, see [Privacy And Security](docs/PRIVACY_AND_SECURITY.md).

## Reporting A Vulnerability

For non-sensitive bugs, open a GitHub issue using the existing issue templates.

For a security concern that should not be disclosed publicly, contact the
project at `laoplucas@gmail.com`, the email address listed on the CHIVE About
page, first. Do not attach sensitive datasets to public issues.

## Supported Versions

CHIVE documents these deployments:

| Deployment | Branch | Support expectation |
|---|---|---|
| Stable | `main` | Recommended for normal use. |
| Preview | `develop` | Used for testing upcoming changes before release. |

Security fixes should land through the normal branch flow described in
`CONTRIBUTING.md`, then be deployed to the preview and stable environments.

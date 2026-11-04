# interface 1.2.1 license clarification request

Status: maintained correspondence template based on the 2026-11-04 [distribution audit](../distribution-license-audit.md). This template does not record delivery or a maintainer response, and does not change release decisions.

Subject: Request for authoritative license and copyright text for interface@1.2.1

## Message

Hi interface maintainers,

This message was prepared by AI using DIDMail's recorded npm, source and build-artifact audit evidence. Items requesting maintainer confirmation remain unverified.

We maintain [DIDMail Server](https://github.com/didmail-org/server), an Apache-2.0 project, and are reviewing third-party notices before distributing our compiled Cloudflare Worker. We have not released the build artifacts.

Our audit on November 4, 2026 established that:

- `interface@1.2.1` contributes code to our production Worker bundle.
- The [official npm release metadata](https://registry.npmjs.org/interface/1.2.1) declares MIT and names Charlie Duong as the author. The downloaded tarball passes npm's declared integrity check, but we found no complete license text.
- Its recorded `gitHead` is `f29d1edb221ed0527b274eabbc8f27cbf95ce6a9`.
- The repository URL redirects from `charlieduong94/interface-js` to `ctdio/interface-js`.
- We checked the release tree, the current tree at `12feb839f0e288998391f739c3558e2d6449bacb`, all six historical README revisions, and histories for common LICENSE filenames, without finding a complete grant and copyright notice.

Could you please provide:

1. Confirmation of the license applicable to the published **1.2.1** release, together with the complete original license text.
2. The correct copyright holder name(s), year(s), and any attribution or notice that must accompany redistribution.
3. Any additional notices or licensing obligations for incorporated third-party code, or confirmation that there are none.

A version-specific official file or an explicit written confirmation from the relevant rights holder would help us establish applicability. If a LICENSE file is added now, please clarify whether it also covers the existing npm 1.2.1 release.

We intend to bundle and potentially minify the code while retaining the required legal notices. We have left the copyright wording unresolved rather than inventing it from the author field or substituting a generic MIT template.

This evidence would allow us to address the **interface-specific Worker distribution blocker**, subject to verifying and including the required notices. Other independent release checks would remain. `interface@1.2.1` is not part of our current Blocklet artifact.

Our findings are documented in the [distribution audit](https://github.com/didmail-org/server/blob/main/docs/distribution-license-audit.md), with [release provenance and tarball hashes](https://github.com/didmail-org/server/blob/main/docs/license-source-evidence.json).

Thank you for your help.

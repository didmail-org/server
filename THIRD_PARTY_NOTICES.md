# Third-party notices

DIDMail original code and documentation remain Apache-2.0. Third-party components retain their original licenses. This notice set is evidence for the audited builds, **not distribution approval**: unresolved gates and exact sources are in the [distribution audit](https://github.com/didmail-org/server/blob/main/docs/distribution-license-audit.md).

## Modified dependencies

- `@ocap/client@1.19.15` — Apache-2.0; [original notice](third_party_licenses/ocap-client1.19.15.txt). DIDMail modifies `lib/base.js` to disable automatic RPC retries; the checked-in patch and changed-file comment identify the modification. This dependency contributes to the Worker.
- `deepmerge@4.3.1` — MIT; [original license](third_party_licenses/deepmerge4.3.1.txt). DIDMail modifies `index.js`, `dist/cjs.js` and `dist/umd.js` to reject prototype-related keys. It is installed in the toolchain, absent from the audited Worker and UI inputs. The upstream security alert and local remediation are separate from licensing.
- `minimatch@11.0.3` — BlueOak-1.0.0; [original license](third_party_licenses/minimatch11.0.3.txt). DIDMail modifies `dist/commonjs/index.js` for legacy callable and path-segment compatibility. It is absent from the audited Worker and UI inputs.

## Build dependency collections

- [Worker dependency collection](third_party_licenses/worker-bundle-licenses.txt): installed license/notice texts, the protocol SDK's nested notices, and recovered upstream texts. `@ocap/util@1.30.24` and `interface@1.2.1` remain explicitly unresolved.
- [Blocklet/UI dependency collection](third_party_licenses/blocklet-bundle-licenses.txt): `@tanstack/query-core@5.104.5` and `qrcode-generator@1.4.4`. ARC-generated runtime/template resources have a separate unresolved provenance gate. Including Worker notices in a Blocklet does not mean the Worker is present in that package.
- `cookie-signature@1.0.6` — MIT; [original published README license section](third_party_licenses/cookie-signature1.0.6-README-license.txt), verified against the official npm tarball.
- `boolbase@1.0.0` — ISC; [upstream license](third_party_licenses/boolbase1.0.0.txt), from the license-adding commit whose `index.js` is byte-identical to the published version.
- `express-async-errors@3.1.1` — ISC; [upstream license](third_party_licenses/express-async-errors3.1.1.txt), including original and modified-work attributions, from the license-adding commit whose `index.js` is byte-identical to the published version.
- `jsonify@0.0.1` — [original published README public-domain declaration](third_party_licenses/jsonify0.0.1-README-license.txt); no substitute license or invented copyright has been added.
- `qrcode-generator@1.4.4` — [MIT license](third_party_licenses/qrcode-generator1.4.4.txt) and [original source header](third_party_licenses/qrcode-generator1.4.4-source-header.txt), including the DENSO WAVE trademark attribution, from the matching `js1.4.4` source release.
- `google-protobuf@3.21.0` embeds Closure Library code: [original embedded header](third_party_licenses/google-protobuf3.21.0-Closure-header.txt), [Closure Apache-2.0 text](third_party_licenses/google-closure-library-Apache-2.0.txt). Its separate Google BSD license is in the Worker collection.

## Historical test-vector provenance

Historical Server commits contained a subset of public CFRG HPKE test vectors, absent from this newly initialized repository and these builds. The former Server repository was deleted at the owner's request. The matching upstream vector file has Git blob `514dd8bbcc4339f99ad9cf527007523f94668582`, identical to the earlier [Cisco go-hpke file](https://github.com/cisco/go-hpke/blob/13744bccfbe21a43be887884a7fc57c6642c6853/test-vectors.json). The original [Cisco BSD-2-Clause license](third_party_licenses/cisco-go-hpke-bsd2.txt) is preserved for historical provenance; the protocol repository records the full provenance. No historical repository or backup was reconstructed for this audit.

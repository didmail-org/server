# Notices for selected third-party dependencies

The repository includes modifications to the dependencies listed below. The original license texts are preserved here; consult each dependency for its own copyright and any additional notices. The collection covers checked-in patches and license/notice texts found in the audited Worker dependency set; it is not a complete notice bundle for a built distribution.

- `@ocap/client@1.19.15` — Apache-2.0; [license](third_party_licenses/ocap-client1.19.15.txt).
- `deepmerge@4.3.1` — MIT; [license](third_party_licenses/deepmerge4.3.1.txt).
- `minimatch@11.0.3` — BlueOak-1.0.0; [license](third_party_licenses/minimatch11.0.3.txt).

- [Production Worker dependency license and notice collection](third_party_licenses/worker-bundle-licenses.txt) — gathered from the installed packages contributing to the audited Worker build; see the [inventory](https://github.com/didmail-org/server/blob/main/docs/worker-dependency-inventory.md). This collection is incomplete and must not be treated as a final distribution notice set.

- `cookie-signature@1.0.6` — MIT; the installed package has no LICENSE file, so its [original README license section](third_party_licenses/cookie-signature1.0.6-README-license.txt) is preserved verbatim.

- Historical Server commits contained a subset of the public CFRG HPKE test vectors, absent from this newly initialized repository. The former Server repository was deleted at the owner's request. The matching upstream test-vector file is byte-identical (Git blob `514dd8bbcc4339f99ad9cf527007523f94668582`) to the earlier [Cisco go-hpke file](https://github.com/cisco/go-hpke/blob/13744bccfbe21a43be887884a7fc57c6642c6853/test-vectors.json). The original [Cisco BSD 2-Clause license](third_party_licenses/cisco-go-hpke-bsd2.txt) is preserved here for historical provenance. The protocol repository records the full provenance.

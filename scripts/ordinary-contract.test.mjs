import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  Ajv = createRequire(require.resolve('eslint'))('ajv');
const root = 'test/fixtures/protocol/dmp-2/',
  schema = JSON.parse(fs.readFileSync(root + 'schema.json')),
  fixture = JSON.parse(fs.readFileSync(root + 'fixtures/ordinary-vc.json'));
test('DMP/2 JSON artifacts conform to the strict independent schema and OpenAPI references resolve', () => {
  const ajv = new Ajv({ schemaId: 'auto', allErrors: true });
  const portable = { ...schema, $schema: 'http://json-schema.org/draft-07/schema#' };
  ajv.addSchema(portable, 'ordinary');
  for (const [name, artifact] of [
    ['Manifest', fixture.manifest],
    ['Terms', fixture.terms],
    ['Credential', fixture.credential],
    ['Receipt', fixture.receipt],
  ]) {
    const validate = ajv.compile({ $ref: 'ordinary#/$defs/' + name });
    assert.ok(validate(artifact), JSON.stringify(validate.errors));
    const extra = { ...artifact, unexpected: true };
    assert.equal(validate(extra), false);
  }
  const paid = JSON.parse(fs.readFileSync(root + 'fixtures/ordinary-paid.json'));
  for (const [name, artifact] of [
    ['Terms', paid.terms],
    ['Credential', paid.credential],
    ['Receipt', paid.receipt],
    ['PaymentRequest', paid.paymentRequest],
  ]) {
    const validate = ajv.compile({ $ref: 'ordinary#/$defs/' + name });
    assert.ok(validate(artifact), JSON.stringify(validate.errors));
  }
  const submit = ajv.compile({ $ref: 'ordinary#/$defs/Submit' });
  assert.ok(
    submit({
      expectedRevision: 1,
      termsId: fixture.terms.termsId,
      termsSha256: fixture.credential.credentialSubject.termsSha256,
    }),
  );
  assert.equal(
    submit({
      expectedRevision: 1,
      termsId: fixture.terms.termsId,
      termsSha256: fixture.credential.credentialSubject.termsSha256,
      signedTransaction: 'fake',
    }),
    false,
  );
  const api = JSON.parse(fs.readFileSync(root + 'openapi.json'));
  for (const match of JSON.stringify(api).matchAll(/\.\/schema\.json#\/\$defs\/([A-Za-z]+)/g))
    assert.ok(schema.$defs[match[1]], match[1]);
});
test('compact VC transport has an independent closed tuple schema', () => {
  const wire = JSON.parse(fs.readFileSync(root + 'compact-vc-wire.schema.json')),
    fixture = JSON.parse(fs.readFileSync(root + 'fixtures/ordinary-vc-compact.json'));
  const ajv = new Ajv({ schemaId: 'auto', allErrors: true }),
    portable = structuredClone(wire);
  portable.$schema = 'http://json-schema.org/draft-07/schema#';
  portable.properties.dmp2vc.items = portable.properties.dmp2vc.prefixItems;
  delete portable.properties.dmp2vc.prefixItems;
  const validate = ajv.compile(portable);
  assert.ok(validate(fixture.packed), JSON.stringify(validate.errors));
  for (const mutation of [
    (v) => v.dmp2vc.push('extra'),
    (v) => (v.dmp2vc[0] = 2),
    (v) => (v.dmp2vc[3] = 'not-a-digest'),
    (v) => (v.unexpected = true),
  ]) {
    const value = structuredClone(fixture.packed);
    mutation(value);
    assert.equal(validate(value), false);
  }
  assert.ok(fixture.signedTransactionBytes <= 664);
});

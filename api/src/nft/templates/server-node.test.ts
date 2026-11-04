import getServerNodeNFT from './server-node';

test('untrusted chain metadata remains SVG text instead of executable markup', () => {
  const attack = '</text><script>window.stolen=true</script><text>';
  const svg = getServerNodeNFT({
    moniker: attack,
    issuer: attack,
    data: { value: JSON.stringify({ endpoint: `https://example.test/?x=${attack}`, owner: attack, location: attack }) },
  } as any);
  expect(svg).not.toContain('<script>');
  expect(svg).not.toContain(attack);
  expect(svg.match(/&lt;script&gt;/g)).toHaveLength(5);
});

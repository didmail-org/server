import fs from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from './host/miniflare.mjs';
import { fromRandom } from '@ocap/wallet';
const wallet = fromRandom();
const root = '/dev/chain/beta';
const arcScript = `let mode='ok';let calls=[];const assetScopes=new Map();
const root='/dev/chain/beta';
const record=(kind,address,content)=>({path:root+'/'+kind+'/'+address,content:{address,...content},meta:{kind:'ocap:'+({factories:'factory',accounts:'account',stakes:'stake',assets:'asset',tokens:'token'}[kind]),provenance:{provider:'ocap'}}});
export default {async fetch(request){
 const path=new URL(request.url).pathname;
 if(path==='/.well-known/service/api/did/session')return Response.json({authenticated:true,user:{did:'owner',role:'owner'}});
 if(path==='/control'){mode=(await request.json()).mode;return Response.json({mode});}
 if(path==='/calls')return Response.json(calls);
 if(path!=='/afs'||request.method!=='POST')return new Response('Only AFS reads expected',{status:500});
 const {method,params}=await request.json();calls.push({method,...params});
 if(!['read','list'].includes(method))return new Response('Mutation blocked',{status:500});
 if(mode==='http-error')return new Response('down',{status:502});
 if(mode==='malformed')return new Response('not json');
 if(mode==='mount-missing')return Response.json({success:false,error:{code:1,message:'mount missing'}});
 const p=params.path;
 if(p.endsWith('/.meta/.capabilities'))return Response.json({success:true,data:{data:{meta:{provenance:{provider:'ocap'}},content:{operations:{read:true,list:{supported:true}}}}}});
 if(mode==='offline')return Response.json({success:false,error:{code:5,message:'upstream failed'}});
 if(p.endsWith('/missing'))return Response.json({success:false,error:{code:1,message:'not found'}});
 let data;
 if(method==='list'){
  if(p.endsWith('/tokens'))data={data:[record('tokens','token',{balance:'900719925474099312345',decimal:18,symbol:'TBA'})]};
  else {const owner=params.options.where.ownerAddress||'node',parent=params.options.where.factoryAddress||'factory';assetScopes.set('asset',{owner,parent});data={data:[record('assets','asset',{owner,parent,genesisTime:'2026-01-01',data:{value:'{"name":"NFT","display":""}'}})],total:1};}
 } else {
  const parts=p.split('/');const kind=parts.at(-2),address=parts.at(-1);
  data={data:record(kind,address,{...(kind==='assets'?{...assetScopes.get(address),display:{content:'<svg><script>window.stolen=true</script></svg>'},data:{value:JSON.stringify({name:'NFT',...(mode==='legacy-svg'?{}:{display:mode==='unsafe-current-svg'?'<svg><script>window.currentSource=true</script></svg>':'<svg>saved</svg>'})})}}:{}),name:'Factory',nonce:'42',numMinted:7,genesisTime:'2026-01-01',renaissanceTime:'2026-10-25',decimal:18,symbol:'TBA',input:{tokens:[{address:'token',decimal:18,symbol:'TBA',value:'1000000000000000000'}]},output:{display:{type:'svg',content:'<svg>node</svg>'}},tokens:[{address:'token',value:'1000000000000000000'}],assets:['asset'],revokedAssets:[],revokedTokens:[]})};
 }
 return Response.json({success:true,data});
}};`;
async function runtime(extra = {}) {
  return new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'didmail',
          modules: true,
          scriptPath: 'artifacts/business-tests/test.mjs',
          compatibilityDate: '2026-10-24',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            NODE_SECRET_KEY: wallet.secretKey,
            DIDMAIL_URL: 'https://didmail.test',
            CHAIN_ID: 'beta',
            CHAIN_HOST: 'https://beta.abtnetwork.io/api/',
            SERVER_NODE_FACTORY: 'factory',
            ENVELOPE_FACTORY: 'envelope-factory',
            NAMECARD_FACTORY: 'namecard-factory',
            LOCAL_TOKEN_ID: 'token',
            FACTORY_OWNER: '0x73AEAc8Be08298fD383152335A182E3e307Eb95a',
            ...extra,
          },
          databaseFixtures: { DB: 'chain-test' },
          objectFixtures: { BLOBS: 'chain-test' },
          serviceBindings: { ARC: 'arc', ...(extra.USE_CHAIN_BINDING ? { ARC_CHAIN: 'chain' } : {}) },
          outboundService: 'deny',
        },
        {
          name: 'arc',
          modules: true,
          script: extra.USE_CHAIN_BINDING
            ? arcScript.replace(
                'const {method,params}=await request.json();',
                "return new Response('Public AFS requires authentication',{status:401}); const {method,params}=await request.json();",
              )
            : arcScript,
          compatibilityDate: '2026-10-24',
        },
        { name: 'chain', modules: true, script: arcScript, compatibilityDate: '2026-10-24' },
        {
          name: 'deny',
          modules: true,
          script: 'export default {fetch(){return new Response("Direct chain request blocked",{status:502})}}',
          compatibilityDate: '2026-10-24',
        },
      ],
    }),
  );
}
const read = (mf, method, input) =>
  mf.dispatchFetch('https://didmail.test/__chain-read', { method: 'POST', body: JSON.stringify({ method, input }) });
const control = async (mf, mode) =>
  (await mf.getWorker('arc')).fetch('https://arc/control', { method: 'POST', body: JSON.stringify({ mode }) });
test('business adapter reads factories, balances, NFT lists and stakes only through ARC AFS', async () => {
  const mf = await runtime();
  try {
    const factory = await (await read(mf, 'getFactoryState', { address: 'factory' })).json();
    assert.equal(factory.state.output.display.content, '<svg>node</svg>');
    assert.equal(factory.state.context.renaissanceTime, '2026-10-25');
    const account = await (await read(mf, 'getAccountState', { address: 'node' })).json();
    assert.equal(account.state.tokens[0].value, '900719925474099312345');
    const list = await (
      await read(mf, 'listAssets', {
        ownerAddress: 'node',
        factoryAddress: 'factory',
        paging: { cursor: '0', size: 10 },
      })
    ).json();
    assert.equal(list.assets[0].address, 'asset');
    assert.equal(list.page.total, 1);
    const stake = await (await read(mf, 'getStakeState', { address: 'stake' })).json();
    assert.deepEqual(stake.state.assets, ['asset']);
    assert.equal((await (await read(mf, 'getAccountState', { address: 'missing' })).json()).state, null);
    const calls = await (await (await mf.getWorker('arc')).fetch('https://arc/calls')).json();
    assert.ok(calls.every((call) => call.path.startsWith(root + '/')));
    assert.ok(
      calls.some(
        (call) => call.options?.where?.ownerAddress === 'node' && call.options.where.factoryAddress === 'factory',
      ),
    );
    assert.equal(calls.filter((call) => call.path.endsWith('.capabilities')).length, 1);
    for (const mode of ['offline', 'malformed', 'http-error']) {
      await control(mf, mode);
      const response = await read(mf, 'getAccountState', { address: 'node' });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'AFS_CHAIN_UNAVAILABLE');
    }
  } finally {
    await mf.dispose();
  }
});
test('current template SVG takes precedence over stale legacy SVG through the actual HTTP handler response', async () => {
  const mf = await runtime();
  try {
    const response = await mf.dispatchFetch('https://didmail.test/api/display/asset');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<svg>saved</svg>');
    assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  } finally {
    await mf.dispose();
  }
});
for (const [mode, expected] of [
  ['unsafe-current-svg', '<svg><script>window.currentSource=true</script></svg>'],
  ['legacy-svg', '<svg><script>window.stolen=true</script></svg>'],
]) {
  test(`chain SVG documents from ${mode} retain sandbox policy before returning on the application origin`, async () => {
    const mf = await runtime();
    try {
      await control(mf, mode);
      const response = await mf.dispatchFetch('https://didmail.test/api/display/asset');
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      const body = await response.text();
      assert.equal(body, expected, 'The selected current or legacy source bytes must remain exact');
      assert.match(body, /<script>/, 'Untrusted source bytes are isolated by the response policy');
    } finally {
      await mf.dispose();
    }
  });
}
test('REST balances, factory cache, template lists and stake status keep their contracts through AFS', async () => {
  const mf = await runtime();
  try {
    const db = await mf.getDatabase('DB', 'didmail');
    for (const file of (await fs.readdir('blocklet/providers/didmail-business/migrations')).sort()) {
      for (const statement of (await fs.readFile('blocklet/providers/didmail-business/migrations/' + file, 'utf8'))
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    const get = async (path) => {
      const response = await mf.dispatchFetch('https://didmail.test' + path);
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return body;
    };
    const account = await get('/api/account/state');
    assert.equal(account.chainStatus, 'ready');
    assert.equal(account.tokens[0].value, '900719925474099312345');
    assert.notEqual(account.address, 'owner');
    const factory = await get('/api/servers/factory?refresh=1');
    assert.equal(factory.minted, 7);
    assert.equal(factory.display, '<svg>node</svg>');
    const stake = await get('/api/stake/state');
    assert.equal(stake.staked, true);
    assert.equal(stake.ownerAssets[0].address, 'asset');
    for (const kind of ['envelope', 'namecard']) {
      const list = await get('/api/' + kind + '/list');
      assert.equal(list[kind === 'envelope' ? 'envelopes' : 'namecards'][0].address, 'asset');
      assert.equal(list[kind === 'envelope' ? 'envelopes' : 'namecards'][0].display, '<svg>saved</svg>');
      assert.equal(list.cache.source, 'chain');
    }
    const calls = await (await (await mf.getWorker('arc')).fetch('https://arc/calls')).json();
    assert.equal(
      calls.filter((call) => call.path === root + '/factories/factory').length,
      1,
      'template pricing reuses the saved factory token',
    );
    assert.equal(
      calls.filter((call) => call.path === root + '/tokens/token').length,
      0,
      'no redundant token detail query',
    );
    await control(mf, 'offline');
    assert.equal((await get('/api/servers/factory')).name, 'Factory');
    assert.equal((await get('/api/envelope/list')).cache.source, 'cache');
    const unavailable = await get('/api/account/state');
    assert.equal(unavailable.chainStatus, 'unavailable');
    assert.equal(unavailable.chainError.code, 'AFS_CHAIN_UNAVAILABLE');
    assert.equal(unavailable.chainError.stage, 'rpc');
    assert.match(unavailable.chainError.path, /\/accounts\//);
    assert.equal(JSON.stringify(unavailable.chainError).includes('stack'), false);
    await control(mf, 'http-error');
    const httpFailure = await get('/api/account/state');
    assert.equal(httpFailure.chainError.httpStatus, 502);
    assert.equal(httpFailure.chainError.stage, 'http');
    await control(mf, 'offline');
    const failedStake = await mf.dispatchFetch('https://didmail.test/api/stake/state');
    assert.equal(failedStake.status, 500);
  } finally {
    await mf.dispose();
  }
});
test('a dedicated chain binding works without weakening the public ARC authentication gate', async () => {
  const mf = await runtime({ USE_CHAIN_BINDING: true });
  try {
    const response = await read(mf, 'getFactoryState', { address: 'factory' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).state.name, 'Factory');
    const publicResponse = await (
      await mf.getWorker('arc')
    ).fetch('https://arc/afs', {
      method: 'POST',
      body: JSON.stringify({ method: 'read', params: { path: root + '/accounts/node' } }),
    });
    assert.equal(publicResponse.status, 401);
    const calls = await (await (await mf.getWorker('chain')).fetch('https://chain/calls')).json();
    assert.ok(calls.length >= 2);
  } finally {
    await mf.dispose();
  }
});
test('missing mounts and mismatched chain endpoints fail closed', async () => {
  for (const config of [
    {},
    { CHAIN_HOST: 'https://wrong-chain.test/api/' },
    { ARC_CHAIN_PATH: '/dev/chain/private', ARC_CHAIN_ENDPOINT: 'https://wrong-chain.test/api/' },
  ]) {
    const mf = await runtime(config);
    try {
      await control(mf, 'mount-missing');
      const response = await read(mf, 'getAccountState', { address: 'node' });
      assert.equal(response.status, 503);
      assert.ok((await response.json()).message);
    } finally {
      await mf.dispose();
    }
  }
});

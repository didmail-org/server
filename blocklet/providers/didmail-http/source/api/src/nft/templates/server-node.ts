import { getHasher, types } from '@ocap/mcrypto';
import { createCredentialList } from '@arcblock/vc';
import getCountryFlag from 'country-flag-icons/unicode';
import getWallet from '../../../../identity/wallet';
import env from '../../../../config/env';
// import logger from '../../libs/logger';

const wallet = getWallet();
const xmlText = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );

export const getCredentialList = (asset: GraphQLClient.AssetState) => {
  const issuer = { wallet, name: env.appName };
  const status = [
    {
      type: 'text',
      name: 'running-status',
      reason: 'DIDMail Server Node is running',
      label: 'Node Status',
      value: 'Running',
    },
  ];
  const actions = [
    {
      id: `${env.appUrl}`,
      type: 'navigate',
      scope: 'public',
      name: 'open-dapp',
      label: 'Open DApp',
    },
  ];
  const statusList = createCredentialList({
    issuer,
    claims: status,
    issuanceDate: new Date().toISOString(),
  });
  const actionList = createCredentialList({
    issuer,
    claims: actions,
    issuanceDate: new Date().toISOString(),
  });

  return { id: asset.address, description: `Status and Actions of ${asset.moniker}`, statusList, actionList };
};

const getServerNodeNFT = (asset: GraphQLClient.AssetState) => {
  const data = JSON.parse(asset.data.value);
  const endpoint = data.endpoint?.replace(/&#x2F;/g, '/');
  const country = data.location?.split('-')[1];
  const flag = country ? getCountryFlag(country.toUpperCase()) : '';
  const owner = data.owner!;
  const getColors = () => {
    const hash = getHasher(types.HashType.SHA3)(endpoint, 1, 'base16');
    const colors: string[] = [];
    for (let i = 0; i < hash.length; i += 6) {
      colors.push(`#${hash.slice(i, i + 6)}`);
    }
    return colors;
  };
  const colors = getColors();

  const content = `<svg width="100%" height="100%" viewBox="0 0 374 130" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
          <linearGradient id="bg" x1="0" y1="0.9" x2="1" y2="0.9" >
            <stop stop-color="#191919" offset="0"></stop>
            <stop stop-color="#292929" offset="0.2"></stop>
            <stop stop-color="#393939" offset="0.5"></stop>
            <stop stop-color="#292929" offset="0.7"></stop>
            <stop stop-color="#191919" offset="1"></stop>
          </linearGradient>
        </defs>
      <rect rx="4" ry="4" width="374" height="130" stroke="none" fill="url(#bg)" />
      <svg>
        <defs>
          <polygon id="hexagon" points="100,10 190,50 190,150 100,190 10,150 10,50" opacity="0.8">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 100 100"
              to="360 100 100"
              dur="10s"
              repeatCount="indefinite"
              additive="sum"
            />        
          </polygon>
        </defs>
        
        <g xmlns:xlink="http://www.w3.org/1999/xlink" transform="translate(-15,20) scale(1.3)">
        	<use xlink:href="#hexagon" transform="translate(36,9) scale(0.1)" fill="${colors[0]}" />
        	<use xlink:href="#hexagon" transform="translate(27,14) scale(0.11)" fill="${colors[1]}" />
        	<use xlink:href="#hexagon" transform="translate(45,14) scale(0.12)" fill="${colors[2]}" />
        	<use xlink:href="#hexagon" transform="translate(18,19) scale(0.13)" fill="${colors[3]}" />
        	<use xlink:href="#hexagon" transform="translate(36,5) scale(0.14)" fill="${colors[4]}" />
        	<use xlink:href="#hexagon" transform="translate(54,19) scale(0.15)" fill="${colors[5]}" />
        	<use xlink:href="#hexagon" transform="translate(27,23) scale(0.16)" fill="${colors[6]}" />
        	<use xlink:href="#hexagon" transform="translate(45,23) scale(0.17)" fill="${colors[7]}" />
        	<use xlink:href="#hexagon" transform="translate(36,28) scale(0.18)" fill="${colors[8]}" />
        </g>
      </svg>
      <defs>
          <linearGradient x1="0" y1="0" x2="1" y2="0.9" id="linearGradient-1">
                <stop stop-color="#AF957E" offset="0"></stop>
                <stop stop-color="#A8A08E" offset="0.28"></stop>
                <stop stop-color="#80756B" offset="0.53"></stop>
                <stop stop-color="#A59D8B" offset="0.78"></stop>
                <stop stop-color="#AA907B" offset="1"></stop>
          </linearGradient>
        </defs>  
       
      <text x="325" y="40" font-size="45">${xmlText(flag)}</text>
      <text x="348" y="45" text-anchor="middle" class="info-text">
            ${xmlText(data.location)}
      </text>
      <text x="187" y="20" text-anchor="middle" font-size="10" font-family="Arial,Helvetica,sans-serif" fill="url(#linearGradient-1)">
        ${xmlText(asset.moniker)}
      </text>
      <svg id="line1" x="146" y="25" width="82" height="1">
        <g id="Symbols" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
          <g id="Card/Certificate" transform="translate(-146.000000, -32.000000)" stroke="url(#linearGradient-1)">
            <line x1="146" y1="32" x2="228" y2="33" id="line"></line>
          </g>
        </g>
      </svg>
      <use xlink:href="#line1" transform="translate(0,72) rotate(-0.5,73,0)"/>
      <text x="187" y="45" class="info-text" text-anchor="middle">
        <tspan x="187" dy="0">OWNER: <tspan font-size="6" font-weight="normal" dy="-1">${xmlText(owner)}</tspan></tspan>
        <tspan x="187" dy="15">ISSUER: <tspan font-size="6" font-weight="normal" dy="-1">${xmlText(asset.issuer)}</tspan></tspan>
      </text>
      <text x="187" y="90" class="info-text" text-anchor="middle">
      	<tspan x="187" dy="0" fill="url(#linearGradient-1)">Server Node Endpoint</tspan>
        <tspan x="187" dy="20" font-weight="normal">${xmlText(endpoint)}</tspan>
      </text>  
      <style>
        .info-text {
          font-size: 8px;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: bold;
          fill: white;      
        }
      </style>
    </svg>`;
  return content;
};

export default getServerNodeNFT;

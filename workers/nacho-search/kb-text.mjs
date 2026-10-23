// Shared normalization for the knowledge base. No entry data here, so the
// builder can use it before kb-data.mjs exists.

export const STOP = new Set("a an the of to and or for in on is are was were be been being what why how does do did you your with from this that it right now just about into per please me my can i we our am".split(" "));

const PHRASES = [
    [/proof of work/g, "proofofwork"],
    [/proof of stake/g, "proofofstake"],
    [/seed phrase/g, "seedphrase"],
    [/recovery phrase/g, "seedphrase"],
    [/mnemonic phrase/g, "seedphrase"],
    [/private keys/g, "privatekey"],
    [/private key/g, "privatekey"],
    [/public keys/g, "publickey"],
    [/public key/g, "publickey"],
    [/hardware wallet/g, "hardwarewallet"],
    [/full node/g, "fullnode"],
    [/soft fork/g, "softfork"],
    [/hard fork/g, "hardfork"],
    [/block chain/g, "blockchain"],
    [/time chain/g, "timechain"],
    [/smart contract/g, "smartcontract"],
    [/central bank/g, "centralbank"],
    [/orange tickets/g, "orangeticket"],
    [/orange ticket/g, "orangeticket"],
    [/two-factor/g, "twofactor"],
    [/two factor/g, "twofactor"],
    [/self-custody/g, "selfcustody"],
    [/self custody/g, "selfcustody"],
    [/not your keys/g, "notyourkeys"],
    [/lightning network/g, "lightning"],
    [/bitcoin quest/g, "bitcoinquest"],
    [/satoshi's favor/g, "satoshisfavor"],
    [/satoshis favor/g, "satoshisfavor"],
    [/time preference/g, "timepreference"],
    [/dollar-cost averaging/g, "dollarcost"],
    [/dollar cost averaging/g, "dollarcost"],
    [/block reward/g, "blockreward"],
    [/payment channel/g, "paymentchannel"]
];

const TOKEN_SYN = {
    btc: "bitcoin",
    xbt: "bitcoin",
    bitcoins: "bitcoin",
    ln: "lightning",
    pow: "proofofwork",
    pos: "proofofstake",
    eth: "ethereum",
    ether: "ethereum",
    sol: "solana",
    doge: "dogecoin",
    ada: "cardano",
    nft: "nft",
    nfts: "nft",
    bch: "bitcoincash",
    ltc: "litecoin",
    xrp: "xrp",
    usdt: "tether",
    usdc: "usdc",
    utxos: "utxo",
    bips: "bip",
    txs: "transaction",
    txn: "transaction",
    tx: "transaction",
    sats: "satoshiunit",
    sat: "satoshiunit",
    satoshis: "satoshiunit",
    halvings: "halving",
    halvening: "halving",
    "sha-256": "sha256",
    multisigs: "multisig",
    statechains: "statechain",
    etfs: "etf",
    altcoins: "altcoin",
    memecoins: "memecoin",
    stablecoins: "stablecoin"
};

export function foldKey(text) {
    let value = String(text || "");
    try { value = value.normalize("NFKC"); } catch (e) {}
    value = value.toLowerCase();
    value = value.replace(/what['’]?s/g, "what is").replace(/how['’]?s/g, "how does").replace(/it['’]?s/g, "it is").replace(/don['’]?t/g, "do not").replace(/can['’]?t/g, "cannot");
    value = value.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    PHRASES.forEach(function (pair) { value = value.replace(pair[0], pair[1]); });
    return value.split(" ").filter(Boolean).map(function (token) { return TOKEN_SYN[token] || token; }).join(" ");
}

export function contentTokens(text) {
    return foldKey(text).split(" ").filter(function (token) { return token && !STOP.has(token); });
}

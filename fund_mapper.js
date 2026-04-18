const algosdk = require('algosdk');
const mnemonic = 'subway omit cereal quality coconut shallow buyer vanish bright galaxy snake real small train trip empty history tip release usage onion decide symptom able sock';
const appAddr = 'REXZM7X2ET3C3VHWTWSMDGUX33PNQRFP4NZBZ23TI6E7B6SCCM4NPMZ2FI';

async function fundApp() {
    try {
        const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
        const sender = algosdk.mnemonicToSecretKey(mnemonic);
        const params = await client.getTransactionParams().do();
        
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            from: sender.addr,
            to: appAddr,
            amount: 3000000, // 3 ALGO
            suggestedParams: params
        });
        
        const signed = txn.signTxn(sender.sk);
        const { txId } = await client.sendRawTransaction(signed).do();
        
        console.log(`SUCCESS: Funded 3 ALGO to ${appAddr}`);
        console.log(`TXID: ${txId}`);
        
        await algosdk.waitForConfirmation(client, txId, 4);
        console.log('CONFIRMED');
    } catch (e) {
        console.error('FAILED:', e.message);
        process.exit(1);
    }
}

fundApp();
